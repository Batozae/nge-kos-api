const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

// ---------- Koneksi: connection pool, bukan satu koneksi tunggal ----------
// Kredensial WAJIB dari .env (buat user khusus di phpMyAdmin, jangan root
// tanpa sandi). Lihat .env.example untuk daftar variabel yang dibutuhkan.
const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  // Kolom DATETIME/TIMESTAMP dikembalikan sebagai string "YYYY-MM-DD HH:MM:SS"
  // (bukan objek Date JS) -- berjaga-jaga andai suatu saat ada kolom tanggal
  // yang perlu ditampilkan apa adanya di JSON.
  dateStrings: true,
});

// ---------- Skema ----------
// ENGINE=InnoDB wajib ditulis eksplisit supaya ON DELETE CASCADE berfungsi
// (MyISAM tidak mendukung foreign key). Kolom `id AUTO_INCREMENT` baru
// ditambahkan di kost_fasilitas dan favorit sebagai pengganti `rowid`
// bawaan SQLite (MySQL tidak punya rowid implisit) -- dipakai untuk
// menjaga urutan (lihat utils/kost.js dan routes/favorit.js).
const SKEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    CHECK (role IN ('pencari', 'pemilik'))
  ) ENGINE=InnoDB`,

  `CREATE TABLE IF NOT EXISTS kost (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    nama VARCHAR(255) NOT NULL,
    alamat VARCHAR(500) NOT NULL,
    patokan VARCHAR(500),
    maps_url VARCHAR(1000) NOT NULL,
    kategori_penyewa VARCHAR(20) NOT NULL,
    ukuran_kamar VARCHAR(100) NOT NULL,
    jumlah_kamar_total INT NOT NULL,
    jumlah_kamar_kosong INT NOT NULL,
    harga INT NOT NULL,
    image_url VARCHAR(1000),
    whatsapp_number VARCHAR(20) NOT NULL,
    CHECK (kategori_penyewa IN ('putra', 'putri', 'campur')),
    CONSTRAINT fk_kost_owner FOREIGN KEY (owner_id) REFERENCES users(id)
  ) ENGINE=InnoDB`,

  `CREATE TABLE IF NOT EXISTS kost_fasilitas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kost_id INT NOT NULL,
    nama VARCHAR(100) NOT NULL,
    UNIQUE KEY unik_kost_fasilitas (kost_id, nama),
    CONSTRAINT fk_fasilitas_kost FOREIGN KEY (kost_id) REFERENCES kost(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,

  `CREATE TABLE IF NOT EXISTS favorit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    kost_id INT NOT NULL,
    UNIQUE KEY unik_favorit (user_id, kost_id),
    CONSTRAINT fk_favorit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_favorit_kost FOREIGN KEY (kost_id) REFERENCES kost(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,
];

async function buatSkema() {
  for (const sql of SKEMA) {
    await pool.query(sql);
  }
}

// ---------- Seed: hanya berjalan kalau tabel users masih kosong ----------
async function seed() {
  const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM users");
  if (n > 0) return;

  const koneksi = await pool.getConnection();
  try {
    await koneksi.beginTransaction();

    // Akun khusus pengembangan. Jangan dipakai di luar lokal.
    const hash = await bcrypt.hash("password123", 10);

    const [hasilPemilik] = await koneksi.execute(
      "INSERT INTO users (nama, email, password_hash, role) VALUES (?, ?, ?, ?)",
      ["Pemilik Contoh", "pemilik@nge-kos.test", hash, "pemilik"],
    );
    const pemilikId = hasilPemilik.insertId;

    await koneksi.execute(
      "INSERT INTO users (nama, email, password_hash, role) VALUES (?, ?, ?, ?)",
      ["Pencari Contoh", "pencari@nge-kos.test", hash, "pencari"],
    );

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
      const [hasilKost] = await koneksi.execute(
        `INSERT INTO kost (
          owner_id, nama, alamat, patokan, maps_url, kategori_penyewa, ukuran_kamar,
          jumlah_kamar_total, jumlah_kamar_kosong, harga, image_url, whatsapp_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ],
      );
      const kostId = hasilKost.insertId;
      for (const f of k.fasilitas) {
        await koneksi.execute(
          "INSERT INTO kost_fasilitas (kost_id, nama) VALUES (?, ?)",
          [kostId, f],
        );
      }
    }

    await koneksi.commit();
    console.log("Seed selesai: 2 user dan 3 kost ditambahkan.");
  } catch (err) {
    await koneksi.rollback();
    throw err;
  } finally {
    koneksi.release();
  }
}

// index.js menunggu promise ini (await siap) sebelum app.listen, supaya
// server tidak menerima request sebelum tabel & seed selesai dibuat.
const siap = (async () => {
  if (!process.env.DB_NAME || !process.env.DB_USER) {
    throw new Error(
      "DB_HOST/DB_USER/DB_PASSWORD/DB_NAME belum diisi di file .env. Lihat .env.example.",
    );
  }
  await buatSkema();
  await seed();
})();

module.exports = { pool, siap };
