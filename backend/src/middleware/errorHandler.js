import { isProd } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export const notFound = (req, res, next) =>
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = err.statusCode || 500;
  let message = err.message;
  let errors = err.errors;
  const code = err.appCode;

  if (err.name === 'CastError') {
    status = 400; message = `Invalid value for ${err.path}`;
  } else if (err.code === 11000) {
    status = 409; message = 'This record already exists.';
  } else if (err.name === 'ValidationError') {
    status = 400; message = 'Validation failed';
    errors = Object.values(err.errors || {}).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') { status = 413; message = 'This file is too large for the tool.'; }
    else if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') { status = 400; message = 'Too many files selected.'; }
    else { status = 400; message = 'The upload could not be read. Please try again.'; }
  } else if (err.type === 'entity.parse.failed') {
    status = 400; message = 'Malformed JSON body.';
  } else if (err.type === 'entity.too.large') {
    status = 413; message = 'Request body too large.';
  } else if (!err.isOperational) {
    console.error('💥 Unhandled error:', err);
    status = 500;
    message = isProd ? 'Something went wrong. Please try again.' : err.message;
  }

  res.status(status).json({ success: false, message, ...(errors && { errors }), ...(code && { code }) });
}
