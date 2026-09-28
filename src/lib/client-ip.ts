import 'server-only';
import { headers } from 'next/headers';

/**
 * The visitor's IP, for rate limiting. Kept out of any 'use server' file:
 * every export of one of those becomes an endpoint the browser can call.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  // Vercel sets x-forwarded-for; the first entry is the client.
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
}
