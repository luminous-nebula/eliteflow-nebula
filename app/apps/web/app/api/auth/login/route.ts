import { cookies } from 'next/headers';
import { isPasswordSet, setPassword, verifyPassword } from '@eliteflow/db';
import { createSessionToken, SESSION_COOKIE } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

/** Sign in. On first run (no password set yet) this bootstraps the operator password. */
export async function POST(req: Request): Promise<Response> {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password || typeof password !== 'string') {
    return Response.json({ error: 'password required' }, { status: 400 });
  }

  const exists = await isPasswordSet();
  if (!exists) {
    if (password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }
    await setPassword(password);
  } else if (!(await verifyPassword(password))) {
    return Response.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  const token = createSessionToken(process.env.APP_SECRET ?? '');
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 86400,
  });
  return Response.json({ ok: true, bootstrapped: !exists });
}
