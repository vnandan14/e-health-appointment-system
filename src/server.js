const app = require('./app');
const pool = require('./config/db');
const { port } = require('./config/env');

async function startServer() {
  try {
    await pool.query('SELECT 1');
    app.listen(port, () => {
      console.log(`E-Health Appointment System API running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to connect to MySQL database.');
    console.error(error.message);
    process.exit(1);
  }
}

startServer();
