const rateLimit = require('express-rate-limit');
const { errorResponse } = require('../utils/response.util');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return errorResponse(res, 'Terlalu banyak permintaan dari IP ini, silakan coba lagi beberapa saat.', 429);
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 login requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return errorResponse(res, 'Terlalu banyak percobaan autentikasi, silakan coba lagi setelah 15 menit.', 429);
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
};
