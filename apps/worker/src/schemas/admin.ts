import { z } from 'zod';
import { nonNegativeIntegerQuery, positiveIntegerQuery } from './schema-helpers';

export const adminBatchQuerySchema = z.object({
  batchSize: positiveIntegerQuery(10),
});

export const adminEmbeddingFailuresQuerySchema = z.object({
  limit: positiveIntegerQuery(50),
  offset: nonNegativeIntegerQuery(0),
});
