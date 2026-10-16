const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { formatDaftarKost } = require("../utils/kost");

const router = express.Router();

// GET /owner/kost: hanya listing milik pemilik yang sedang login
router.get("/kost", requireAuth, requireRole("pemilik"), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM kost WHERE owner_id = ? ORDER BY id ASC",
      [req.user.id],
    );
    const data = await formatDaftarKost(rows);
    res.json({ data, total: data.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
