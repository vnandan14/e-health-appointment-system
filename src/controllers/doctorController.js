const pool = require('../config/db');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');

const listDoctors = asyncHandler(async (req, res) => {
  const { specialization } = req.query;
  const params = [];
  let where = "WHERE u.role = 'doctor'";

  if (specialization) {
    where += ' AND dp.specialization LIKE ?';
    params.push(`%${specialization}%`);
  }

  const [rows] = await pool.query(
    `SELECT
      u.id, u.name, u.email, u.phone,
      dp.specialization, dp.qualification, dp.experience_years,
      dp.consultation_fee, dp.clinic_address
     FROM users u
     JOIN doctor_profiles dp ON dp.user_id = u.id
     ${where}
     ORDER BY u.name ASC`,
    params
  );

  res.json({
    success: true,
    data: rows
  });
});

const getDoctor = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT
      u.id, u.name, u.email, u.phone,
      dp.specialization, dp.qualification, dp.experience_years,
      dp.consultation_fee, dp.clinic_address
     FROM users u
     JOIN doctor_profiles dp ON dp.user_id = u.id
     WHERE u.id = ? AND u.role = 'doctor'`,
    [req.params.id]
  );

  if (!rows.length) {
    throw new ApiError(404, 'Doctor not found');
  }

  res.json({
    success: true,
    data: rows[0]
  });
});

const addAvailability = asyncHandler(async (req, res) => {
  const doctorId = Number(req.params.id);

  if (req.user.role === 'doctor' && req.user.id !== doctorId) {
    throw new ApiError(403, 'Doctors can only manage their own availability');
  }

  const [doctors] = await pool.query("SELECT id FROM users WHERE id = ? AND role = 'doctor'", [doctorId]);
  if (!doctors.length) {
    throw new ApiError(404, 'Doctor not found');
  }

  const { availableDate, startTime, endTime } = req.body;
  const [result] = await pool.query(
    'INSERT INTO doctor_availability (doctor_id, available_date, start_time, end_time) VALUES (?, ?, ?, ?)',
    [doctorId, availableDate, startTime, endTime]
  );

  res.status(201).json({
    success: true,
    data: {
      id: result.insertId,
      doctorId,
      availableDate,
      startTime,
      endTime,
      isBooked: false
    }
  });
});

const getAvailability = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, doctor_id, available_date, start_time, end_time, is_booked
     FROM doctor_availability
     WHERE doctor_id = ? AND available_date >= CURDATE()
     ORDER BY available_date ASC, start_time ASC`,
    [req.params.id]
  );

  res.json({
    success: true,
    data: rows
  });
});

module.exports = {
  listDoctors,
  getDoctor,
  addAvailability,
  getAvailability
};
