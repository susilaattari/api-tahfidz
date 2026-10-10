/**
 * Standardized API Response Utilities
 */

const successResponse = (res, message = 'Success', data = null, statusCode = 200, meta = null) => {
  const responsePayload = {
    success: true,
    message,
    data,
  };
  if (meta) {
    responsePayload.meta = meta;
  }
  return res.status(statusCode).json(responsePayload);
};

const errorResponse = (res, message = 'Internal Server Error', statusCode = 500, errors = null) => {
  const responsePayload = {
    success: false,
    message,
  };
  if (errors) {
    responsePayload.errors = errors;
  }
  return res.status(statusCode).json(responsePayload);
};

module.exports = {
  successResponse,
  errorResponse,
};
