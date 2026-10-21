# Sprite kru arah diagonal (isometrik)

Kota Neo HQ itu isometrik, jadi kru selalu jalan miring ke salah satu dari empat arah: kanan-bawah, kiri-bawah, kanan-atas, atau kiri-atas. Sekarang `js/neohq.js` masih memakai frame jalan samping (`walk`) dan jalan belakang (`back`) dari `*_kairo.png`, lalu mencerminkannya untuk arah kiri. Hasilnya sudah jalan, tapi badan kru terlihat menyamping, belum menghadap diagonal.

Dokumen ini menjelaskan sheet baru yang perlu dibuat dengan generator gambar, lalu cara memasangnya.

## Yang dibutuhkan per kru

Cukup dua arah. Dua arah lainnya didapat dengan dicerminkan di kode.

| Urutan | Arah hadap | Frame | Dipakai saat |
|---|---|---|---|
| `walkd` | 3/4 depan, menghadap kanan-bawah | 6 | jalan ke kanan-bawah (dan ke kiri-bawah, dicerminkan) |
| `backd` | 3/4 belakang, menghadap kanan-atas | 4 sampai 6 | jalan ke kanan-atas (dan ke kiri-atas, dicerminkan) |

Ketentuan supaya cocok dengan pipeline di `tools/`:

- Latar **magenta polos `#FF00FF`**, tanpa bayangan di lantai dan tanpa gradasi.
- Semua frame dalam **satu baris**, diberi jarak kosong yang jelas antar-frame (pemotongnya pakai celah kolom, lihat `items()` di `tools/anim_extract.py`).
- Satu siklus jalan yang mulus: kaki kiri depan, tengah, kaki kanan depan, tengah.
- Ukuran karakter, warna zirah, dan wajah **sama persis** dengan sheet `*_kairo.png` yang sekarang (sertakan sheet lama sebagai gambar acuan di generator).
- Tinggi karakter sekitar 80 px setelah diperkecil. Di generator, buat sekitar 4 sampai 8 kali lebih besar.

## Prompt contoh (ganti bagian dalam kurung)

> 16-bit SNES-style chibi robot hunter sprite sheet, single row of 6 walking frames, character facing three-quarter front toward the bottom-right (isometric diagonal), full body, same character as the reference image: [deskripsi dari LOOKS di js/agents.js, misalnya "red and white armor, transparent cyan visor, black side-parted hair, holding a tablet"]. Clean pixel art, 16-colour palette, dark outline, flat solid magenta #FF00FF background, even spacing between frames, no ground shadow, no text.

Untuk `backd`, ganti "three-quarter front toward the bottom-right" dengan "three-quarter back view walking away toward the top-right", lalu ganti 6 frame jadi 4.

Deskripsi tiap kru ada di `LOOKS` di `js/agents.js`: nerd, makelar, alcapone, sisotoy, kuku, kurir, jack.

## Cara memasang

1. Simpan hasil generator ke folder raw pipeline (`anim/raw/`), misalnya `nerd_walkd.png` dan `nerd_backd.png`.
2. Jalankan pipeline seperti waktu membuat `*_kairo.png`, yaitu `tools/anim_extract.py` lalu `tools/anim_build.py`, dengan dua urutan baru ditambahkan di `TICKS`/`LOOP` (misalnya `walkd: 4`, `backd: 5`, keduanya loop). Frame-nya akan masuk ke `assets/sprites/<id>_kairo.png`, dan `assets/sprites/kairo.json` mendapat `seq.walkd`, `seq.backd`, `ticks.walkd`, dan `ticks.backd`.
3. Kode tidak perlu diubah. `frameOf()` di `js/neohq.js` otomatis memakai `walkd`/`backd` kalau ada di `kairo.json`, dan kembali ke `walk`/`back` kalau tidak ada. Kru boleh diganti satu per satu.
