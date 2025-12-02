import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
export { supabase };

export async function logSubmission(payload) {
  await supabase.from('submissions').insert(payload);
}

export async function logActivity(payload) {
  await supabase.from('activity_logs').insert(payload);
}

export async function logMetric(payload) {
  await supabase.from('dashboard_metrics').insert(payload);
}
