function formatIcsDate(dateValue, timeValue) {
  const date = dateValue instanceof Date
    ? dateValue.toISOString().slice(0, 10).replace(/-/g, '')
    : String(dateValue).slice(0, 10).replace(/-/g, '');
  const time = String(timeValue).replace(/:/g, '').padEnd(6, '0');
  return `${date}T${time}`;
}

function escapeIcsText(value) {
  return String(value || '').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

function buildAppointmentIcs(appointment) {
  const start = formatIcsDate(appointment.appointment_date, appointment.start_time);
  const end = formatIcsDate(appointment.appointment_date, appointment.end_time);
  const title = escapeIcsText(`Appointment with ${appointment.doctor_name}`);
  const description = escapeIcsText(appointment.reason);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//E-Health Appointment System//EN',
    'BEGIN:VEVENT',
    `UID:appointment-${appointment.id}@ehealth.local`,
    `DTSTAMP:${start}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `STATUS:${appointment.status.toUpperCase()}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

module.exports = {
  buildAppointmentIcs
};
