/**
 * Type definitions for AppSetting
 */

export interface AppSetting {
  key: string;
  value: string;
  category: string;
  label: string;
  description: string | null;
  defaultValue: string;
  updatedAt: string;
}

export interface OpenAIModel {
  id: string;
  owned_by: string;
}
