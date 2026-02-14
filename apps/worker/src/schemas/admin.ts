import { z } from 'zod';

function parseIntegerOrDefault(value: string | undefined, defaultValue: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function positiveIntegerQuery(defaultValue: number) {
  return z
    .string()
    .optional()
    .transform((value) => Math.max(1, parseIntegerOrDefault(value, defaultValue)));
}

function nonNegativeIntegerQuery(defaultValue: number) {
  return z
    .string()
    .optional()
    .transform((value) => Math.max(0, parseIntegerOrDefault(value, defaultValue)));
}

export const adminBatchQuerySchema = z.object({
  batchSize: positiveIntegerQuery(10),
});

export const adminEmbeddingFailuresQuerySchema = z.object({
  limit: positiveIntegerQuery(50),
  offset: nonNegativeIntegerQuery(0),
});
