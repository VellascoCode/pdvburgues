import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const authSecret = process.env.NEXTAUTH_SECRET || 'pdvburgues-default-secret';

const ADMIN_ONLY = /^\/admin(\/.*)?$/;

function redirectTo(url: string, req: NextRequest, reason?: string) {
  const nextUrl = new URL(url, req.url);
  if (reason) nextUrl.searchParams.set(reason, '1');
  const res = NextResponse.redirect(nextUrl);
  res.cookies.delete('next-auth.session-token');
  res.cookies.delete('__Secure-next-auth.session-token');
  return res;
}

async function fetchUserMeta(access: string, req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/api/users/check';
  url.searchParams.set('access', access);
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) throw new Error('check-failed');
  return resp.json() as Promise<{ exists?: boolean; status?: number; type?: number }>;
}

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: authSecret });
  if (!token?.access) {
    return redirectTo('/', req, 'unauth');
  }
  let meta: { exists?: boolean; status?: number; type?: number };
  try {
    meta = await fetchUserMeta(String(token.access), req);
  } catch {
    return redirectTo('/', req, 'auth');
  }
  if (!meta?.exists) {
    return redirectTo('/', req, 'missing');
  }
  const status = Number(meta.status ?? 0);
  const type = Number(meta.type ?? 0);
  const pathname = req.nextUrl.pathname;
  if (status === 2) {
    return redirectTo('/', req, 'blocked');
  }
  if (status === 0 && !pathname.startsWith('/espera')) {
    return NextResponse.redirect(new URL('/espera', req.url));
  }
  if (status === 1 && pathname.startsWith('/espera')) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  if (ADMIN_ONLY.test(pathname) && type !== 10) {
    return NextResponse.redirect(new URL('/dashboard?denied=1', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/balcao/:path*',
    '/cozinha/:path*',
    '/despacho/:path*',
    '/oficina/:path*',
    '/espera',
  ],
};
