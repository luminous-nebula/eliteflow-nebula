import { isPasswordSet } from '@eliteflow/db';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const exists = await isPasswordSet();
  return (
    <main className="auth">
      <h2>{exists ? 'Sign in' : 'Create operator password'}</h2>
      <p className="empty" style={{ marginTop: 0 }}>
        {exists
          ? 'Enter the operator password to access the dashboard.'
          : 'First run — set a password to protect this dashboard and the stored Claude credential.'}
      </p>
      <LoginForm bootstrap={!exists} />
    </main>
  );
}
