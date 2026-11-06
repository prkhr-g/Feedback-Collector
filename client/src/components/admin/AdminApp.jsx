import { useCallback, useEffect, useState } from 'react';
import AdminDashboard from './AdminDashboard.jsx';
import { AdminApiError, adminApi } from '../../services/adminApi.js';

function LoginPage({ onAuthenticated, notice = '' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      const result = await adminApi('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      onAuthenticated(result.admin);
    } catch (requestError) {
      setError(requestError.message || 'Sign in failed. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-login-page">
      <a className="admin-back-link" href="/">← Back to feedback form</a>
      <section className="login-card" aria-labelledby="admin-login-title">
        <div className="login-lock-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none"><rect x="4.5" y="10" width="15" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.6" /><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </div>
        <p className="admin-eyebrow">PENTHARA TECHNOLOGIES · FEEDBACK PORTAL</p>
        <h1 id="admin-login-title">Welcome back</h1>
        <p className="login-description">Sign in to review feedback and dashboard activity.</p>
        {(error || notice) && <p className="admin-alert" role="alert">{error || notice}</p>}
        <form onSubmit={submit}>
          <div className="admin-field">
            <label htmlFor="admin-email">Email address</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="admin-field">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <button className="admin-primary-button login-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
            {!isSubmitting && <span aria-hidden="true">→</span>}
          </button>
        </form>
        <p className="login-footnote">Access is limited to initialized administrator accounts.</p>
      </section>
    </main>
  );
}

export default function AdminApp() {
  const [admin, setAdmin] = useState(null);
  const [authState, setAuthState] = useState('checking');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    adminApi('/api/auth/me', { signal: controller.signal })
      .then((result) => {
        setAdmin(result.admin);
        setAuthState('authenticated');
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        if (error instanceof AdminApiError && error.status === 401) {
          setAuthState('unauthenticated');
          return;
        }
        setAuthError(error.message || 'Could not check your session.');
        setAuthState('error');
      });
    return () => controller.abort();
  }, []);

  const handleSessionExpired = useCallback(() => {
    setAdmin(null);
    setAuthState('unauthenticated');
    setAuthError('Your session ended. Sign in to continue.');
  }, []);

  if (authState === 'checking') {
    return <main className="admin-checking" role="status">Checking administrator session…</main>;
  }
  if (authState === 'error') {
    return (
      <main className="admin-login-page">
        <section className="login-card" role="alert">
          <h1>Unable to connect</h1>
          <p>{authError}</p>
          <button className="admin-secondary-button" onClick={() => window.location.reload()} type="button">Try again</button>
        </section>
      </main>
    );
  }
  if (authState === 'unauthenticated') {
    return <LoginPage notice={authError} onAuthenticated={(identity) => { setAdmin(identity); setAuthError(''); setAuthState('authenticated'); }} />;
  }
  return <AdminDashboard admin={admin} onSessionExpired={handleSessionExpired} />;
}
