import { z } from 'zod';

export const updateSettingSchema = z.object({
  value: z.string(),
});

export const listSettingsQuerySchema = z.object({
  category: z.string().optional(),
});

export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;
export type ListSettingsQuery = z.infer<typeof listSettingsQuerySchema>;
