import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('SUPABASE URL EXISTS:', !!supabaseUrl);
console.log('SUPABASE KEY EXISTS:', !!supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL or Anon Key is missing. Please check your .env file.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
