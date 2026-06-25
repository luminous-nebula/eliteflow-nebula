import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.redirect(new URL('/login', req.url));
}
