# Nge-Kos API

Backend REST API untuk aplikasi Nge-Kos (Express + MySQL/MariaDB via XAMPP).

> Migrasi dari SQLite ke MySQL (Tugas #1, lihat dokumen 3 — Integrasi REST API,
> bagian 8). **Kontrak API tidak berubah sama sekali**; Flutter tidak perlu
> disentuh.

## Menyiapkan MySQL (XAMPP + phpMyAdmin)

1. Jalankan **Apache** dan **MySQL** dari XAMPP Control Panel.
2. Buka `http://localhost/phpmyadmin`.
3. Buat database baru, misalnya `nge_kos` (collation bebas, `utf8mb4_general_ci` disarankan).
4. Buat **user MySQL khusus** untuk aplikasi ini (jangan pakai `root` tanpa sandi):
   - Tab **User accounts** → **Add user account**.
   - Isi username (misal `nge_kos_app`) dan sandi.
   - Beri hak akses penuh (`GRANT ALL PRIVILEGES`) khusus ke database `nge_kos`, bukan ke semua database.
5. Catat host (biasanya `127.0.0.1`), port (biasanya `3306`), nama database, username, dan sandi — semua ini masuk ke `.env` di langkah berikutnya.

## Menjalankan

1. `npm install`
2. Salin `.env.example` menjadi `.env` (di Windows: `copy .env.example .env`), lalu isi:
   - `JWT_SECRET` dengan teks acak yang panjang (minimal 32 karakter)
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` sesuai yang dibuat di phpMyAdmin
3. `npm run dev` — server berjalan di http://localhost:3000 (cek: http://localhost:3000/health)

Tabel dan data contoh dibuat otomatis saat server pertama kali jalan (hanya
jika tabel `users` masih kosong). **Reset data:** hentikan server, hapus
semua tabel lewat phpMyAdmin (atau `DROP DATABASE nge_kos; CREATE DATABASE
nge_kos;`), jalankan server lagi.

## Akun uji (khusus lokal)

- pemilik@nge-kos.test / password123
- pencari@nge-kos.test / password123

## Dokumentasi

Kontrak API: `docs/API_CONTRACT.md` (tidak berubah oleh migrasi ini).

## Catatan migrasi SQLite → MySQL

- Semua akses database sekarang **async** (`mysql2/promise`, connection pool).
- `rowid` bawaan SQLite tidak ada di MySQL: tabel `kost_fasilitas` dan
  `favorit` mendapat kolom `id AUTO_INCREMENT` baru sebagai penggantinya,
  dipakai untuk urutan fasilitas dan urutan favorit (terbaru di atas).
- `POST`/`PUT /kost` dan seed memakai transaksi lewat koneksi dari pool
  (`beginTransaction`/`commit`/`rollback`), bukan `db.transaction()` gaya
  better-sqlite3.
- Constraint email ganda sekarang terbaca lewat kode error MySQL
  `ER_DUP_ENTRY` (sebelumnya `SQLITE_CONSTRAINT_UNIQUE`).
- **Belum sempat diuji dengan server MySQL sungguhan** di sesi migrasi ini
  (lingkungan pengerjaan tidak punya MySQL terpasang). Yang sudah diverifikasi:
  seluruh file lolos `node --check` (sintaks) dan `require(...)` semuanya
  berhasil (dicoba jalan dengan `.env` dummy — server gagal connect ke MySQL
  dengan pesan error yang rapi, bukan crash). **Wajib** jalankan ulang seluruh
  suite regresi di dokumen 3 bagian 9 terhadap MySQL sungguhan sebelum
  menganggap migrasi ini selesai.
