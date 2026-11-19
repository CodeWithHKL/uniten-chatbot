import { defineEnvVars } from '@sveltejs/kit/env';

// All optional at build time; the request handlers fail closed when required ones are missing.
const optional = (fallback = '') => (value: string | undefined) => value ?? fallback;

export const variables = defineEnvVars({
  GEMINI_API_KEY: { schema: optional(), description: 'Google AI Studio API key' },
  GEMINI_MODEL: { schema: optional('gemini-3.5-flash-lite'), description: 'Primary Gemini model id' },
  GEMINI_FALLBACK_MODEL: { schema: optional('gemini-3.1-flash-lite'), description: 'Used when the primary hits a limit or fails' },
  TURNSTILE_SITE_KEY: { schema: optional(), description: 'Cloudflare Turnstile site key' },
  TURNSTILE_SECRET_KEY: { schema: optional(), description: 'Cloudflare Turnstile secret (also signs the pass cookie)' },
  TURNSTILE_ENFORCE_IN_DEV: { schema: optional('false'), description: "Set to 'true' to test the Turnstile challenge on the local dev server" },
  UPSTASH_REDIS_REST_URL: { schema: optional(), description: 'Upstash Redis REST URL (rate limiting)' },
  UPSTASH_REDIS_REST_TOKEN: { schema: optional(), description: 'Upstash Redis REST token' },
  RATE_LIMIT_REQUESTS: { schema: optional('10'), description: 'Max chat requests per IP per window' },
  RATE_LIMIT_WINDOW_SECONDS: { schema: optional('60'), description: 'Rate limit window in seconds' },
  SUPABASE_URL: { schema: optional(), description: 'Supabase project URL' },
  SUPABASE_SERVICE_ROLE_KEY: { schema: optional(), description: 'Supabase service role key (server only, never expose)' },
  MAINTENANCE_MODE: { schema: optional('false'), description: "Set to 'true' to disable the chat API" }
});
