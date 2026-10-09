const express = require("express");
const db = require("../db");
const { kirimError } = require("../utils/http");
const { requireAuth, requireRole } = require("../middleware/auth");
const { formatDaftarKost } = require("../utils/kost");

const router = express.Router();

// Semua endpoint di file ini wajib login sebagai pencari
router.use(requireAuth, requireRole("pencari"));

// Pastikan akun di dalam token masih ada (misalnya setelah database di-reset)
router.use((req, res, next) => {
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(req.user.id);
  if (!user) {
    return kirimError(
      res,
      401,
      "INVALID_TOKEN",
      "Akun untuk token ini tidak ditemukan",
    );
  }
  next();
});

// GET /favorit: kost favorit milik pencari yang login, yang terbaru di atas
router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT k.* FROM favorit f
      JOIN kost k ON k.id = f.kost_id
      WHERE f.user_id = ?
      ORDER BY f.rowid DESC
    `,
    )
    .all(req.user.id);

  const data = formatDaftarKost(rows);
  res.json({ data, total: data.length });
});

// PUT /favorit/:kostId: tandai favorit (aman dipanggil berulang)
router.put("/:kostId", (req, res) => {
  const { kostId } = req.params;
  const kost = /^\d+$/.test(kostId)
    ? db.prepare("SELECT id FROM kost WHERE id = ?").get(Number(kostId))
    : undefined;

  if (!kost) {
    return kirimError(res, 404, "NOT_FOUND", "Kost tidak ditemukan");
  }

  db.prepare(
    "INSERT OR IGNORE INTO favorit (user_id, kost_id) VALUES (?, ?)",
  ).run(req.user.id, kost.id);
  res.status(204).send();
});

// DELETE /favorit/:kostId: hapus dari favorit (aman dipanggil berulang)
router.delete("/:kostId", (req, res) => {
  const { kostId } = req.params;
  if (!/^\d+$/.test(kostId)) {
    return kirimError(res, 404, "NOT_FOUND", "Kost tidak ditemukan");
  }

  db.prepare("DELETE FROM favorit WHERE user_id = ? AND kost_id = ?").run(
    req.user.id,
    Number(kostId),
  );
  res.status(204).send();
});

module.exports = router;
