import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next 16 renamed middleware -> proxy.
 *
 * This is a fast UX redirect only. It checks that a session cookie is PRESENT,
 * not that it is valid: validating it here would put the session secret in the
 * proxy runtime for no security benefit, because every page and route handler
 * independently verifies the session server-side via requireHousehold() /
 * requireParentPin(). Treat this file as a convenience, never as the gate.
 */

/** Reachable without the household passcode. */
const PUBLIC_PATHS = ['/lock', '/setup', '/api/health'];

/**
 * Never redirect an asset request. A redirect returns HTML, so a redirected
 * stylesheet or script arrives as "<" and the whole page renders unstyled -
 * which is exactly what happened before this guard existed. The `matcher`
 * below should also exclude these, but this check is the one that is relied on.
 */
function isAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.webmanifest' ||
    /\.[a-z0-9]+$/i.test(pathname)
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  let response: NextResponse;
  if (isAsset(pathname) || PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    response = NextResponse.next();
  } else if (request.cookies.has('fd_session')) {
    response = NextResponse.next();
  } else {
    response = NextResponse.redirect(
      new URL(`/lock?next=${encodeURIComponent(pathname + search)}`, request.url),
    );
  }

  // Private household app. Never index, on any route.
  response.headers.set('x-robots-tag', 'noindex, nofollow, noarchive, nosnippet');
  return response;
}

export const proxyConfig = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
