const state = {
  token: localStorage.getItem('token') || '',
  user: JSON.parse(localStorage.getItem('user') || 'null')
};

const $ = (selector) => document.querySelector(selector);

function showToast(message, isError = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 3200);
}

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

function setSession(data) {
  state.token = data.token;
  state.user = data.data;
  localStorage.setItem('token', state.token);
  localStorage.setItem('user', JSON.stringify(state.user));
  renderSession();
}

function renderSession() {
  const label = state.user
    ? `${state.user.name} (${state.user.role})`
    : 'Not logged in';
  $('#sessionStatus').textContent = label;
}

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach((item) => item.classList.add('hidden'));
      tab.classList.add('active');
      document.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.remove('hidden');
    });
  });
}

async function loadDoctors() {
  const doctorList = $('#doctorList');
  doctorList.innerHTML = '<div class="empty">Loading doctors...</div>';

  try {
    const result = await api('/api/doctors');
    if (!result.data.length) {
      doctorList.innerHTML = '<div class="empty">No doctors found. Register a doctor first.</div>';
      return;
    }

    doctorList.innerHTML = result.data.map((doctor) => `
      <article class="item">
        <div class="item-title">
          <span>${doctor.name}</span>
          <span class="tag">ID ${doctor.id}</span>
        </div>
        <div class="meta">${doctor.specialization} | ${doctor.qualification || 'Qualification not added'}</div>
        <div class="meta">${doctor.experience_years} years experience | Fee ${doctor.consultation_fee}</div>
        <div class="meta">${doctor.clinic_address || 'Clinic address not added'}</div>
      </article>
    `).join('');
  } catch (error) {
    doctorList.innerHTML = '<div class="empty">Could not load doctors.</div>';
    showToast(error.message, true);
  }
}

async function loadAppointments() {
  const appointmentList = $('#appointmentList');
  appointmentList.innerHTML = '<div class="empty">Loading appointments...</div>';

  try {
    const result = await api('/api/appointments');
    if (!result.data.length) {
      appointmentList.innerHTML = '<div class="empty">No appointments found.</div>';
      return;
    }

    appointmentList.innerHTML = result.data.map((appointment) => `
      <article class="item">
        <div class="item-title">
          <span>${appointment.patient_name} with ${appointment.doctor_name}</span>
          <span class="tag">${appointment.status}</span>
        </div>
        <div class="meta">${String(appointment.appointment_date).slice(0, 10)} | ${appointment.start_time} - ${appointment.end_time}</div>
        <div class="meta">${appointment.reason}</div>
      </article>
    `).join('');
  } catch (error) {
    appointmentList.innerHTML = '<div class="empty">Login first to view appointments.</div>';
    showToast(error.message, true);
  }
}

function setupForms() {
  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const result = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(formValues(event.currentTarget))
      });
      setSession(result);
      showToast('Login successful');
      await loadAppointments();
    } catch (error) {
      showToast(error.message, true);
    }
  });

  $('#patientForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const values = formValues(event.currentTarget);
      const result = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...values, role: 'patient' })
      });
      setSession(result);
      showToast('Patient account ready');
    } catch (error) {
      showToast(error.message, true);
    }
  });

  $('#doctorForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const values = formValues(event.currentTarget);
      const result = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          password: values.password,
          role: 'doctor',
          doctorProfile: {
            specialization: values.specialization,
            qualification: values.qualification,
            experienceYears: Number(values.experienceYears || 0),
            consultationFee: Number(values.consultationFee || 0),
            clinicAddress: values.clinicAddress
          }
        })
      });
      setSession(result);
      showToast('Doctor account ready');
      await loadDoctors();
    } catch (error) {
      showToast(error.message, true);
    }
  });

  $('#availabilityForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const values = formValues(event.currentTarget);
      const result = await api(`/api/doctors/${values.doctorId}/availability`, {
        method: 'POST',
        body: JSON.stringify({
          availableDate: values.availableDate,
          startTime: values.startTime,
          endTime: values.endTime
        })
      });
      showToast(`Slot added. Availability ID: ${result.data.id}`);
    } catch (error) {
      showToast(error.message, true);
    }
  });

  $('#bookingForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const values = formValues(event.currentTarget);
      await api('/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: Number(values.doctorId),
          availabilityId: Number(values.availabilityId),
          reason: values.reason
        })
      });
      showToast('Appointment booked');
      await loadAppointments();
    } catch (error) {
      showToast(error.message, true);
    }
  });
}

function setDefaultDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  $('[name="availableDate"]').value = tomorrow.toISOString().slice(0, 10);
  $('[name="startTime"]').value = '10:00';
  $('[name="endTime"]').value = '10:30';
}

setupTabs();
setupForms();
setDefaultDate();
renderSession();
loadDoctors();

$('#refreshDoctors').addEventListener('click', loadDoctors);
$('#loadAppointments').addEventListener('click', loadAppointments);
