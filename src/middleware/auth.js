const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { jwt: jwtConfig } = require('../config/env');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    throw new ApiError(401, 'Authentication token is required');
  }

  let payload;
  try {
    payload = jwt.verify(token, jwtConfig.secret);
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired token');
  }

  const [rows] = await pool.query(
    'SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?',
    [payload.id]
  );

  if (!rows.length) {
    throw new ApiError(401, 'User no longer exists');
  }

  req.user = rows[0];
  next();
});

function authorize(...roles) {
  return function roleGuard(req, res, next) {
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission for this action'));
    }

    return next();
  };
}

module.exports = {
  authenticate,
  authorize
};
