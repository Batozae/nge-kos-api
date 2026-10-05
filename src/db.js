const Database = require("better-sqlite3");
const path = require("path");
const bcrypt = require("bcryptjs");

// File database disimpan di root proyek: nge-kos.db
const db = new Database(path.join(__dirname, "..", "nge-kos.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('pencari', 'pemilik'))
  );

  CREATE TABLE IF NOT EXISTS kost (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    nama TEXT NOT NULL,
    alamat TEXT NOT NULL,
    patokan TEXT,
    maps_url TEXT NOT NULL,
    kategori_penyewa TEXT NOT NULL CHECK (kategori_penyewa IN ('putra', 'putri', 'campur')),
    ukuran_kamar TEXT NOT NULL,
    jumlah_kamar_total INTEGER NOT NULL,
    jumlah_kamar_kosong INTEGER NOT NULL,
    harga INTEGER NOT NULL,
    image_url TEXT,
    whatsapp_number TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS kost_fasilitas (
    kost_id INTEGER NOT NULL REFERENCES kost(id) ON DELETE CASCADE,
    nama TEXT NOT NULL,
    PRIMARY KEY (kost_id, nama)
  );
`);

// ---------- Seed: hanya berjalan kalau tabel users masih kosong ----------
function seed() {
  const jumlahUser = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  if (jumlahUser > 0) return;

  const insertUser = db.prepare(
    "INSERT INTO users (nama, email, password_hash, role) VALUES (?, ?, ?, ?)",
  );
  const insertKost = db.prepare(`
    INSERT INTO kost (
      owner_id, nama, alamat, patokan, maps_url, kategori_penyewa, ukuran_kamar,
      jumlah_kamar_total, jumlah_kamar_kosong, harga, image_url, whatsapp_number
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertFasilitas = db.prepare(
    "INSERT INTO kost_fasilitas (kost_id, nama) VALUES (?, ?)",
  );

  const jalankanSeed = db.transaction(() => {
    // Akun khusus pengembangan. Jangan dipakai di luar lokal.
    const hash = bcrypt.hashSync("password123", 10);
    const pemilikId = insertUser.run(
      "Pemilik Contoh",
      "pemilik@nge-kos.test",
      hash,
      "pemilik",
    ).lastInsertRowid;
    insertUser.run("Pencari Contoh", "pencari@nge-kos.test", hash, "pencari");

    const dataKost = [
      {
        nama: "Kost Melati Asri",
        alamat: "Jl. Ketintang No. 12, Surabaya",
        maps: "https://maps.google.com/?q=-7.322,112.729",
        kategori: "putri",
        ukuran: "3 x 4 m",
        total: 10,
        kosong: 6,
        harga: 850000,
        image: "assets/images/kost_melati.jpg",
        wa: "6281234567890",
        fasilitas: ["WiFi", "AC", "Kamar Mandi Dalam"],
      },
      {
        nama: "Kost Griya Ayu",
        alamat: "Jl. Gebang Putih No. 5, Surabaya",
        maps: "https://maps.google.com/?q=-7.281,112.797",
        kategori: "campur",
        ukuran: "3 x 3 m",
        total: 8,
        kosong: 2,
        harga: 650000,
        image: "assets/images/kost_griya.jpg",
        wa: "6281234567891",
        fasilitas: ["WiFi", "Kamar Mandi Luar"],
      },
      {
        nama: "Kost Anggrek Residence",
        alamat: "Jl. Kertajaya No. 88, Surabaya",
        maps: "https://maps.google.com/?q=-7.278,112.769",
        kategori: "putra",
        ukuran: "4 x 4 m",
        total: 12,
        kosong: 0,
        harga: 1200000,
        image: "assets/images/kost_anggrek.jpg",
        wa: "6281234567892",
        fasilitas: ["WiFi", "AC", "Laundry", "Kamar Mandi Dalam"],
      },
    ];

    for (const k of dataKost) {
      const kostId = insertKost.run(
        pemilikId,
        k.nama,
        k.alamat,
        null,
        k.maps,
        k.kategori,
        k.ukuran,
        k.total,
        k.kosong,
        k.harga,
        k.image,
        k.wa,
      ).lastInsertRowid;
      for (const f of k.fasilitas) insertFasilitas.run(kostId, f);
    }
  });

  jalankanSeed();
  console.log("Seed selesai: 2 user dan 3 kost ditambahkan.");
}

seed();

module.exports = db;
