# E-Health Appointment System

Backend project for serial number 4: **E-Health Appointment System**.

Tech stack:

- Node.js
- Express.js
- MySQL
- Nodemailer
- JWT authentication

## Features

- Patient, doctor and admin registration/login
- Doctor profile listing
- Appointment booking, rescheduling, cancellation and status management
- Doctor availability slots
- Calendar-style appointment API
- `.ics` calendar file export for an appointment
- Email confirmation and reminder support using Nodemailer

## Run In VS Code

1. Open this folder in VS Code.
2. Open a terminal and install packages:

```bash
npm install
```

3. Create your database in MySQL:

```bash
mysql -u root -p < database/schema.sql
```

4. Create a `.env` file from the sample:

```bash
cp .env.example .env
```

5. Edit `.env` and add your MySQL password, JWT secret and mail credentials.
6. Start the backend:

```bash
npm run dev
```

The API will run at:

```text
http://localhost:5001
```

The website UI will open at:

```text
http://localhost:5001
```

## Main API Routes

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Doctors

- `GET /api/doctors`
- `GET /api/doctors/:id`
- `POST /api/doctors/:id/availability`
- `GET /api/doctors/:id/availability`

### Appointments

- `POST /api/appointments`
- `GET /api/appointments`
- `GET /api/appointments/:id`
- `PATCH /api/appointments/:id/status`
- `PATCH /api/appointments/:id/reschedule`
- `DELETE /api/appointments/:id`
- `GET /api/appointments/:id/calendar.ics`

### Reminders

Send reminder emails for appointments happening in the next 24 hours:

```bash
npm run send-reminders
```

## Test Users

The schema creates one admin user:

- Email: `admin@ehealth.local`
- Password: `Admin@123`

Register patients and doctors through the API.

## Notes

- For Gmail, use an App Password instead of your normal email password.
- Import `docs/api-examples.http` in VS Code REST Client extension or copy the requests into Postman.
