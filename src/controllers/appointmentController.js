const pool = require('../config/db');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendAppointmentConfirmation } = require('../services/mailService');
const { buildAppointmentIcs } = require('../services/calendarService');

async function getAppointmentById(id) {
  const [rows] = await pool.query(
    `SELECT
      a.*,
      p.name AS patient_name,
      p.email AS patient_email,
      d.name AS doctor_name,
      d.email AS doctor_email
     FROM appointments a
     JOIN users p ON p.id = a.patient_id
     JOIN users d ON d.id = a.doctor_id
     WHERE a.id = ?`,
    [id]
  );

  return rows[0];
}

function canViewAppointment(user, appointment) {
  return (
    user.role === 'admin' ||
    appointment.patient_id === user.id ||
    appointment.doctor_id === user.id
  );
}

const createAppointment = asyncHandler(async (req, res) => {
  if (req.user.role !== 'patient') {
    throw new ApiError(403, 'Only patients can book appointments');
  }

  const { doctorId, availabilityId, reason } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [slots] = await connection.query(
      `SELECT *
       FROM doctor_availability
       WHERE id = ? AND doctor_id = ? AND is_booked = FALSE
       FOR UPDATE`,
      [availabilityId, doctorId]
    );

    if (!slots.length) {
      throw new ApiError(409, 'This availability slot is not available');
    }

    const slot = slots[0];

    const [result] = await connection.query(
      `INSERT INTO appointments
        (patient_id, doctor_id, availability_id, appointment_date, start_time, end_time, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
      [req.user.id, doctorId, availabilityId, slot.available_date, slot.start_time, slot.end_time, reason]
    );

    await connection.query('UPDATE doctor_availability SET is_booked = TRUE WHERE id = ?', [availabilityId]);
    await connection.commit();

    const appointment = await getAppointmentById(result.insertId);
    await sendAppointmentConfirmation({
      patientEmail: appointment.patient_email,
      patientName: appointment.patient_name,
      doctorName: appointment.doctor_name,
      appointmentDate: appointment.appointment_date,
      startTime: appointment.start_time
    });

    res.status(201).json({
      success: true,
      data: appointment
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

const listAppointments = asyncHandler(async (req, res) => {
  const params = [];
  let where = 'WHERE 1 = 1';

  if (req.user.role === 'patient') {
    where += ' AND a.patient_id = ?';
    params.push(req.user.id);
  }

  if (req.user.role === 'doctor') {
    where += ' AND a.doctor_id = ?';
    params.push(req.user.id);
  }

  if (req.query.status) {
    where += ' AND a.status = ?';
    params.push(req.query.status);
  }

  if (req.query.date) {
    where += ' AND a.appointment_date = ?';
    params.push(req.query.date);
  }

  const [rows] = await pool.query(
    `SELECT
      a.*,
      p.name AS patient_name,
      d.name AS doctor_name
     FROM appointments a
     JOIN users p ON p.id = a.patient_id
     JOIN users d ON d.id = a.doctor_id
     ${where}
     ORDER BY a.appointment_date ASC, a.start_time ASC`,
    params
  );

  res.json({
    success: true,
    data: rows
  });
});

const getAppointment = asyncHandler(async (req, res) => {
  const appointment = await getAppointmentById(req.params.id);

  if (!appointment) {
    throw new ApiError(404, 'Appointment not found');
  }

  if (!canViewAppointment(req.user, appointment)) {
    throw new ApiError(403, 'You cannot view this appointment');
  }

  res.json({
    success: true,
    data: appointment
  });
});

const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const appointment = await getAppointmentById(req.params.id);

  if (!appointment) {
    throw new ApiError(404, 'Appointment not found');
  }

  if (req.user.role === 'patient' && appointment.patient_id !== req.user.id) {
    throw new ApiError(403, 'You cannot update this appointment');
  }

  if (req.user.role === 'doctor' && appointment.doctor_id !== req.user.id) {
    throw new ApiError(403, 'You cannot update this appointment');
  }

  const { status, notes } = req.body;
  await pool.query('UPDATE appointments SET status = ?, notes = COALESCE(?, notes) WHERE id = ?', [
    status,
    notes || null,
    req.params.id
  ]);

  if (status === 'cancelled' && appointment.availability_id) {
    await pool.query('UPDATE doctor_availability SET is_booked = FALSE WHERE id = ?', [
      appointment.availability_id
    ]);
  }

  res.json({
    success: true,
    data: await getAppointmentById(req.params.id)
  });
});

const rescheduleAppointment = asyncHandler(async (req, res) => {
  const appointment = await getAppointmentById(req.params.id);

  if (!appointment) {
    throw new ApiError(404, 'Appointment not found');
  }

  if (req.user.role !== 'admin' && appointment.patient_id !== req.user.id) {
    throw new ApiError(403, 'Only the patient or admin can reschedule this appointment');
  }

  const { availabilityId } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [slots] = await connection.query(
      `SELECT *
       FROM doctor_availability
       WHERE id = ? AND doctor_id = ? AND is_booked = FALSE
       FOR UPDATE`,
      [availabilityId, appointment.doctor_id]
    );

    if (!slots.length) {
      throw new ApiError(409, 'New availability slot is not available');
    }

    const slot = slots[0];

    if (appointment.availability_id) {
      await connection.query('UPDATE doctor_availability SET is_booked = FALSE WHERE id = ?', [
        appointment.availability_id
      ]);
    }

    await connection.query(
      `UPDATE appointments
       SET availability_id = ?, appointment_date = ?, start_time = ?, end_time = ?, status = 'confirmed'
       WHERE id = ?`,
      [availabilityId, slot.available_date, slot.start_time, slot.end_time, appointment.id]
    );

    await connection.query('UPDATE doctor_availability SET is_booked = TRUE WHERE id = ?', [availabilityId]);
    await connection.commit();

    res.json({
      success: true,
      data: await getAppointmentById(appointment.id)
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

const cancelAppointment = asyncHandler(async (req, res) => {
  const appointment = await getAppointmentById(req.params.id);

  if (!appointment) {
    throw new ApiError(404, 'Appointment not found');
  }

  if (!canViewAppointment(req.user, appointment)) {
    throw new ApiError(403, 'You cannot cancel this appointment');
  }

  await pool.query("UPDATE appointments SET status = 'cancelled' WHERE id = ?", [appointment.id]);

  if (appointment.availability_id) {
    await pool.query('UPDATE doctor_availability SET is_booked = FALSE WHERE id = ?', [
      appointment.availability_id
    ]);
  }

  res.json({
    success: true,
    message: 'Appointment cancelled'
  });
});

const downloadCalendarFile = asyncHandler(async (req, res) => {
  const appointment = await getAppointmentById(req.params.id);

  if (!appointment) {
    throw new ApiError(404, 'Appointment not found');
  }

  if (!canViewAppointment(req.user, appointment)) {
    throw new ApiError(403, 'You cannot download this calendar file');
  }

  res.setHeader('Content-Type', 'text/calendar');
  res.setHeader('Content-Disposition', `attachment; filename="appointment-${appointment.id}.ics"`);
  res.send(buildAppointmentIcs(appointment));
});

module.exports = {
  createAppointment,
  listAppointments,
  getAppointment,
  updateAppointmentStatus,
  rescheduleAppointment,
  cancelAppointment,
  downloadCalendarFile
};
