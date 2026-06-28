const express = require('express');
const { body } = require('express-validator');
const appointmentController = require('../controllers/appointmentController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../utils/validation');

const router = express.Router();

router.use(authenticate);

router.post(
  '/',
  authorize('patient'),
  [
    body('doctorId').isInt({ min: 1 }).withMessage('doctorId is required'),
    body('availabilityId').isInt({ min: 1 }).withMessage('availabilityId is required'),
    body('reason').trim().notEmpty().withMessage('Reason is required')
  ],
  validate,
  appointmentController.createAppointment
);

router.get('/', appointmentController.listAppointments);
router.get('/:id', appointmentController.getAppointment);
router.get('/:id/calendar.ics', appointmentController.downloadCalendarFile);

router.patch(
  '/:id/status',
  [
    body('status')
      .isIn(['pending', 'confirmed', 'cancelled', 'completed'])
      .withMessage('Invalid appointment status')
  ],
  validate,
  appointmentController.updateAppointmentStatus
);

router.patch(
  '/:id/reschedule',
  [body('availabilityId').isInt({ min: 1 }).withMessage('availabilityId is required')],
  validate,
  appointmentController.rescheduleAppointment
);

router.delete('/:id', appointmentController.cancelAppointment);

module.exports = router;
