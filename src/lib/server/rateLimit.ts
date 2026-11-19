import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import {
  UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN,
  RATE_LIMIT_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS
} from '$app/env/private';

let limiter: Ratelimit | null | undefined;

function getLimiter(): Ratelimit | null {
  if (limiter !== undefined) return limiter;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    console.warn('Upstash Redis is not configured; rate limiting is disabled');
    return (limiter = null);
  }
  limiter = new Ratelimit({
    redis: new Redis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN }),
    limiter: Ratelimit.slidingWindow(Number(RATE_LIMIT_REQUESTS) || 10, `${Number(RATE_LIMIT_WINDOW_SECONDS) || 60} s`),
    prefix: 'uniten-chatbot',
    analytics: false
  });
  return limiter;
}

/** Returns retry-after seconds if the caller is limited, otherwise null. Fails open if Redis errors. */
export async function checkRateLimit(key: string): Promise<number | null> {
  const rl = getLimiter();
  if (!rl) return null;
  try {
    const { success, reset } = await rl.limit(key);
    return success ? null : Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  } catch (err) {
    console.error('Rate limit check failed; allowing request:', err);
    return null;
  }
}
