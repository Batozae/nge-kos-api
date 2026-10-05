const db = require("../db");

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

// Mengambil fasilitas untuk banyak kost sekaligus (satu query, bukan satu per kost)
function ambilFasilitas(ids) {
  const peta = new Map();
  if (ids.length === 0) return peta;

  const placeholders = ids.map(() => "?").join(",");
  const baris = db
    .prepare(
      `SELECT kost_id, nama FROM kost_fasilitas
       WHERE kost_id IN (${placeholders}) ORDER BY rowid`,
    )
    .all(...ids);

  for (const b of baris) {
    if (!peta.has(b.kost_id)) peta.set(b.kost_id, []);
    peta.get(b.kost_id).push(b.nama);
  }
  return peta;
}

function formatDaftarKost(rows) {
  const peta = ambilFasilitas(rows.map((r) => r.id));
  return rows.map((r) => formatKost(r, peta.get(r.id) || []));
}

module.exports = { hitungStatus, formatDaftarKost };
