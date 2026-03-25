import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dugaqvvnhsgenhmhuyju.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1Z2FxdnZuaHNnZW5obWh1eWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDMyNTMsImV4cCI6MjA4OTUxOTI1M30.JPzQKmo_-j2U4QKQZd-jxLF7BisDtv1Pl8U2y3FnShg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
