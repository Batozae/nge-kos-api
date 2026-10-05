const jwt = require("jsonwebtoken");
const { kirimError } = require("../utils/http");

// Wajib login: membaca header "Authorization: Bearer <token>"
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [skema, token] = header.split(" ");

  if (skema !== "Bearer" || !token) {
    return kirimError(
      res,
      401,
      "UNAUTHORIZED",
      "Token tidak ditemukan. Gunakan header Authorization: Bearer <token>",
    );
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch (err) {
    return kirimError(
      res,
      401,
      "INVALID_TOKEN",
      "Token tidak valid atau sudah kedaluwarsa",
    );
  }
}

// Wajib punya peran tertentu. Dipasang SETELAH requireAuth.
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return kirimError(
        res,
        403,
        "FORBIDDEN",
        "Anda tidak memiliki akses ke endpoint ini",
      );
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
