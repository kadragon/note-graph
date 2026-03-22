import { z } from 'zod';
import { positiveIntegerQuery } from './schema-helpers';

export const adminBatchQuerySchema = z.object({
  batchSize: positiveIntegerQuery(10),
});
