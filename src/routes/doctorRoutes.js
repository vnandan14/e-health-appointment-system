const express = require('express');
const { body } = require('express-validator');
const doctorController = require('../controllers/doctorController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../utils/validation');

const router = express.Router();

router.get('/', doctorController.listDoctors);
router.get('/:id', doctorController.getDoctor);
router.get('/:id/availability', doctorController.getAvailability);

router.post(
  '/:id/availability',
  authenticate,
  authorize('doctor', 'admin'),
  [
    body('availableDate').isISO8601().withMessage('availableDate must be a valid date'),
    body('startTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('startTime must be HH:mm'),
    body('endTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('endTime must be HH:mm')
  ],
  validate,
  doctorController.addAvailability
);

module.exports = router;
