#!/usr/bin/env python3
"""P10: bersihkan gambar dari generator supaya jadi pixel art asli Neo HQ.

  python3 tools/pixelize.py gambar.png                     # skala dideteksi otomatis
  python3 tools/pixelize.py gambar.png --size 96x74        # paksa ukuran asli (gambar AI tanpa grid rapi)
  python3 tools/pixelize.py a.png b.png --out assets/walls --orphans --outline

Langkah: buang background (alpha / #ff00ff) jadi alpha biner, perkecil ke 1x dengan warna
terbanyak per blok (bukan bilinear), kunci ke palet 32 warna di ruang OKLab tanpa dithering,
opsional hapus piksel yatim dan tambah outline #07051a, lalu simpan PNG bersih + contact sheet
sebelum/sesudah 400%. Keluar dengan kode 1 kalau ada file yang warnanya > 32.
"""
import argparse, os, sys
from collections import Counter
import numpy as np
from PIL import Image

PALETTE = """07051a 0e0b24 1d1842 2a2357 3a3072 4a4290 5b51a8 8a83c8 0b1636 1d2554 2d3870 3b6cff
7e8fd0 b9c6f2 dfe7ff ffffff 14607a 1a7a9a 35f2ff e0ffff 7d2ea0 c24bd6 ff3ea5 9b5cff
c8102e ff4a5a 7a4a0e ffb547 ffd27a 12302b 2a5e4e 5cf08a""".split()
PAL = np.array([[int(h[i:i + 2], 16) for i in (0, 2, 4)] for h in PALETTE], np.float32)
OUTLINE = (7, 5, 26)
ZOOM = 4
ERR_WARN = 0.03   # rata-rata jarak OKLab; gambar yang dibuat dengan palet P6 ada di bawah 0.01


def oklab(rgb):
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    l = np.cbrt(0.4122214708 * c[..., 0] + 0.5363325363 * c[..., 1] + 0.0514459929 * c[..., 2])
    m = np.cbrt(0.2119034982 * c[..., 0] + 0.6806995451 * c[..., 1] + 0.1073969566 * c[..., 2])
    s = np.cbrt(0.0883024619 * c[..., 0] + 0.2817188376 * c[..., 1] + 0.6299787005 * c[..., 2])
    return np.stack([0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
                     1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                     0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s], -1)


PAL_LAB = oklab(PAL)


def load_rgba(path, key_tol):
    """RGBA dengan alpha biner. Background magenta (#ff00ff) ikut dianggap transparan."""
    a = np.asarray(Image.open(path).convert("RGBA")).copy()
    rgb = a[..., :3].astype(np.int16)
    magenta = np.abs(rgb - (255, 0, 255)).max(-1) <= key_tol
    a[..., 3] = np.where((a[..., 3] >= 128) & ~magenta, 255, 0)
    return a


