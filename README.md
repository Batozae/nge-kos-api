# Nge-Kos API

Backend REST API untuk aplikasi Nge-Kos (Express + SQLite).

## Menjalankan

1. `npm install`
2. Salin `.env.example` menjadi `.env` (di Windows: `copy .env.example .env`), lalu isi `JWT_SECRET` dengan teks acak yang panjang
3. `npm run dev`, server berjalan di http://localhost:3000 (cek: http://localhost:3000/health)

Database `nge-kos.db` dibuat otomatis beserta data contoh. Untuk mengulang dari awal: hentikan server, hapus `nge-kos.db`, jalankan lagi.

## Akun uji (khusus lokal)

- pemilik@nge-kos.test / password123
- pencari@nge-kos.test / password123

## Dokumentasi

Kontrak API: `docs/API_CONTRACT.md`
