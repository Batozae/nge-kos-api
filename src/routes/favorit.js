const express = require("express");
const { pool } = require("../db");
const { kirimError } = require("../utils/http");
const { requireAuth, requireRole } = require("../middleware/auth");
const { formatDaftarKost } = require("../utils/kost");

const router = express.Router();

// Semua endpoint di file ini wajib login sebagai pencari
router.use(requireAuth, requireRole("pencari"));

// Pastikan akun di dalam token masih ada (misalnya setelah database di-reset)
router.use(async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT id FROM users WHERE id = ?", [
      req.user.id,
    ]);
    if (!rows[0]) {
      return kirimError(
        res,
        401,
        "INVALID_TOKEN",
        "Akun untuk token ini tidak ditemukan",
      );
    }
    next();
  } catch (err) {
    next(err);
  }
});

// GET /favorit: kost favorit milik pencari yang login, yang terbaru di atas.
// `f.id DESC` menggantikan `f.rowid DESC` (tidak ada di MySQL) -- `id` di
// sini kolom AUTO_INCREMENT baru di tabel favorit, naik seiring waktu
// ditambahkan, jadi urutannya tetap "terbaru di atas" seperti sebelumnya.
router.get("/", async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT k.* FROM favorit f
       JOIN kost k ON k.id = f.kost_id
       WHERE f.user_id = ?
       ORDER BY f.id DESC`,
      [req.user.id],
    );

    const data = await formatDaftarKost(rows);
    res.json({ data, total: data.length });
  } catch (err) {
    next(err);
  }
});

// PUT /favorit/:kostId: tandai favorit (aman dipanggil berulang)
router.put("/:kostId", async (req, res, next) => {
  try {
    const { kostId } = req.params;
    let kost;
    if (/^\d+$/.test(kostId)) {
      const [rows] = await pool.execute("SELECT id FROM kost WHERE id = ?", [
        Number(kostId),
      ]);
      kost = rows[0];
    }

    if (!kost) {
      return kirimError(res, 404, "NOT_FOUND", "Kost tidak ditemukan");
    }

    // INSERT IGNORE -> padanan MySQL untuk INSERT OR IGNORE di SQLite,
    // memanfaatkan UNIQUE KEY (user_id, kost_id) di tabel favorit.
    await pool.execute(
      "INSERT IGNORE INTO favorit (user_id, kost_id) VALUES (?, ?)",
      [req.user.id, kost.id],
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// DELETE /favorit/:kostId: hapus dari favorit (aman dipanggil berulang)
router.delete("/:kostId", async (req, res, next) => {
  try {
    const { kostId } = req.params;
    if (!/^\d+$/.test(kostId)) {
      return kirimError(res, 404, "NOT_FOUND", "Kost tidak ditemukan");
    }

    await pool.execute(
      "DELETE FROM favorit WHERE user_id = ? AND kost_id = ?",
      [req.user.id, Number(kostId)],
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
