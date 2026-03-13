import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env?.VITE_SUPABASE_URL as string) || '';
const supabaseAnonKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY as string) || '';

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'http://placeholder.invalid',
  supabaseAnonKey || 'placeholder'
);
