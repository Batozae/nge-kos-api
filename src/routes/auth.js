const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { kirimError } = require("../utils/http");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const ROLE_VALID = ["pencari", "pemilik"];
const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatUser(row) {
  return {
    id: String(row.id),
    nama: row.nama,
    email: row.email,
    role: row.role,
  };
}

function buatToken(row) {
  return jwt.sign({ id: row.id, role: row.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

// POST /auth/register
router.post("/register", async (req, res, next) => {
  try {
    const body = req.body || {};
    const nama = typeof body.nama === "string" ? body.nama.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role;

    if (!nama) {
      return kirimError(res, 400, "VALIDATION_ERROR", "Nama wajib diisi");
    }
    if (!FORMAT_EMAIL.test(email)) {
      return kirimError(
        res,
        400,
        "VALIDATION_ERROR",
        "Format email tidak valid",
      );
    }
    if (password.length < 8 || password.length > 72) {
      return kirimError(
        res,
        400,
        "VALIDATION_ERROR",
        "Kata sandi harus 8 sampai 72 karakter",
      );
    }
    if (!ROLE_VALID.includes(role)) {
      return kirimError(
        res,
        400,
        "VALIDATION_ERROR",
        `role harus salah satu dari: ${ROLE_VALID.join(", ")}`,
      );
    }

    const [sudahAdaRows] = await pool.execute(
      "SELECT id FROM users WHERE email = ?",
      [email],
    );
    if (sudahAdaRows[0]) {
      return kirimError(res, 409, "EMAIL_TAKEN", "Email sudah terdaftar");
    }

    const hash = await bcrypt.hash(password, 10);

    let id;
    try {
      const [hasil] = await pool.execute(
        "INSERT INTO users (nama, email, password_hash, role) VALUES (?, ?, ?, ?)",
        [nama, email, hash, role],
      );
      id = hasil.insertId;
    } catch (err) {
      // Berjaga-jaga kalau dua pendaftaran dengan email sama masuk bersamaan
      if (err.code === "ER_DUP_ENTRY") {
        return kirimError(res, 409, "EMAIL_TAKEN", "Email sudah terdaftar");
      }
      throw err;
    }

    const [userRows] = await pool.execute(
      "SELECT * FROM users WHERE id = ?",
      [id],
    );
    const user = userRows[0];
    res.status(201).json({ token: buatToken(user), user: formatUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /auth/login
router.post("/login", async (req, res, next) => {
  try {
    const body = req.body || {};
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return kirimError(
        res,
        400,
        "VALIDATION_ERROR",
        "Email dan kata sandi wajib diisi",
      );
    }

    const [userRows] = await pool.execute(
      "SELECT * FROM users WHERE email = ?",
      [email],
    );
    const user = userRows[0];
    const cocok = user
      ? await bcrypt.compare(password, user.password_hash)
      : false;

    // Pesan sengaja sama untuk "email tidak ada" dan "sandi salah"
    if (!cocok) {
      return kirimError(
        res,
        401,
        "INVALID_CREDENTIALS",
        "Email atau kata sandi salah",
      );
    }

    res.json({ token: buatToken(user), user: formatUser(user) });
  } catch (err) {
    next(err);
  }
});

// GET /auth/me  (tambahan di luar kontrak awal)
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const [userRows] = await pool.execute(
      "SELECT * FROM users WHERE id = ?",
      [req.user.id],
    );
    const user = userRows[0];
    if (!user) {
      return kirimError(
        res,
        401,
        "INVALID_TOKEN",
        "Akun untuk token ini tidak ditemukan",
      );
    }
    res.json({ data: formatUser(user) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
