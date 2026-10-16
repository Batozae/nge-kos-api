const { pool } = require("../db");

// Satu-satunya tempat aturan status didefinisikan.
// kosong = 0 -> penuh; kosong <= 25% dari total -> hampir_penuh; selain itu -> tersedia
function hitungStatus(total, kosong) {
  if (kosong <= 0) return "penuh";
  if (kosong * 4 <= total) return "hampir_penuh";
  return "tersedia";
}

function formatKost(row, fasilitas) {
  return {
    id: String(row.id),
    nama: row.nama,
    alamat: row.alamat,
    patokan: row.patokan,
    mapsUrl: row.maps_url,
    kategoriPenyewa: row.kategori_penyewa,
    ukuranKamar: row.ukuran_kamar,
    jumlahKamarTotal: row.jumlah_kamar_total,
    jumlahKamarKosong: row.jumlah_kamar_kosong,
    harga: row.harga,
    fasilitas,
    imageUrl: row.image_url,
    whatsappNumber: row.whatsapp_number,
    status: hitungStatus(row.jumlah_kamar_total, row.jumlah_kamar_kosong),
  };
}

// Mengambil fasilitas untuk banyak kost sekaligus (satu query, bukan satu per kost).
// `ORDER BY id` (bukan `rowid`, yang tidak ada di MySQL) menjaga urutan
// penyimpanan -- `id` di sini kolom AUTO_INCREMENT baru di kost_fasilitas.
async function ambilFasilitas(ids) {
  const peta = new Map();
  if (ids.length === 0) return peta;

  // pool.query (bukan pool.execute) dipakai di sini karena perlu ekspansi
  // array `ids` menjadi daftar IN (?, ?, ...) -- mysql2 mendukung ini lewat
  // query() dengan escaping sendiri, tidak lewat protokol prepared statement.
  const [baris] = await pool.query(
    `SELECT kost_id, nama FROM kost_fasilitas
     WHERE kost_id IN (?) ORDER BY id`,
    [ids],
  );

  for (const b of baris) {
    if (!peta.has(b.kost_id)) peta.set(b.kost_id, []);
    peta.get(b.kost_id).push(b.nama);
  }
  return peta;
}

async function formatDaftarKost(rows) {
  const peta = await ambilFasilitas(rows.map((r) => r.id));
  return rows.map((r) => formatKost(r, peta.get(r.id) || []));
}

const FASILITAS_VALID = [
  "WiFi",
  "AC",
  "Kamar Mandi Dalam",
  "Kamar Mandi Luar",
  "Kasur",
  "Lemari",
  "Meja Belajar",
  "Laundry",
  "Parkir Motor",
  "Dapur Bersama",
];
const KATEGORI_VALID = ["putra", "putri", "campur"];

const adaTeks = (v) => typeof v === "string" && v.trim() !== "";

// Teks opsional: boleh tidak dikirim, null, atau string kosong (jadi null)
function teksOpsional(v) {
  if (v === undefined || v === null) return { ok: true, nilai: null };
  if (typeof v !== "string") return { ok: false };
  const bersih = v.trim();
  return { ok: true, nilai: bersih === "" ? null : bersih };
}

// Dipakai bersama oleh POST dan PUT. Mengembalikan { error } atau { nilai }.
function validasiKost(body) {
  const b = body || {};

  if (!adaTeks(b.nama)) return { error: "nama wajib diisi" };
  if (!adaTeks(b.alamat)) return { error: "alamat wajib diisi" };
  if (!adaTeks(b.mapsUrl) || !/^https?:\/\//i.test(b.mapsUrl.trim())) {
    return { error: "mapsUrl wajib diisi dan diawali http:// atau https://" };
  }
  if (!KATEGORI_VALID.includes(b.kategoriPenyewa)) {
    return {
      error: `kategoriPenyewa harus salah satu dari: ${KATEGORI_VALID.join(", ")}`,
    };
  }
  if (!adaTeks(b.ukuranKamar)) return { error: "ukuranKamar wajib diisi" };
  if (!Number.isInteger(b.jumlahKamarTotal) || b.jumlahKamarTotal < 1) {
    return { error: "jumlahKamarTotal harus berupa angka bulat minimal 1" };
  }
  if (
    !Number.isInteger(b.jumlahKamarKosong) ||
    b.jumlahKamarKosong < 0 ||
    b.jumlahKamarKosong > b.jumlahKamarTotal
  ) {
    return {
      error:
        "jumlahKamarKosong harus angka bulat antara 0 dan jumlahKamarTotal",
    };
  }
  if (!Number.isInteger(b.harga) || b.harga <= 0) {
    return { error: "harga harus berupa angka bulat lebih dari 0" };
  }
  if (
    typeof b.whatsappNumber !== "string" ||
    !/^62\d{8,13}$/.test(b.whatsappNumber)
  ) {
    return {
      error:
        "whatsappNumber harus berupa angka diawali 62 (contoh: 6281234567890)",
    };
  }

  const patokan = teksOpsional(b.patokan);
  if (!patokan.ok) return { error: "patokan harus berupa teks" };
  const imageUrl = teksOpsional(b.imageUrl);
  if (!imageUrl.ok) return { error: "imageUrl harus berupa teks" };

  let fasilitas = [];
  if (b.fasilitas !== undefined) {
    if (!Array.isArray(b.fasilitas))
      return { error: "fasilitas harus berupa array" };
    const tidakDikenal = b.fasilitas.filter(
      (f) => !FASILITAS_VALID.includes(f),
    );
    if (tidakDikenal.length > 0) {
      return { error: `fasilitas tidak dikenal: ${tidakDikenal.join(", ")}` };
    }
    fasilitas = [...new Set(b.fasilitas)];
  }

  return {
    nilai: {
      nama: b.nama.trim(),
      alamat: b.alamat.trim(),
      patokan: patokan.nilai,
      mapsUrl: b.mapsUrl.trim(),
      kategoriPenyewa: b.kategoriPenyewa,
      ukuranKamar: b.ukuranKamar.trim(),
      jumlahKamarTotal: b.jumlahKamarTotal,
      jumlahKamarKosong: b.jumlahKamarKosong,
      harga: b.harga,
      imageUrl: imageUrl.nilai,
      whatsappNumber: b.whatsappNumber,
      fasilitas,
    },
  };
}

async function ambilKostById(id) {
  const [baris] = await pool.execute("SELECT * FROM kost WHERE id = ?", [id]);
  const row = baris[0];
  if (!row) return null;
  const hasil = await formatDaftarKost([row]);
  return hasil[0];
}

module.exports = {
  hitungStatus,
  formatDaftarKost,
  validasiKost,
  ambilKostById,
};
