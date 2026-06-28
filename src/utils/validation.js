const { validationResult } = require('express-validator');
const ApiError = require('./apiError');

function validate(req, res, next) {
  const result = validationResult(req);

  if (result.isEmpty()) {
    return next();
  }

  const message = result.array().map((item) => item.msg).join(', ');
  return next(new ApiError(400, message));
}

module.exports = validate;
