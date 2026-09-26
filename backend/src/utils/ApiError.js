export class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status
   * @param {string} message    safe, user-facing message
   * @param {{errors?: Array, code?: string}} [extra]
   */
  constructor(statusCode, message, { errors, code } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.appCode = code;
    this.isOperational = true;
  }
}
