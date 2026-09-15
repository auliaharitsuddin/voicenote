// One-off seed: demo notes to show off the history list's motion (staggered entrance,
// idle float, spotlight-tilt press, expand/collapse layout transition). Run once:
//   node seed-demo-notes.mjs
import { randomUUID } from 'node:crypto';
import { db } from './db.mjs';

const insert = db.prepare(
  'INSERT INTO notes (id, created_at, duration_ms, transcript, title, summary, actions) VALUES (?, ?, ?, ?, ?, ?, ?)'
);

const demo = [
  {
    ageMin: 4,
    duration_ms: 47_000,
    title: 'Rencana rilis fitur pengingat',
    summary: 'Bahas urutan rilis fitur pengingat otomatis: sinkron email dulu, baru notifikasi lokal, target akhir minggu ini.',
    transcript: 'Oke jadi untuk fitur pengingat otomatis ini kita mulai dari sinkronisasi email dulu ya, itu yang paling krusial. Setelah email bisa kebaca dan event ke-detect, baru kita kerjain notifikasi lokalnya. Targetnya akhir minggu ini udah bisa demo ke tim, minimal untuk Zoom sama Google Meet dulu, Teams belakangan gak apa-apa.',
    actions: ['Selesaikan parser email untuk Zoom & Google Meet', 'Uji notifikasi lokal di Android dan iOS', 'Siapkan demo untuk tim akhir minggu ini'],
  },
  {
    ageMin: 55,
    duration_ms: 18_000,
    title: 'Ide desain orb suara',
    summary: 'Orb visual saat merekam sebaiknya bereaksi ke volume suara, bukan cuma nyala-mati statis.',
    transcript: 'Buat orb yang muncul waktu lagi ngerekam, enaknya dia bereaksi ke volume suara beneran, jadi kelihatan hidup. Kalau cuma nyala-mati doang kurang nendang.',
    actions: ['Riset library visualisasi audio real-time'],
  },
  {
    ageMin: 130,
    duration_ms: 132_000,
    title: 'Catatan rapat evaluasi mingguan',
    summary: 'Evaluasi progres minggu ini: backend stabil, tinggal polish UI. Ada tiga tindak lanjut untuk minggu depan.',
    transcript: 'Jadi rekap evaluasi minggu ini, dari sisi backend udah cukup stabil, transkripsi jalan lancar pakai Groq, sinkron email juga udah kedeteksi dengan baik. Yang masih perlu banyak polish itu di sisi UI, terutama konsistensi animasi antar layar. Untuk minggu depan ada tiga hal yang perlu difollow up: pertama, testing di perangkat Android low-end biar tau performanya gimana. Kedua, tambahin dark mode testing yang lebih menyeluruh. Ketiga, coba kumpulin feedback dari dua atau tiga user beta sebelum kita lanjut ke fitur berikutnya.',
    actions: [
      'Testing performa di Android low-end',
      'Audit dark mode di semua layar',
      'Kumpulkan feedback dari 2-3 user beta',
      'Rapikan dokumentasi API server',
    ],
  },
  {
    ageMin: 320,
    duration_ms: 9_000,
    title: 'Pengingat beli kopi',
    summary: 'Jangan lupa beli kopi sebelum toko tutup.',
    transcript: 'Eh jangan lupa beli kopi ya nanti sore, sebelum toko dekat rumah tutup jam 9.',
    actions: [],
  },
  {
    ageMin: 1_500,
    duration_ms: 61_000,
    title: 'Brainstorm nama fitur baru',
    summary: 'Diskusi penamaan fitur ringkasan otomatis, mengarah ke nama yang singkat dan mudah diingat.',
    transcript: 'Untuk fitur ringkasan otomatis ini kita perlu nama yang catchy tapi tetap jelas fungsinya. Beberapa opsi yang muncul: Ringkas, Inti Bicara, sama Rekap Cepat. Kayaknya yang paling gampang diingat itu Ringkas aja, pendek dan langsung nyambung ke fungsinya.',
    actions: ['Voting nama fitur dengan tim', 'Update copy di halaman pengaturan'],
  },
];

for (const n of demo) {
  const created = new Date(Date.now() - n.ageMin * 60_000).toISOString();
  insert.run(randomUUID(), created, n.duration_ms, n.transcript, n.title, n.summary, JSON.stringify(n.actions));
}

console.log(`Seeded ${demo.length} demo notes.`);
