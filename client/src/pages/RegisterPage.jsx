/*
 * FILE: client/src/pages/RegisterPage.jsx
 *
 * RESPONSIBILITY:
 *   Registration form UI.
 *   Collects email and password, submits to the auth service,
 *   handles success and error states.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Direct axios calls (use services/auth.js)
 *   - Token storage (handled in AuthContext — future step)
 *   - Business logic
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../services/auth';

export default function RegisterPage() {
  /*
   * Controlled form state.
   * Each input is tied to a state variable — React owns the values,
   * not the DOM. This is called a "controlled component."
   */
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  /*
   * loading: true while the API request is in flight.
   *   Disables the submit button to prevent duplicate submissions.
   *
   * error: string message shown when registration fails.
   *
   * fieldErrors: object of per-field messages from the validator.
   *   Example: { email: 'Must be a valid email address', password: '...' }
   */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  /*
   * useNavigate returns a function that redirects the user to a new route.
   * Called after successful registration to send the user to the login page.
   */
  const navigate = useNavigate();

  async function handleSubmit(e) {
    /*
     * e.preventDefault() stops the browser from doing a full page reload.
     * Without this, forms submit via the browser's native behavior
     * which refreshes the page and loses all React state.
     */
    e.preventDefault();

    setLoading(true);
    setError('');
    setFieldErrors({});

    try {
      await registerUser(email, password);
      /*
       * Registration succeeded.
       * Redirect to login page so the user can sign in with their new account.
       */
      navigate('/login');
    } catch (err) {
      /*
       * axios wraps server error responses in err.response.
       * err.response.data is the body the server sent back.
       *
       * Two error shapes to handle:
       *   422 — field-level validation errors (array of { field, message })
       *   409 — duplicate email (single message string)
       *   anything else — generic server error
       */
      const data = err.response?.data;

      if (err.response?.status === 422 && data?.errors) {
        /*
         * Convert the errors array into an object keyed by field name.
         * [ { field: 'email', message: '...' } ]
         * → { email: '...' }
         */
        const mapped = {};
        data.errors.forEach(({ field, message }) => {
          mapped[field] = message;
        });
        setFieldErrors(mapped);
      } else {
        setError(data?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      /*
       * finally runs whether the request succeeded or failed.
       * Always re-enable the submit button after the request completes.
       */
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Rookie Bulls</h1>
        <h2 style={styles.subtitle}>Create an account</h2>

        {/* General error message — shown for non-field errors like 409 */}
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
            {/* Field-level error — shown directly under the input */}
            {fieldErrors.email && (
              <p style={styles.fieldError}>{fieldErrors.email}</p>
            )}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="Minimum 8 characters"
              disabled={loading}
            />
            {fieldErrors.password && (
              <p style={styles.fieldError}>{fieldErrors.password}</p>
            )}
          </div>

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p style={styles.loginLink}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}

/*
 * Inline styles — minimal, functional.
 * No CSS framework needed for MVP.
 * Will be replaced with proper styling in a later phase.
 */
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
  fieldError: {
    color: '#c0392b',
    fontSize: '0.8rem',
    margin: '0',
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
  loginLink: {
    textAlign: 'center',
    marginTop: '1rem',
    fontSize: '0.9rem',
  },
};