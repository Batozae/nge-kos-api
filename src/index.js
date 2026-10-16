require("dotenv").config();
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET belum diisi di file .env. Server dihentikan.");
  process.exit(1);
}
const express = require("express");
const cors = require("cors");
const { siap } = require("./db"); // promise: tabel + seed MySQL selesai dibuat

const app = express();

app.use(cors()); // izinkan Flutter web (Chrome) memanggil API ini
app.use(express.json()); // baca body JSON dari request

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", require("./routes/auth"));
app.use("/kost", require("./routes/kost"));
app.use("/owner", require("./routes/owner"));
app.use("/favorit", require("./routes/favorit"));

// Endpoint yang tidak dikenal
app.use((req, res) => {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "Endpoint tidak ditemukan" },
  });
});

// Penanganan error terpusat
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Body request bukan JSON yang valid",
      },
    });
  }
  console.error(err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan pada server" },
  });
});

const PORT = process.env.PORT || 3000;

// Server baru mulai menerima request setelah koneksi MySQL, skema, dan
// seed selesai (await siap) -- mencegah request pertama gagal karena
// tabel belum sempat dibuat (beda dari SQLite yang sinkron sebelumnya).
siap
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server jalan di http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Gagal menyiapkan database MySQL. Server dihentikan.");
    console.error(err);
    process.exit(1);
  });
