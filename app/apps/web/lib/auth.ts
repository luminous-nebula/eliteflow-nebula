import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySessionToken } from './session';

const secret = (): string => process.env.APP_SECRET ?? '';

/** Returns the operator session payload, or null if unauthenticated. */
export async function getOperator(): Promise<{ sub: string } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(secret(), token);
}

/** Server-component guard: redirect to /login if not authenticated. */
export async function requireOperator(): Promise<void> {
  const session = await getOperator();
  if (!session) redirect('/login');
}
