/*
 * FILE: client/src/pages/LoginPage.jsx
 *
 * RESPONSIBILITY:
 *   Login form UI.
 *   Collects email and password, submits to the auth service,
 *   handles success and error states.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Direct axios calls (services/auth.js handles that)
 *   - Token storage logic (AuthContext handles that — step 2.10)
 *
 * NOTE:
 *   On successful login, tokens are passed up to AuthContext.
 *   For now, we log the result to the console to confirm it works.
 *   AuthContext in 2.10 will replace that temporary behavior.
 */

import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { loginUser } from '../services/auth';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await loginUser(email, password);
      /*
       * Temporary: log the result to confirm tokens are returned.
       * This will be replaced in 2.10 when AuthContext stores the tokens
       * and redirects the user to the dashboard.
       */
      
      // Pass all three — user, access token, and refresh token.
      // AuthContext stores all of them in sessionStorage.
      login(result.data.user, result.data.accessToken, result.data.refreshToken);
      navigate('/dashboard');
    
    } catch (err) {
      const data = err.response?.data;
      setError(data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Rookie Bulls</h1>
        <h2 style={styles.subtitle}>Log in to your account</h2>

        {error && <p style={styles.errorBanner}>{error}</p>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="Your password"
              disabled={loading}
            />
          </div>

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p style={styles.registerLink}>
          Do not have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: '#fff',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '400px',
  },
  title: {
    margin: '0 0 0.25rem',
    fontSize: '1.5rem',
  },
  subtitle: {
    margin: '0 0 1.5rem',
    fontSize: '1rem',
    fontWeight: 'normal',
    color: '#555',
  },
  errorBanner: {
    color: '#c0392b',
    backgroundColor: '#fdecea',
    padding: '0.75rem',
    borderRadius: '4px',
    marginBottom: '1rem',
    fontSize: '0.9rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  label: {
    fontSize: '0.9rem',
    fontWeight: '500',
  },
  input: {
    padding: '0.6rem 0.75rem',
    fontSize: '1rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
  },
  button: {
    padding: '0.75rem',
    fontSize: '1rem',
    backgroundColor: '#2c3e50',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  registerLink: {
    textAlign: 'center',
    marginTop: '1rem',
    fontSize: '0.9rem',
  },
};