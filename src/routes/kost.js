const express = require("express");
const db = require("../db");
const { kirimError } = require("../utils/http");
const {
  formatDaftarKost,
  validasiKost,
  ambilKostById,
} = require("../utils/kost");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const STATUS_VALID = ["tersedia", "hampir_penuh", "penuh"];

// Daftar urutan yang diizinkan. Teks ORDER BY HANYA boleh berasal dari sini.
const URUTAN = {
  harga_asc: "harga ASC",
  harga_desc: "harga DESC",
};

// Ambil query string sebagai teks; abaikan jika kosong atau bukan teks
function teks(nilai) {
  if (typeof nilai !== "string") return undefined;
  const bersih = nilai.trim();
  return bersih === "" ? undefined : bersih;
}

// GET /kost
router.get("/", (req, res) => {
  const q = teks(req.query.q);
  const area = teks(req.query.area);
  const hargaMin = teks(req.query.hargaMin);
  const hargaMax = teks(req.query.hargaMax);
  const fasilitas = teks(req.query.fasilitas);
  const status = teks(req.query.status);
  const sort = teks(req.query.sort);

  // ---- Validasi ----
  if (hargaMin !== undefined && !/^\d+$/.test(hargaMin)) {
    return kirimError(
      res,
      400,
      "VALIDATION_ERROR",
      "hargaMin harus berupa angka bulat",
    );
  }
  if (hargaMax !== undefined && !/^\d+$/.test(hargaMax)) {
    return kirimError(
      res,
      400,
      "VALIDATION_ERROR",
      "hargaMax harus berupa angka bulat",
    );
  }
  if (status !== undefined && !STATUS_VALID.includes(status)) {
    return kirimError(
      res,
      400,
      "VALIDATION_ERROR",
      `status harus salah satu dari: ${STATUS_VALID.join(", ")}`,
    );
  }
  if (sort !== undefined && !URUTAN[sort]) {
    return kirimError(
      res,
      400,
      "VALIDATION_ERROR",
      `sort harus salah satu dari: ${Object.keys(URUTAN).join(", ")}`,
    );
  }

  // ---- Susun query: potongan SQL ditulis oleh kita, nilai dari pengguna lewat params ----
  const where = [];
  const params = [];

  if (q) {
    where.push("(nama LIKE ? OR alamat LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  if (area) {
    where.push("alamat LIKE ?");
    params.push(`%${area}%`);
  }
  if (hargaMin !== undefined) {
    where.push("harga >= ?");
    params.push(Number(hargaMin));
  }
  if (hargaMax !== undefined) {
    where.push("harga <= ?");
    params.push(Number(hargaMax));
  }
  if (fasilitas) {
    // Semua fasilitas yang diminta harus dimiliki kost (AND), tanpa peduli huruf besar/kecil
    const daftar = [
      ...new Set(
        fasilitas
          .split(",")
          .map((f) => f.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (daftar.length > 0) {
      const placeholders = daftar.map(() => "?").join(",");
      where.push(`(
        SELECT COUNT(*) FROM kost_fasilitas f
        WHERE f.kost_id = kost.id AND LOWER(f.nama) IN (${placeholders})
      ) = ?`);
      params.push(...daftar, daftar.length);
    }
  }

  const orderBy = sort ? URUTAN[sort] : "id ASC";
  const sql = `SELECT * FROM kost
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY ${orderBy}`;

  const rows = db.prepare(sql).all(...params);
  let data = formatDaftarKost(rows);

  // Status dihitung di kode (bukan disimpan), jadi disaring di sini agar aturannya tetap satu tempat
  if (status) data = data.filter((k) => k.status === status);

  res.json({ data, total: data.length });
});

// GET /kost/:id
router.get("/:id", (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) {
    return kirimError(res, 404, "NOT_FOUND", "Kost tidak ditemukan");
  }

  const row = db.prepare("SELECT * FROM kost WHERE id = ?").get(Number(id));
  if (!row) {
    return kirimError(res, 404, "NOT_FOUND", "Kost tidak ditemukan");
  }

  res.json({ data: formatDaftarKost([row])[0] });
});

// ---------- Endpoint khusus pemilik ----------

// Dipakai PUT dan DELETE: kost harus ada dan milik pemilik yang sedang login.
// Mengembalikan baris kost, atau null setelah mengirim error sendiri.
function ambilKostMilik(req, res) {
  const { id } = req.params;
  const row = /^\d+$/.test(id)
    ? db.prepare("SELECT * FROM kost WHERE id = ?").get(Number(id))
    : undefined;

  if (!row) {
    kirimError(res, 404, "NOT_FOUND", "Kost tidak ditemukan");
    return null;
  }
  if (row.owner_id !== req.user.id) {
    kirimError(res, 403, "FORBIDDEN", "Kost ini bukan milik Anda");
    return null;
  }
  return row;
}

function simpanFasilitas(kostId, daftar) {
  const stmt = db.prepare(
    "INSERT INTO kost_fasilitas (kost_id, nama) VALUES (?, ?)",
  );
  for (const nama of daftar) stmt.run(kostId, nama);
}

// POST /kost
router.post("/", requireAuth, requireRole("pemilik"), (req, res) => {
  const hasil = validasiKost(req.body);
  if (hasil.error) return kirimError(res, 400, "VALIDATION_ERROR", hasil.error);
  const k = hasil.nilai;

  const buat = db.transaction(() => {
    const kostId = db
      .prepare(
        `
        INSERT INTO kost (
          owner_id, nama, alamat, patokan, maps_url, kategori_penyewa, ukuran_kamar,
          jumlah_kamar_total, jumlah_kamar_kosong, harga, image_url, whatsapp_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        req.user.id,
        k.nama,
        k.alamat,
        k.patokan,
        k.mapsUrl,
        k.kategoriPenyewa,
        k.ukuranKamar,
        k.jumlahKamarTotal,
        k.jumlahKamarKosong,
        k.harga,
        k.imageUrl,
        k.whatsappNumber,
      ).lastInsertRowid;
    simpanFasilitas(kostId, k.fasilitas);
    return Number(kostId);
  });

  res.status(201).json({ data: ambilKostById(buat()) });
});

// PUT /kost/:id  (mengganti seluruh data listing)
router.put("/:id", requireAuth, requireRole("pemilik"), (req, res) => {
  const row = ambilKostMilik(req, res);
  if (!row) return;

  const hasil = validasiKost(req.body);
  if (hasil.error) return kirimError(res, 400, "VALIDATION_ERROR", hasil.error);
  const k = hasil.nilai;

  db.transaction(() => {
    db.prepare(
      `
      UPDATE kost SET
        nama = ?, alamat = ?, patokan = ?, maps_url = ?, kategori_penyewa = ?,
        ukuran_kamar = ?, jumlah_kamar_total = ?, jumlah_kamar_kosong = ?,
        harga = ?, image_url = ?, whatsapp_number = ?
      WHERE id = ?
    `,
    ).run(
      k.nama,
      k.alamat,
      k.patokan,
      k.mapsUrl,
      k.kategoriPenyewa,
      k.ukuranKamar,
      k.jumlahKamarTotal,
      k.jumlahKamarKosong,
      k.harga,
      k.imageUrl,
      k.whatsappNumber,
      row.id,
    );
    db.prepare("DELETE FROM kost_fasilitas WHERE kost_id = ?").run(row.id);
    simpanFasilitas(row.id, k.fasilitas);
  })();

  res.json({ data: ambilKostById(row.id) });
});

// DELETE /kost/:id
router.delete("/:id", requireAuth, requireRole("pemilik"), (req, res) => {
  const row = ambilKostMilik(req, res);
  if (!row) return;

  db.prepare("DELETE FROM kost WHERE id = ?").run(row.id); // fasilitas ikut terhapus (CASCADE)
  res.status(204).send();
});

module.exports = router;
