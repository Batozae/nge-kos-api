require("dotenv").config();
const express = require("express");
const cors = require("cors");
require("./db"); // menjalankan pembuatan tabel + seed

const app = express();

app.use(cors()); // izinkan Flutter web (Chrome) memanggil API ini
app.use(express.json()); // baca body JSON dari request

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", require("./routes/auth"));
app.use("/kost", require("./routes/kost"));
app.use("/owner", require("./routes/owner"));

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
app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});
