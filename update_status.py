#!/usr/bin/env python3
"""Mission Control status updater.

Gathers read-only activity signals for each agent from the box and merges optional
summaries written by a routine, then writes status.json next to this script.

Box signals (weak, timestamp-only):
  - mtime of agents/<id>/attachments, assets, automations dirs and their files
  - mtime of agents/<id>/store.db-wal (non-empty, not caused by a profile edit)
  - timestampMs of transcript_entries events in store.db (copied to /tmp first)
  - number of files in agents/<id>/automations (routine count, if any)
  profile.json / settings.json and "name-changed" events are ignored (user edits),
  as are mtimes within 5 min after box boot (host.lock) since the store sync touches them.

summaries.json (optional, written by a routine), keyed by agent id or name:
  { "cc6e0909-...": {"summary": "Bikin dashboard mission control",
                     "lastActive": "2026-10-20T03:40:00+07:00" | 1792441200000,
                     "routines": 2, "working": true} }
  - summary  : short neutral text, trimmed to 60 chars
  - lastActive: ISO-8601 or epoch ms; newest of this and box signals wins
  - routines : int, overrides box count
  - working  : optional bool; true => at least "On mission" if active < 2h

Status: Online if active < 15 min, On mission if active < 2 h, else Standby.
No message content is ever read or written.
"""
import json, os, re, shutil, sqlite3, sys, tempfile, time
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
AGENT_ROOT = os.environ.get("MC_AGENT_ROOT", "/home/box/agent-data/agents")
OUT = os.path.join(HERE, "status.json")
SUMMARIES = os.path.join(HERE, "summaries.json")
WIB = timezone(timedelta(hours=7))

AGENTS = {  # id -> dashboard key (matches AGENTS[].id in index.html)
    "cc6e0909-6b74-413f-b657-fa0fedd00cae": "nerd",
    "4b9ac851-2160-48b6-9962-f4c9fa305133": "makelar",
    "7bb34c58-76f3-4f59-ab4b-48d396e81e6e": "alcapone",
    "81d79561-02ac-4235-9729-52e0f6036254": "sisotoy",
    "8a669244-2319-46f5-a720-dd210eaefa0b": "kuku",
    "e805653f-bbc6-4384-8273-6250a277d2eb": "kurir",
    "edbe6eb5-9a50-4dd1-8bf2-92fc4ee79f06": "jack",
}

HOST_LOCK = os.path.join(os.path.dirname(AGENT_ROOT), "host.lock")
BOOT = os.path.getmtime(HOST_LOCK) if os.path.exists(HOST_LOCK) else 0
NOISE_EVENTS = {"name-changed"}  # user-side profile edits, not agent work

def _ok(t):
    # files touched by the box boot/store sync (within 5 min after host.lock) are noise
    return not (BOOT and BOOT - 60 <= t <= BOOT + 300)

def newest_mtime(paths):
    best = 0.0
    for p in paths:
        if not os.path.exists(p):
            continue
        t = os.path.getmtime(p)
        if _ok(t): best = max(best, t)
        if os.path.isdir(p):
            for e in os.scandir(p):
                try:
                    t = e.stat().st_mtime
                    if _ok(t): best = max(best, t)
                except OSError: pass
    return best

def transcript_event_ms(agent_dir):
    src = os.path.join(agent_dir, "store.db")
    if not os.path.exists(src):
        return 0
    tmp = tempfile.mkdtemp(prefix="mcdb-")
    try:
        for suf in ("", "-wal", "-shm"):
            if os.path.exists(src + suf):
                shutil.copy2(src + suf, os.path.join(tmp, "store.db" + suf))
        con = sqlite3.connect(f"file:{os.path.join(tmp,'store.db')}?mode=ro", uri=True)
        best = 0
        for (entry,) in con.execute("select entry from transcript_entries"):
            try:
                d = json.loads(entry)
                ev = d.get("event") if isinstance(d.get("event"), dict) else {}
                if ev.get("type") in NOISE_EVENTS: continue
                best = max(best, int(d.get("timestampMs") or 0))
            except Exception:
                pass
        con.close()
        return best
    except Exception:
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

def parse_ts(v):
    if v is None: return 0
    if isinstance(v, (int, float)):
        return int(v if v > 1e11 else v * 1000)
    try:
        dt = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        if dt.tzinfo is None: dt = dt.replace(tzinfo=WIB)
        return int(dt.timestamp() * 1000)
    except Exception:
        return 0

SENSITIVE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s-]{8,}\d")
def clean_summary(s):
    if not isinstance(s, str): return ""
    s = SENSITIVE.sub("[disembunyikan]", " ".join(s.split()))
    return s if len(s) <= 60 else s[:59].rstrip() + "…"

def load_summaries():
    if not os.path.exists(SUMMARIES): return {}
    try:
        data = json.load(open(SUMMARIES, encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception as e:
        print(f"warning: summaries.json ignored ({e})", file=sys.stderr)
        return {}

def status_for(age_min, working):
    if age_min is None: return "Standby"
    if age_min < 15: return "Online"
    if age_min < 120: return "On mission"
    return "Standby"

def main():
    now_ms = int(time.time() * 1000)
    summ = load_summaries()
    out = {"generatedAt": now_ms,
           "generatedAtWIB": datetime.fromtimestamp(now_ms/1000, WIB).strftime("%Y-%m-%d %H:%M WIB"),
           "source": "box-timestamps" + ("+summaries" if summ else ""),
           "agents": {}}
    for aid, key in AGENTS.items():
        d = os.path.join(AGENT_ROOT, aid)
        box_ms = int(1000 * newest_mtime([os.path.join(d, x) for x in ("attachments", "assets", "automations")]))
        wal, prof = os.path.join(d, "store.db-wal"), os.path.join(d, "profile.json")
        if os.path.exists(wal) and os.path.getsize(wal) > 0:
            wt = os.path.getmtime(wal)
            # a WAL write within 10 s of a profile edit is the rename itself, not work
            if _ok(wt) and not (os.path.exists(prof) and abs(wt - os.path.getmtime(prof)) < 10):
                box_ms = max(box_ms, int(wt * 1000))
        box_ms = max(box_ms, transcript_event_ms(d))
        auto_dir = os.path.join(d, "automations")
        routines = len([f for f in os.listdir(auto_dir) if not f.startswith(".")]) if os.path.isdir(auto_dir) else 0
        s = summ.get(aid) or summ.get(key) or {}
        if not isinstance(s, dict): s = {}
        last_ms = max(box_ms, parse_ts(s.get("lastActive")))
        if last_ms > now_ms + 60_000: last_ms = now_ms  # clamp future timestamps
        if isinstance(s.get("routines"), int): routines = s["routines"]
        age = (now_ms - last_ms) / 60000 if last_ms else None
        st = status_for(age, bool(s.get("working")))
        if s.get("working") is False and st == "On mission": st = "Standby"
        out["agents"][key] = {
            "id": aid,
            "status": st,
            "lastActive": last_ms or None,
            "lastActiveWIB": datetime.fromtimestamp(last_ms/1000, WIB).strftime("%Y-%m-%d %H:%M WIB") if last_ms else None,
            "summary": clean_summary(s.get("summary", "")),
            "routines": routines,
            "summarySource": "routine" if s.get("summary") else None,
        }
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    os.replace(tmp, OUT)
    print(f"wrote {OUT}")
    for k, v in out["agents"].items():
        print(f"  {k:9s} {v['status']:10s} {v['lastActiveWIB'] or '-':22s} routines={v['routines']} {v['summary']}")

if __name__ == "__main__":
    main()
