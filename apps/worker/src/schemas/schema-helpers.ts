import { z } from 'zod';

export function parseIntegerOrDefault(value: string | undefined, defaultValue: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export function positiveIntegerQuery(defaultValue: number) {
  return z
    .string()
    .optional()
    .transform((value) => Math.max(1, parseIntegerOrDefault(value, defaultValue)));
}

export function nonNegativeIntegerQuery(defaultValue: number) {
  return z
    .string()
    .optional()
    .transform((value) => Math.max(0, parseIntegerOrDefault(value, defaultValue)));
}
