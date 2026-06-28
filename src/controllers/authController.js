const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { jwt: jwtConfig } = require('../config/env');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role
    },
    jwtConfig.secret,
    {
      expiresIn: jwtConfig.expiresIn
    }
  );
}

const register = asyncHandler(async (req, res) => {
  const { name, email, password, role = 'patient', phone, doctorProfile } = req.body;

  if (role === 'admin') {
    throw new ApiError(403, 'Admin users cannot be created from public registration');
  }

  if (role === 'doctor' && (!doctorProfile || !doctorProfile.specialization)) {
    throw new ApiError(400, 'Doctor specialization is required');
  }

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) {
    throw new ApiError(409, 'Email is already registered');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      'INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)',
      [name, email, passwordHash, role, phone || null]
    );

    const userId = result.insertId;

    if (role === 'doctor') {
      await connection.query(
        `INSERT INTO doctor_profiles
          (user_id, specialization, qualification, experience_years, consultation_fee, clinic_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          doctorProfile.specialization,
          doctorProfile.qualification || null,
          doctorProfile.experienceYears || 0,
          doctorProfile.consultationFee || 0,
          doctorProfile.clinicAddress || null
        ]
      );
    }

    await connection.commit();

    const user = { id: userId, name, email, role, phone };
    res.status(201).json({
      success: true,
      token: createToken(user),
      data: user
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

  if (!rows.length) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const user = rows[0];
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  res.json({
    success: true,
    token: createToken(user),
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone
    }
  });
});

const me = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: req.user
  });
});

module.exports = {
  register,
  login,
  me
};
