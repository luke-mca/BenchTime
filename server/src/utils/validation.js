import { ValidationError } from '../errors.js';

//Shared input checks so each service doesn't repeat them.

//Throws if value is not a string with at least one non-space character.
export function assertNonEmpty(value, fieldName, code) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} is required.`, code);
  }
}

//Throws if value is not one of the allowed values.
export function assertOneOf(value, allowed, fieldName, code) {
  if (!allowed.includes(value)) {
    throw new ValidationError(`${fieldName} must be one of: ${allowed.join(', ')}.`, code);
  }
}
