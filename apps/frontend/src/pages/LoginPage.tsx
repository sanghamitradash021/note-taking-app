import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../lib/auth.js';
import { useAuthStore } from '../stores/authStore.js';
import { ApiError } from '../lib/apiClient.js';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      setAuth(data.accessToken, data.refreshToken, data.user);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>NoteApp</h1>
        <h2 style={styles.subtitle}>Sign in</h2>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Email
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label style={styles.label}>
            Password
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p style={styles.link}>
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f5',
  } as React.CSSProperties,
  card: {
    background: '#fff',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '360px',
  } as React.CSSProperties,
  title: { margin: '0 0 0.25rem', fontSize: '1.5rem', textAlign: 'center' } as React.CSSProperties,
  subtitle: {
    margin: '0 0 1.5rem',
    fontSize: '1rem',
    textAlign: 'center',
    color: '#666',
  } as React.CSSProperties,
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' } as React.CSSProperties,
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    fontSize: '0.875rem',
  } as React.CSSProperties,
  input: {
    padding: '0.5rem',
    borderRadius: '4px',
    border: '1px solid #ccc',
    fontSize: '1rem',
  } as React.CSSProperties,
  error: { color: '#c00', margin: 0, fontSize: '0.875rem' } as React.CSSProperties,
  btn: {
    padding: '0.625rem',
    background: '#1a1a1a',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1rem',
    cursor: 'pointer',
  } as React.CSSProperties,
  link: { textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem' } as React.CSSProperties,
};
