const nodemailer = require('nodemailer');
const { mail } = require('../config/env');

function createTransporter() {
  if (!mail.host || !mail.user || !mail.pass) {
    return null;
  }

  return nodemailer.createTransport({
    host: mail.host,
    port: mail.port,
    secure: mail.secure,
    auth: {
      user: mail.user,
      pass: mail.pass
    }
  });
}

async function sendMail({ to, subject, text, html }) {
  const transporter = createTransporter();

  if (!transporter) {
    console.log('Mail skipped because MAIL_* values are not configured.');
    return false;
  }

  await transporter.sendMail({
    from: mail.from,
    to,
    subject,
    text,
    html
  });

  return true;
}

async function sendAppointmentConfirmation({ patientEmail, patientName, doctorName, appointmentDate, startTime }) {
  return sendMail({
    to: patientEmail,
    subject: 'Appointment booked successfully',
    text: `Hi ${patientName}, your appointment with ${doctorName} is booked for ${appointmentDate} at ${startTime}.`,
    html: `<p>Hi ${patientName},</p><p>Your appointment with <strong>${doctorName}</strong> is booked for <strong>${appointmentDate}</strong> at <strong>${startTime}</strong>.</p>`
  });
}

async function sendAppointmentReminder({ patientEmail, patientName, doctorName, appointmentDate, startTime }) {
  return sendMail({
    to: patientEmail,
    subject: 'Appointment reminder',
    text: `Reminder: ${patientName}, your appointment with ${doctorName} is on ${appointmentDate} at ${startTime}.`,
    html: `<p>Reminder: ${patientName}, your appointment with <strong>${doctorName}</strong> is on <strong>${appointmentDate}</strong> at <strong>${startTime}</strong>.</p>`
  });
}

module.exports = {
  sendMail,
  sendAppointmentConfirmation,
  sendAppointmentReminder
};
