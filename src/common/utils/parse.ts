import { BadRequestError } from './app-error.js';

/**
 * Safely parse a string or number to an integer.
 * Throws BadRequestError if the value is not a valid integer.
 */
export function safeParseInt(value: string | number, fieldName = 'ID'): number {
    const parsed = typeof value === 'number' ? value : parseInt(value, 10);
    if (isNaN(parsed) || !Number.isFinite(parsed)) {
        throw new BadRequestError(`Invalid ${fieldName}: ${value}`);
    }
    return parsed;
}
