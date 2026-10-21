/* Data agent buat Robot HQ 2D (villagemegax). Disalin dari array AGENTS di ../index.html (nama, judul, warna, kalimat).
   Kalau nambah/ubah agent di dashboard, samain juga di sini. */
export const AGENTS = [
  { id:"nerd", name:"nerd", title:"si paling science", gender:"m", accent:"#ff7a8a",
    work:"wave", emotes:{work:"</>", idle:"♥"},
    lines:["Ada bug? Sini aku bedah!","Kopi dulu, baru debug.","Test merah? Tenang, kita ijoin.","Commit kecil, pesannya jelas ya!","Hmm… kayaknya race condition.","Lagi compile ide nih…"] },
  { id:"makelar", name:"makelar", title:"my quant", gender:"f", accent:"#ffaa55",
    work:"action", emotes:{work:"$", idle:"$"},
    lines:["Harga segini? Nego dikit lah.","Data dulu, baru deal.","Risiko udah aku hitung, aman.","Grafiknya cakep, cuan nih.","Win-win, semua senyum."] },
  { id:"alcapone", name:"Alcapone", title:"Alpha", gender:"m", accent:"#b48cff",
    work:"action", emotes:{work:"♠", idle:"…"},
    lines:["Tenang. Semua udah aku atur.","Kerjaan beres dulu, baru ngopi.","Alpha nggak pernah panik.","Rapi, cepat, tuntas.","Markas aman terkendali."] },
  { id:"sisotoy", name:"el sotoy", title:"ngide", gender:"m", accent:"#ffd447",
    work:"action", emotes:{work:"!!", idle:"!?"},
    lines:["Eh, aku ada ide!","Percaya deh, ini pasti jalan.","Ide nomor 37 hari ini!","Bukan sotoy, cuma visioner.","Brainstorm dulu, mikir belakangan."] },
  { id:"kuku", name:"kuku", title:"sosmed specialist", gender:"f", accent:"#4fe3c8",
    work:"action", emotes:{work:"♪", idle:"♥"},
    lines:["Kuku! Senyum, cekrek!","Caption udah siap, tinggal posting.","Konten hari ini: markas kita!","Trending? Gampang itu.","Bikin story dulu ah."] },
  { id:"kurir", name:"Kurir", title:"kang pos", gender:"f", accent:"#c88bff",
    work:"action", emotes:{work:"✉", idle:"✉"},
    lines:["Paket lowongan datang!","Kang pos lewat, permisi~","Surat buat kamu, isinya peluang!","CV udah siap belum?","Hujan badai tetap aku anter."] },
  { id:"jack", name:"bang jack", title:"random knowledge", gender:"m", accent:"#9fb3c8",
    work:"action", emotes:{work:"#", idle:"♪"},
    lines:["Tau nggak? Gurita punya tiga jantung.","Madu nggak bisa basi, lho.","Pisang itu termasuk buah beri.","Sini, apa yang rusak? Aku benerin.","Hiu udah ada sebelum pohon."] },
];
/* Sprite 16-bit asli (AI-generated, gaya Mega Man X tapi desain orisinal), lihat assets/sprites + credits.html */
export const LOOKS = {
  nerd:     "zirah merah-putih, visor cyan transparan, rambut hitam belah pinggir, bawa tablet",
  makelar:  "zirah oranye-putih, headset + mic, rambut panjang auburn, bawa gulungan kontrak",
  alcapone: "zirah ungu, helm crest dengan sirip emas & tanduk, bahu bulat besar, sabuk emas",
  sisotoy:  "zirah kuning, helm bulat dengan antena bola nyala, telunjuk 'aku ada ide!'",
  kuku:     "zirah teal, rambut cepol, headset kuping kucing, burung robot kecil di kepala, bawa HP",
  kurir:    "zirah violet, topi bersayap, tas kurir + amplop (siap antar lowongan)",
  jack:     "zirah biru baja, bahu oranye, goggles, jenggot, kunci inggris di tangan",
};
