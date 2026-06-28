const pool = require('../config/db');
const { sendAppointmentReminder } = require('../services/mailService');

async function sendReminders() {
  const [appointments] = await pool.query(
    `SELECT
      a.id,
      a.appointment_date,
      a.start_time,
      p.name AS patient_name,
      p.email AS patient_email,
      d.name AS doctor_name
     FROM appointments a
     JOIN users p ON p.id = a.patient_id
     JOIN users d ON d.id = a.doctor_id
     LEFT JOIN email_reminders er ON er.appointment_id = a.id
     WHERE a.status = 'confirmed'
       AND er.id IS NULL
       AND TIMESTAMP(a.appointment_date, a.start_time) BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 24 HOUR)`
  );

  for (const appointment of appointments) {
    await sendAppointmentReminder({
      patientEmail: appointment.patient_email,
      patientName: appointment.patient_name,
      doctorName: appointment.doctor_name,
      appointmentDate: appointment.appointment_date,
      startTime: appointment.start_time
    });

    await pool.query('INSERT INTO email_reminders (appointment_id) VALUES (?)', [appointment.id]);
    console.log(`Reminder processed for appointment ${appointment.id}`);
  }

  console.log(`Processed ${appointments.length} reminder(s).`);
  await pool.end();
}

sendReminders().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
