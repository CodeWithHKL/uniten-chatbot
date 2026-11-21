# UNITEN Chatbot

An AI chatbot for Universiti Tenaga Nasional (UNITEN), Malaysia. It answers questions about programmes, admission,
campus life and more, using Google Gemini and the content of the official [uniten.edu.my](https://www.uniten.edu.my/)
website.

> **Unofficial concept project.** It is not an official UNITEN product. Answers are AI-generated and can be wrong,
> so important details (fees, intakes, entry requirements) should be confirmed with UNITEN.

## Features

- **Grounded answers.** Questions are matched to the relevant official pages (admission, a specific programme,
  contact, accommodation, ...), and Gemini reads only those pages. Replies end with a source link to the pages it
  actually read. It never browses or searches anywhere else.
- **Asks when it needs to.** Vague questions ("what can I study?", "what am I eligible for?") get a short clarifying
  question first, such as your qualification, results and interests, before any recommendation.
- **Streaming replies** with Markdown, copy and regenerate buttons, and a "New chat" button.
- **Light and dark themes.** It follows the visitor's system theme and remembers a manual choice.
- **Abuse protection.** Every page and the chat API sit behind a Cloudflare Turnstile challenge.
- **Resilient.** Falls back to a second Gemini model on rate limits or overload, with automatic retries and
  timeouts.
- **Rate limiting.** Per-IP sliding-window limit (default 10 requests per 60 seconds) backed by Upstash Redis.
  Over the limit, the API returns HTTP 429 with a `Retry-After` header.
- **Chat logging.** Each question and answer is saved to a Supabase (PostgreSQL) `chat_logs` table together with the
  model used and a salted hash of the visitor's IP (the raw IP is never stored).
- **Privacy.** Messages are processed by Google Gemini and logged to Supabase as described above. Tell your users
  that conversations are logged, and delete old rows periodically.

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | [SvelteKit](https://svelte.dev/docs/kit) 3 (Svelte 5), TypeScript |
| Styling | Tailwind CSS v4, Google Sans (variable) |
| AI | [`@google/genai`](https://www.npmjs.com/package/@google/genai), Gemini Flash-Lite models + URL context tool |
| Bot protection | Cloudflare Turnstile |
| Rate limiting | [Upstash Redis](https://upstash.com/) (`@upstash/ratelimit`, `@upstash/redis`) |
| Database | [Supabase](https://supabase.com/) PostgreSQL (`@supabase/supabase-js`) |
| Hosting | Vercel (`@sveltejs/adapter-vercel`) |

## Getting started

Requires **Node.js 22.17 or newer**.

```bash
npm install
cp .env.example .env     # then fill in the values (see below)
npm run dev
```

The dev server skips the Turnstile challenge so you can work without keys. To test the real challenge locally, set
`TURNSTILE_ENFORCE_IN_DEV=true` and use Cloudflare's
[test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
(site key `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`; they always pass).

Other scripts: `npm run check` (type-check), `npm run build`, `npm run preview`.

## Database setup (Supabase)

1. Create a Supabase project.
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql` and run it. This creates the `chat_logs` table
   with row-level security enabled (only the server's secret key can read or write it).
3. Copy the project URL (`https://<project>.supabase.co`, without any `/rest/v1/` suffix) and the **secret** key
   (`sb_secret_...`, or the legacy `service_role` key) into your environment variables. Never expose the secret key to
   the browser.

Timestamps are stored in UTC (`timestamptz`). To view them in Malaysia time:

```sql
select created_at at time zone 'Asia/Kuala_Lumpur' as created_at_myt, question, answer
from public.chat_logs
order by created_at desc;
```

## Rate limiting setup (Upstash)

Create an Upstash Redis database (pick a region near your hosting) and copy the **REST** URL and token (not the
`redis://` connection string) into your environment variables. Keys are stored under the `uniten-chatbot:` prefix and
expire automatically after the rate-limit window, so the data browser is usually empty when the site is idle.

## Environment variables

Declared in `src/env.ts`. Copy `.env.example` to `.env` locally; set them in the hosting dashboard when deployed.

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | yes | Google AI Studio API key (<https://aistudio.google.com/apikey>) |
| `GEMINI_MODEL` | no | Primary model. Default `gemini-3.5-flash-lite` |
| `GEMINI_FALLBACK_MODEL` | no | Used when the primary hits a limit or fails. Default `gemini-3.1-flash-lite` |
| `TURNSTILE_SITE_KEY` | yes (production) | Cloudflare Turnstile site key |
| `TURNSTILE_SECRET_KEY` | yes (production) | Turnstile secret; also signs the pass cookie |
| `TURNSTILE_ENFORCE_IN_DEV` | no | `true` to enforce Turnstile on the local dev server |
| `UPSTASH_REDIS_REST_URL` | no | Upstash Redis REST URL. If empty, rate limiting is disabled |
| `UPSTASH_REDIS_REST_TOKEN` | no | Upstash Redis REST token |
| `RATE_LIMIT_REQUESTS` | no | Max requests per IP per window. Default `10` |
| `RATE_LIMIT_WINDOW_SECONDS` | no | Window length in seconds. Default `60` |
| `SUPABASE_URL` | no | Supabase project URL. If empty, chat logging is disabled |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Supabase secret key (server only) |
| `MAINTENANCE_MODE` | no | `true` to disable the chat API (redeploy to apply) |

If the Turnstile keys are missing in production, the site returns an error instead of serving unprotected. If the
Upstash or Supabase variables are missing, rate limiting or logging is skipped. If either service errors at runtime,
the chat still works.

## Deploying to Vercel

1. **Cloudflare:** Dashboard, then Turnstile, then Add widget. Add your hostnames (your `*.vercel.app` domain and any
   custom domain; add `localhost` for local testing) and choose *Managed* mode. Copy the site key and secret key.
2. **Vercel:** import the repository (framework preset *SvelteKit*), then add the environment variables above and
   deploy. Redeploy after changing any variable.
3. Open the deployed site in a private window. You should see "Checking that you are human...", then the chat.

`npm run build` uses the Vercel adapter, which creates symlinks. Run it on Vercel, Linux or WSL, not plain Windows.

## How it works

```
question ──> rate limit ──> routes to official pages ──> Gemini (URL context) ──> streamed answer + sources ──> log
```

1. `src/hooks.server.ts` checks every request for a valid Turnstile pass.
2. `src/routes/api/chat/+server.ts` checks the per-IP rate limit (`src/lib/server/rateLimit.ts`), validates the
   message and recent history, asks `src/lib/server/officialPages.ts` which official pages are relevant, and attaches
   those URLs to the Gemini request.
3. Gemini's URL context tool can fetch only URLs present in the request, which keeps lookups limited to
   `www.uniten.edu.my`. The server streams the reply and appends links to the pages Gemini actually read.
4. When the reply finishes, `src/lib/server/chatLog.ts` writes the question and answer to Supabase.

Google Search grounding is deliberately not used: it cannot be limited to one domain and requires a paid plan.

## Project structure

```
src/
  hooks.server.ts            Turnstile gate
  env.ts                     environment variable declarations
  routes/
    +page.svelte             chat interface
    api/chat/+server.ts      Gemini endpoint (rate limit, streaming, fallback, sources, logging)
  lib/
    components/              BrandMark, ThemeToggle
    server/
      rateLimit.ts           Upstash Redis per-IP limiter
      chatLog.ts             Supabase chat log writer
      officialPages.ts       question -> official page routing
      programmes.ts          list of programme detail pages on uniten.edu.my
static/                      logo and favicons
supabase/schema.sql          chat_logs table (run in the Supabase SQL editor)
```

## Extending the bot

- **New topics:** add a route (a regular expression plus page paths) in `src/lib/server/officialPages.ts`.
- **New or renamed programmes:** update the list in `src/lib/server/programmes.ts` (copied from the site's
  programme listings).
- **Tone and rules:** edit `SYSTEM_PROMPT` in `src/routes/api/chat/+server.ts`.

## Limitations

- The bot only knows what is on the pages it is given. Topics that do not match a route fall back to "I don't know"
  and a pointer to the website.
- The programme list is a copy, so it needs updating when UNITEN adds or renames programmes.
- Free-tier Gemini, Supabase and Upstash quotas apply.
- Rate limiting is per IP, so visitors behind a shared network (such as campus Wi-Fi) share one limit.
