/* Data agent buat Robot HQ 2D (villagemegax). Sumber utama data agent (nama, judul, warna, kalimat) sejak Robot HQ jadi halaman root.
   ID harus sama dengan kunci "agents" di status.json.
   chatId = id agent di aplikasi Grok Bot desktop; tombol "Chat" di dialog NPC membuka grokbot://app/v1/agent?id=<chatId>. */
export const AGENTS = [
  { id:"nerd", chatId:"cc6e0909-6b74-413f-b657-fa0fedd00cae", name:"nerd", title:"si paling science", gender:"m", accent:"#ff7a8a",
    work:"wave", emotes:{work:"</>", idle:"♥"},
    lines:["Ada bug? Sini aku bedah!","Kopi dulu, baru debug.","Test merah? Tenang, kita ijoin.","Commit kecil, pesannya jelas ya!","Hmm… kayaknya race condition.","Lagi compile ide nih…"] },
  { id:"makelar", chatId:"4b9ac851-2160-48b6-9962-f4c9fa305133", name:"makelar", title:"my quant", gender:"f", accent:"#ffaa55",
    work:"action", emotes:{work:"$", idle:"$"},
    lines:["Harga segini? Nego dikit lah.","Data dulu, baru deal.","Risiko udah aku hitung, aman.","Grafiknya cakep, cuan nih.","Win-win, semua senyum."] },
  { id:"alcapone", chatId:"7bb34c58-76f3-4f59-ab4b-48d396e81e6e", name:"Alcapone", title:"Alpha", gender:"m", accent:"#38c8ff",
    work:"action", emotes:{work:"♠", idle:"…"},
    lines:["Tenang. Semua udah aku atur.","Kerjaan beres dulu, baru ngopi.","Alpha nggak pernah panik.","Rapi, cepat, tuntas.","Markas aman terkendali."] },
  { id:"sisotoy", chatId:"81d79561-02ac-4235-9729-52e0f6036254", name:"el sotoy", title:"ngide", gender:"m", accent:"#ffd447",
    work:"action", emotes:{work:"!!", idle:"!?"},
    lines:["Eh, aku ada ide!","Percaya deh, ini pasti jalan.","Ide nomor 37 hari ini!","Bukan sotoy, cuma visioner.","Brainstorm dulu, mikir belakangan."] },
  { id:"kuku", chatId:"8a669244-2319-46f5-a720-dd210eaefa0b", name:"kuku", title:"sosmed specialist", gender:"f", accent:"#4fe3c8",
    work:"action", emotes:{work:"♪", idle:"♥"},
    lines:["Kuku! Senyum, cekrek!","Caption udah siap, tinggal posting.","Konten hari ini: markas kita!","Trending? Gampang itu.","Bikin story dulu ah."] },
  { id:"kurir", chatId:"e805653f-bbc6-4384-8273-6250a277d2eb", name:"Kurir", title:"kang pos", gender:"f", accent:"#c88bff",
    work:"action", emotes:{work:"✉", idle:"✉"},
    lines:["Paket lowongan datang!","Kang pos lewat, permisi~","Surat buat kamu, isinya peluang!","CV udah siap belum?","Hujan badai tetap aku anter."] },
  { id:"jack", chatId:"edbe6eb5-9a50-4dd1-8bf2-92fc4ee79f06", name:"bang jack", title:"random knowledge", gender:"m", accent:"#9fb3c8",
    work:"action", emotes:{work:"#", idle:"♪"},
    lines:["Tau nggak? Gurita punya tiga jantung.","Madu nggak bisa basi, lho.","Pisang itu termasuk buah beri.","Sini, apa yang rusak? Aku benerin.","Hiu udah ada sebelum pohon."] },
];
/* Sprite 16-bit asli (AI-generated, gaya Mega Man X tapi desain orisinal), lihat assets/sprites + credits.html */
export const LOOKS = {
  nerd:     "zirah merah-putih, visor cyan transparan, rambut hitam belah pinggir, bawa tablet",
  makelar:  "zirah oranye-putih, headset + mic, rambut panjang auburn, bawa gulungan kontrak",
  alcapone: "zirah putih mutiara dengan trim emas & aksen biru es (permata helm, inti dada menyala, garis cahaya di bahu & sepatu bot), helm crest dengan sirip emas & tanduk, bahu bulat besar, sabuk emas, bodysuit hitam arang, rambut panjang pirang keemasan dikuncir besar yang berayun dari belakang helm",
  sisotoy:  "zirah kuning, helm bulat dengan antena bola nyala, telunjuk 'aku ada ide!'",
  kuku:     "zirah teal, rambut cepol, headset kuping kucing, burung robot kecil di kepala, bawa HP",
  kurir:    "zirah violet, topi bersayap, tas kurir + amplop (siap antar lowongan)",
  jack:     "zirah biru baja, bahu oranye, goggles, jenggot, kunci inggris di tangan",
};
