import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const PROTECTED_ROUTES = new Set(['/dashboard', '/cozinha', '/balcao', '/despacho', '/oficina']);

async function fetchUser(access: string, req: NextRequest) {
  try {
    const checkUrl = new URL(`/api/users/check?access=${access}`, req.url);
    const response = await fetch(checkUrl, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    return (await response.json()) as { status?: number; type?: number } | null;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  const requiresAuth = PROTECTED_ROUTES.has(pathname) || isAdminRoute;
  const isEsperPage = pathname === '/espera';
  const isAuthPage = pathname === '/';

  if (!requiresAuth && !isEsperPage && !isAuthPage) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const access = typeof token?.access === 'string' ? token.access : '';
  if (!access) {
    if (requiresAuth || isEsperPage) {
      const loginUrl = new URL('/', req.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  const user = await fetchUser(access, req);
  if (!user) {
    const loginUrl = new URL('/', req.url);
    loginUrl.searchParams.set('session', 'expired');
    return NextResponse.redirect(loginUrl);
  }
  const status = Number(user.status ?? 0);
  const type = Number(user.type ?? 0);

  if (status === 2) {
    const blockedUrl = new URL('/', req.url);
    blockedUrl.searchParams.set('blocked', '1');
    return NextResponse.redirect(blockedUrl);
  }

  if (status === 0 && !isEsperPage) {
    const waitUrl = new URL('/espera', req.url);
    return NextResponse.redirect(waitUrl);
  }

  if (status === 1 && isEsperPage) {
    const dashUrl = new URL('/dashboard', req.url);
    return NextResponse.redirect(dashUrl);
  }

  if (requiresAuth && status !== 1) {
    const loginUrl = new URL('/', req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && type !== 10) {
    const dashUrl = new URL('/dashboard', req.url);
    return NextResponse.redirect(dashUrl);
  }

  if (isAuthPage && status === 1) {
    const dashUrl = new URL('/dashboard', req.url);
    return NextResponse.redirect(dashUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/dashboard',
    '/cozinha',
    '/balcao',
    '/despacho',
    '/oficina',
    '/espera',
    '/admin/:path*',
  ],
};
