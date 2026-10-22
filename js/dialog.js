/* Isi dialog NPC Neo HQ (klik kru → kotak dialog ala game). Edit bebas di sini.
   - status: kalimat pertama, diisi dari data live (status.json + summaries.json).
       {task} = ringkasan tugas, {ago} = terakhir aktif ("3 jam lalu"). Kerja tanpa ringkasan pakai "workNoTask";
       standby yang punya ringkasan ditambah "lastTask". Kunci yang tidak ada di agent pakai DEFAULT_STATUS.
   - lines: kalimat bebas sesuai karakter; tiap klik diambil acak 2–4 baris, jadi totalnya 3–5 baris.
   - Hindari karakter "~" (font pixel-nya nggak punya). Satu baris sebaiknya ≤ ±110 huruf biar muat di kotak dialog HP. */
export const DEFAULT_STATUS = {
  work:       "Lagi ngerjain ini nih: {task}. Bentar ya!",
  workNoTask: "Lagi ada misi di Command Center. Bentar ya!",
  idle:       "Lagi standby nih. Terakhir aktif {ago}. Ada yang bisa dibantu?",
  lastTask:   "Terakhir ngerjain: {task}.",
  sleep:      "Zzz… lagi ngecas di kapsul. Panggil lagi nanti, ya.",
};

export const DIALOG = {
  nerd: {
    status: {
      work: "Lagi ngoding: {task}. Jangan ganggu stack trace-ku dulu, ya!",
      idle: "Lagi standby nih. Ada bug yang perlu dibedah? Terakhir aktif {ago}.",
    },
    lines: [
      "Aku si paling science di markas. Kalau ada kode yang ngambek, panggil aja aku.",
      "Prinsipku: test dulu, baru percaya. Hijau semua? Baru boleh senyum.",
      "Commit kecil-kecil, pesannya jelas. Masa depanmu bakal berterima kasih.",
      "Kopi dulu, baru debug. Urutannya nggak bisa ditawar.",
      "Bug itu bukan musuh. Dia cuma petunjuk yang belum kita pahami.",
      "Kalau error-nya aneh banget, biasanya sih race condition… atau typo.",
      "Markas Neo HQ ini juga aku yang ngerakit, lho. Lumayan, kan?",
    ],
  },
  makelar: {
    status: {
      work: "Lagi ngitung angka: {task}. Data dulu, baru deal.",
      idle: "Lagi standby. Pasar lagi sepi, tapi aku tetap pantau grafiknya.",
    },
    lines: [
      "Aku quant-nya markas. Angka, harga, risiko… semua aku timbang dulu.",
      "Harga segitu? Boleh dong nego dikit. Semua bisa dibicarakan.",
      "Deal yang bagus itu yang bikin dua pihak pulang senyum.",
      "Jangan FOMO, ya. Rencana dulu, eksekusi kemudian.",
      "Risikonya udah aku hitung. Tenang, masih di batas aman.",
      "Kontrak ini baca dulu sampai habis. Huruf kecil itu sering paling mahal.",
    ],
  },
  alcapone: {
    status: {
      work: "Sedang kutangani: {task}. Tenang, semua terkendali.",
      idle: "Standby. Komputerku siap kapan pun kamu butuh tenaga tambahan.",
    },
    lines: [
      "Aku punya komputer sendiri. Kerjaan berat? Serahkan padaku.",
      "Alpha nggak pernah panik. Kita kerjakan satu per satu.",
      "Rapi, cepat, tuntas. Itu standarku.",
      "Kalau piringmu penuh, oper saja sebagian ke aku.",
      "Rencana minggu ini sudah kususun. Tinggal jalankan.",
      "Markas aman terkendali. Kamu fokus ke yang penting aja.",
    ],
  },
  sisotoy: {
    status: {
      work: "Lagi sibuk: {task}. Dan ya, aku udah tahu jawabannya, hehe.",
      idle: "Lagi standby. Tapi otakku tetap jalan, ide nomor 38 lagi loading!",
    },
    lines: [
      "Eh, aku ada ide! Dengerin dulu, ini pasti jalan.",
      "Bukan sotoy, cuma visioner. Beda tipis, kok.",
      "Tanya apa aja ke aku. Kalau nggak tahu… ya aku tebak dengan yakin.",
      "Brainstorm dulu, mikir belakangan. Eh, kebalik ya?",
      "Fun fact versi aku: semua masalah bisa diselesaikan dengan ide yang cukup nekat.",
      "Percaya deh, aku udah kepikiran ini dari kemarin.",
      "Antena di helmku ini nyala tiap ada ide. Sekarang nyala terus, kan?",
    ],
  },
  kuku: {
    status: {
      work: "Lagi bikin konten: {task}. Senyum dulu, cekrek!",
      idle: "Lagi standby. Draft caption udah numpuk, tinggal pilih yang paling kece.",
    },
    lines: [
      "Hai! Aku kuku, yang ngurus sosmed markas. Burung kecil ini partnerku.",
      "Konten bagus itu jujur, ringan, dan tepat waktu.",
      "Mau naik trending? Kuncinya konsisten, bukan cuma viral sekali.",
      "Jangan lupa: baca komentar itu penting, tapi jangan dimasukin hati semua.",
      "Story hari ini: suasana Neo HQ waktu hujan. Estetik banget!",
      "Kuku! …Eh, itu bukan aku, itu burungku yang nyapa.",
    ],
  },
  kurir: {
    status: {
      work: "Lagi antar: {task}. Kang pos lewat, permisi!",
      idle: "Lagi standby. Tas kurirku kosong, siap antar lamaran berikutnya!",
    },
    lines: [
      "Aku Kurir, kang pos markas. Lowongan, formulir, lamaran, semua lewat aku.",
      "CV-mu udah paling baru belum? Biar aku antar yang terbaik.",
      "Formulir panjang? Tenang, aku isi dengan teliti, tapi tetap minta izin kamu dulu.",
      "Hujan badai pun tetap aku antar. Asal alamatnya jelas, ya.",
      "Paket lowongan baru datang! Mau aku pilihkan yang cocok?",
      "Tips dariku: satu lamaran yang rapi lebih kuat daripada sepuluh yang asal.",
    ],
  },
  jack: {
    status: {
      work: "Lagi ngulik: {task}. Sini, sekalian aku kasih fakta unik.",
      idle: "Lagi standby. Tanya apa aja, dari resep sampai reparasi!",
    },
    lines: [
      "Aku bang jack, serba bisa. Pertanyaan random? Itu spesialisasiku.",
      "Tau nggak? Gurita punya tiga jantung.",
      "Madu nggak bisa basi, lho. Pernah ditemukan madu di makam kuno yang masih bisa dimakan.",
      "Pisang itu secara botani termasuk buah beri. Stroberi malah bukan.",
      "Ada yang rusak? Bawa sini, kunci inggris ini selalu siap.",
      "Hiu udah ada di bumi sebelum ada pohon. Keren, kan?",
    ],
  },
};
