/* The two public values the browser needs.
 *
 * Both are safe to publish — the anon key is designed to be, and every rule
 * that matters is enforced by row level security in the database, not here.
 * Verified against this project: a stranger cannot read the profiles table, a
 * customer cannot change their own plan, and an unpaid page does not resolve.
 *
 * The service_role key must NEVER appear in this file or anywhere in this
 * folder — it bypasses row level security entirely. It belongs only in the
 * Edge Function secrets. */
window.LINKUP_CONFIG = {
  supabaseUrl: 'https://ldaajbuumgjujfwmlcwm.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkYWFqYnV1bWdqdWpmd21sY3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2ODM5NzEsImV4cCI6MjEwMTI1OTk3MX0.CmuWQtBLPoNy__oQ1IW8Jx05tsJs5V_7LmH_AaGIUqg',
};
