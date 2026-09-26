import { ApiError } from '../utils/ApiError.js';

/**
 * validate({ params, query, body }) - each value is a zod schema.
 * Parsed (and stripped) data replaces the raw input, so unknown fields never reach controllers
 * (protects against mass-assignment).
 */
export const validate = (schemas) => (req, res, next) => {
  const errors = [];
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key] ?? {});
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ field: issue.path.join('.') || key, message: issue.message });
      }
    } else {
      req[key] = result.data;
    }
  }
  if (errors.length) return next(new ApiError(400, 'Validation failed', { errors }));
  next();
};
