const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { formatDaftarKost } = require("../utils/kost");

const router = express.Router();

// GET /owner/kost: hanya listing milik pemilik yang sedang login
router.get("/kost", requireAuth, requireRole("pemilik"), (req, res) => {
  const rows = db
    .prepare("SELECT * FROM kost WHERE owner_id = ? ORDER BY id ASC")
    .all(req.user.id);
  const data = formatDaftarKost(rows);
  res.json({ data, total: data.length });
});

module.exports = router;