def detect_scale(a, max_scale=16):
    """Skala grid terbesar yang membuat hampir semua blok berwarna tunggal (0/None = tidak ada grid)."""
    h, w = a.shape[:2]
    flat = a.reshape(h, w, 4).astype(np.int16)
    for s in range(max_scale, 1, -1):
        if h % s or w % s:
            continue
        b = flat.reshape(h // s, s, w // s, s, 4)
        spread = (b.max((1, 3)) - b.min((1, 3))).max(-1)
        if (spread <= 12).mean() >= 0.97:
            return s
    return 1 if h * w <= 512 * 512 else None


def block_mode(a, out_w, out_h):
    """Perkecil ke out_w x out_h: tiap blok ambil warna yang paling sering muncul."""
    h, w = a.shape[:2]
    ys = np.linspace(0, h, out_h + 1).round().astype(int)
    xs = np.linspace(0, w, out_w + 1).round().astype(int)
    out = np.zeros((out_h, out_w, 4), np.uint8)
    for j in range(out_h):
        for i in range(out_w):
            # buang sepertiga tepi blok supaya garis anti-alias dari tetangga tidak ikut dihitung
            y0, y1, x0, x1 = ys[j], ys[j + 1], xs[i], xs[i + 1]
            my, mx = (y1 - y0) // 6, (x1 - x0) // 6
            blk = a[y0 + my:max(y1 - my, y0 + 1), x0 + mx:max(x1 - mx, x0 + 1)].reshape(-1, 4)
            opaque = blk[blk[:, 3] == 255]
            if len(opaque) * 2 < len(blk):
                continue
            q = (opaque[:, :3] >> 3).astype(np.int32)      # 5 bit per kanal: warna mirip dihitung satu
            keys = q[:, 0] << 10 | q[:, 1] << 5 | q[:, 2]
            top = Counter(keys.tolist()).most_common(1)[0][0]
            out[j, i, :3] = opaque[keys == top][:, :3].mean(0).round()
            out[j, i, 3] = 255
    return out


def quantize(a):
    """Kunci ke palet. Juga kembalikan rata-rata jarak OKLab ke palet (0 = sudah pas palet)."""
    lab = oklab(a[..., :3].astype(np.float32))
    d = ((lab[..., None, :] - PAL_LAB) ** 2).sum(-1)
    idx = d.argmin(-1)
    out = a.copy()
    out[..., :3] = np.where(a[..., 3:] == 255, PAL[idx].astype(np.uint8), 0)
    on = a[..., 3] == 255
    err = float(np.sqrt(d.min(-1))[on].mean()) if on.any() else 0.0
    return out, err


def remove_orphans(a):
    """Piksel tunggal yang beda dari ke-8 tetangganya diganti warna mayoritas tetangga."""
    h, w = a.shape[:2]
    out, n = a.copy(), 0
    key = a[..., 0].astype(np.int32) << 24 | a[..., 1].astype(np.int32) << 16 | a[..., 2].astype(np.int32) << 8 | a[..., 3]
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if a[y, x, 3] == 0:
                continue
            nb = np.delete(key[y - 1:y + 2, x - 1:x + 2].ravel(), 4)
            if (nb != key[y, x]).all():
                top = Counter(nb.tolist()).most_common(1)[0][0]
                v = np.array([top >> 24 & 255, top >> 16 & 255, top >> 8 & 255, top & 255], np.uint8)
                if v[3] == 255:
                    out[y, x] = v
                    n += 1
    return out, n


def add_outline(a):
    on = a[..., 3] == 255
    p = np.pad(on, 1)
    near = p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    ring = near & ~on
    out = a.copy()
    out[ring] = (*OUTLINE, 255)
    return out


def checker(w, h, cell=8):
    y, x = np.mgrid[0:h, 0:w]
    v = np.where(((x // cell + y // cell) & 1) == 0, 30, 44).astype(np.uint8)
    return np.dstack([v, v, v + 10, np.full_like(v, 255)])


def contact_sheet(before, after, path):
    """Kiri: input diperkecil ke ukuran yang sama (bilinear, seperti yang terlihat tanpa P10). Kanan: hasil."""
    w, h = after.shape[1], after.shape[0]
    b = Image.fromarray(before).resize((w, h), Image.BILINEAR)
    pad = 8
    sheet = Image.new("RGBA", (w * ZOOM * 2 + pad * 3, h * ZOOM + pad * 2), (14, 11, 36, 255))
    for k, im in enumerate((b, Image.fromarray(after))):
        big = im.resize((w * ZOOM, h * ZOOM), Image.NEAREST)
        bg = Image.fromarray(checker(w * ZOOM, h * ZOOM))
        bg.alpha_composite(big)
        sheet.paste(bg, (pad + k * (w * ZOOM + pad), pad))
    sheet.save(path, optimize=True)


def colors_of(a):
    op = a[a[..., 3] == 255][:, :3]
    return {tuple(c) for c in op.tolist()}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("images", nargs="+")
    ap.add_argument("--out", default="pixelized", help="folder hasil (default: pixelized/)")
    ap.add_argument("--scale", type=int, help="skala upscale input (default: deteksi otomatis)")
    ap.add_argument("--size", help="ukuran asli WxH, untuk gambar tanpa grid piksel rapi")
    ap.add_argument("--orphans", action="store_true", help="hapus piksel yatim (hati-hati: bisa menghapus LED 1px)")
    ap.add_argument("--outline", action="store_true", help="tambah outline 1px #07051a di tepi luar objek")
    ap.add_argument("--key-tol", type=int, default=40, help="toleransi warna background magenta")
    ap.add_argument("--no-sheet", action="store_true", help="jangan buat contact sheet")
    a = ap.parse_args()

    os.makedirs(a.out, exist_ok=True)
    failed = False
    for path in a.images:
        src = load_rgba(path, a.key_tol)
        h, w = src.shape[:2]
        if a.size:
            ow, oh = map(int, a.size.lower().split("x"))
            how = "--size"
        else:
            s = a.scale or detect_scale(src)
            if not s:
                print(f"{path}: grid piksel tidak terdeteksi ({w}x{h}). Pakai --size WxH atau --scale N.")
                failed = True
                continue
            ow, oh, how = w // s, h // s, f"skala {s}x"
        img = block_mode(src, ow, oh) if (ow, oh) != (w, h) else src
        img, err = quantize(img)
        n_orph = 0
        if a.orphans:
            img, n_orph = remove_orphans(img)
        if a.outline:
            img = add_outline(img)
        name = os.path.splitext(os.path.basename(path))[0]
        out = os.path.join(a.out, name + ".png")
        Image.fromarray(img).save(out, optimize=True)          # tanpa metadata
        if not a.no_sheet:
            contact_sheet(src, img, os.path.join(a.out, name + "-compare.png"))
        n = len(colors_of(img))
        ok = n <= 32
        failed |= not ok
        extra = f", {n_orph} piksel yatim diganti" if a.orphans else ""
        print(f"{'OK  ' if ok else 'GAGAL'} {path}: {w}x{h} -> {ow}x{oh} ({how}), {n} warna{extra} -> {out}")
        if err > ERR_WARN:
            print(f"      PERINGATAN: warnanya jauh dari palet (selisih rata-rata {err:.3f}). Hasilnya akan belang;"
                  " lebih baik minta ulang ke agent gambar dengan ukuran asli dan palet P6.")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
