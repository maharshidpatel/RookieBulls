/*
 * FILE: client/src/pages/RegisterPage.jsx
 *
 * RESPONSIBILITY:
 *   Registration form — two-column split layout.
 *   Left panel: imported from LoginPage (single source of truth).
 *   Right panel: firstName, lastName, email, password, confirmPassword.
 *
 * HOVER EFFECTS:
 *   Submit button  — filled green → inverts white on hover
 *   Login button   — outlined green → fills green on hover
 *   Go to Login    — outlined green → fills green on hover (success state)
 */

import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { registerUser } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import theme from '../styles/theme';
import { LeftPanel, Field } from './LoginPage';

function useHover() {
  const [hovered, setHovered] = useState(false);
  return [
    hovered,
    {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
    },
  ];
}

export default function RegisterPage() {
  const [firstName, setFirstName]             = useState('');
  const [lastName, setLastName]               = useState('');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');
  const [fieldErrors, setFieldErrors]         = useState({});
  const [success, setSuccess]                 = useState(false);

  const [submitHovered,  submitHoverProps]  = useHover();
  const [loginHovered,   loginHoverProps]   = useHover();
  const [goLoginHovered, goLoginHoverProps] = useHover();

  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) return <Navigate to="/summary" replace />;

  function validateClient() {
    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match' });
      return false;
    }
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    if (!validateClient()) return;
    setLoading(true);

    try {
      await registerUser(firstName, lastName, email, password);
      setSuccess(true);
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 422 && data?.errors) {
        const mapped = {};
        data.errors.forEach(({ field, message }) => {
          mapped[field] = message;
        });
        setFieldErrors(mapped);
      } else {
        setError(data?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      <LeftPanel />

      <div style={s.right}>
        <div style={s.formBox}>

          {success ? (
            /*
             * SUCCESS STATE
             * Shown after registration — user must verify email before login.
             * "Go to Login" is large and full-width — the clear next step.
             */
            <div style={s.successCard}>
              <div style={s.successIconWrap}>
                <span style={s.successCheck}>✓</span>
              </div>

              <h2 style={s.successHeading}>Check your email</h2>

              <p style={s.successText}>
                We sent a verification link to{' '}
                <strong style={{ color: theme.colors.textPrimary }}>{email}</strong>.
                Click it to activate your account.
              </p>

              <p style={s.successHint}>
                Link expires in 24 hours. Check spam if you do not see it.
              </p>

              {/*
               * Full-width — unmissable next action.
               * Outlined default, fills on hover.
               */}
              <button
                onClick={() => navigate('/login')}
                style={{
                  ...s.goLoginBtn,
                  ...(goLoginHovered ? s.goLoginBtnHover : {}),
                }}
                {...goLoginHoverProps}
              >
                Go to Login
              </button>
            </div>

          ) : (
            <>
              <div style={s.formHeader}>
                <h1 style={s.heading}>Create your account</h1>
                <p style={s.subheading}>
                  Start with $100,000 in virtual credits — no real money needed
                </p>
              </div>

              {error && (
                <div style={s.errorBanner}>
                  <span style={s.errorIcon}>!</span>
                  <p style={s.errorText}>{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} style={s.form}>

                <div style={s.nameRow}>
                  <Field
                    label="First name"
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Jane"
                    disabled={loading}
                    error={fieldErrors.firstName}
                  />
                  <Field
                    label="Last name"
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Smith"
                    disabled={loading}
                    error={fieldErrors.lastName}
                  />
                </div>

                <Field
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={loading}
                  error={fieldErrors.email}
                />

                <Field
                  label="Password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimum 10 characters"
                  disabled={loading}
                  error={fieldErrors.password}
                />

                <Field
                  label="Confirm password"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  disabled={loading}
                  error={fieldErrors.confirmPassword}
                />

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    ...s.submitBtn,
                    ...(submitHovered && !loading ? s.submitBtnHover : {}),
                    opacity: loading ? 0.75 : 1,
                    cursor:  loading ? 'not-allowed' : 'pointer',
                  }}
                  {...submitHoverProps}
                >
                  {loading ? 'Creating account...' : 'Create account'}
                </button>

              </form>

              <div style={s.divider}>
                <span style={s.dividerLine} />
                <span style={s.dividerText}>Already have an account?</span>
                <span style={s.dividerLine} />
              </div>

              <Link
                to="/login"
                style={{
                  ...s.loginBtn,
                  ...(loginHovered ? s.loginBtnHover : {}),
                }}
                {...loginHoverProps}
              >
                Log in
              </Link>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

const s = {
  page: {
    display:    'flex',
    minHeight:  '100vh',
    fontFamily: theme.font.family,
  },

  right: {
    flex:            1,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         '2rem',
    backgroundColor: theme.colors.background,
  },

  formBox: {
    width:         '100%',
    maxWidth:      '440px',
    display:       'flex',
    flexDirection: 'column',
    gap:           theme.spacing[5],
  },

  formHeader: {
    marginBottom: theme.spacing[1],
  },

  heading: {
    margin:        '0 0 6px 0',
    fontSize:      theme.font.size['2xl'],
    fontWeight:    theme.font.weight.bold,
    color:         theme.colors.textPrimary,
    letterSpacing: '-0.3px',
  },

  subheading: {
    margin:   0,
    fontSize: theme.font.size.sm,
    color:    theme.colors.textSecondary,
  },

  errorBanner: {
    display:         'flex',
    alignItems:      'flex-start',
    gap:             theme.spacing[3],
    backgroundColor: '#fef2f2',
    border:          '1px solid #fecaca',
    borderRadius:    theme.radius.md,
    padding:         `${theme.spacing[3]} ${theme.spacing[4]}`,
  },

  errorIcon: {
    width:           '20px',
    height:          '20px',
    borderRadius:    theme.radius.full,
    backgroundColor: theme.colors.danger,
    color:           theme.colors.white,
    fontSize:        '11px',
    fontWeight:      theme.font.weight.bold,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
    textAlign:       'center',
    lineHeight:      '20px',
  },

  errorText: {
    margin:     0,
    fontSize:   theme.font.size.sm,
    color:      theme.colors.danger,
    fontWeight: theme.font.weight.medium,
  },

  form: {
    display:       'flex',
    flexDirection: 'column',
    gap:           theme.spacing[4],
  },

  nameRow: {
    display: 'flex',
    gap:     theme.spacing[3],
  },

  submitBtn: {
    height:          '44px',
    width:           '100%',
    fontSize:        theme.font.size.sm,
    fontWeight:      theme.font.weight.semibold,
    backgroundColor: theme.colors.success,
    color:           theme.colors.white,
    border:          `2px solid ${theme.colors.success}`,
    borderRadius:    theme.radius.md,
    cursor:          'pointer',
    fontFamily:      'inherit',
    marginTop:       theme.spacing[1],
    letterSpacing:   '0.01em',
    transition:      `all ${theme.transition.fast}`,
  },

  submitBtnHover: {
    backgroundColor: theme.colors.white,
    color:           theme.colors.success,
    boxShadow:       theme.shadow.sm,
  },

  divider: {
    display:    'flex',
    alignItems: 'center',
    gap:        theme.spacing[3],
  },

  dividerLine: {
    flex:            1,
    height:          '1px',
    backgroundColor: theme.colors.border,
  },

  dividerText: {
    fontSize:      theme.font.size.xs,
    color:         theme.colors.textMuted,
    whiteSpace:    'nowrap',
    fontWeight:    theme.font.weight.medium,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },

  loginBtn: {
    display:         'block',
    height:          '44px',
    lineHeight:      '40px',
    textAlign:       'center',
    fontSize:        theme.font.size.sm,
    fontWeight:      theme.font.weight.semibold,
    color:           theme.colors.success,
    border:          `2px solid ${theme.colors.success}`,
    borderRadius:    theme.radius.md,
    textDecoration:  'none',
    letterSpacing:   '0.01em',
    backgroundColor: 'transparent',
    transition:      `all ${theme.transition.fast}`,
  },

  /*
   * Secondary button hover — light green tint, matches SecondNav buyBtnHover.
   */
  loginBtnHover: {
    backgroundColor: theme.colors.successTint,
    color:           theme.colors.successHover,
    border:          `2px solid ${theme.colors.successHover}`,
  },

  // ── Success card ─────────────────────────────────────────────
  successCard: {
    backgroundColor: theme.colors.surface,
    borderRadius:    theme.radius.lg,
    border:          `1px solid ${theme.colors.border}`,
    boxShadow:       theme.shadow.md,
    padding:         theme.spacing[8],
    textAlign:       'center',
    display:         'flex',
    flexDirection:   'column',
    alignItems:      'center',
    gap:             theme.spacing[4],
  },

  successIconWrap: {
    width:           '60px',
    height:          '60px',
    borderRadius:    theme.radius.full,
    backgroundColor: theme.colors.successTint,
    border:          `2px solid ${theme.colors.success}`,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
  },

  successCheck: {
    fontSize:   '26px',
    color:      theme.colors.success,
    fontWeight: theme.font.weight.bold,
    lineHeight: 1,
  },

  successHeading: {
    margin:     0,
    fontSize:   theme.font.size.xl,
    fontWeight: theme.font.weight.bold,
    color:      theme.colors.textPrimary,
  },

  successText: {
    margin:     0,
    fontSize:   theme.font.size.sm,
    color:      theme.colors.textSecondary,
    lineHeight: theme.font.lineHeight.normal,
  },

  successHint: {
    margin:     0,
    fontSize:   theme.font.size.xs,
    color:      theme.colors.textMuted,
    lineHeight: theme.font.lineHeight.normal,
  },

  /*
   * Go to Login — full card width, prominent height.
   * The only action on the success card — cannot be missed.
   * Outlined default, fills green on hover.
   */
  goLoginBtn: {
    width:           '100%',
    height:          '48px',
    fontSize:        theme.font.size.md,
    fontWeight:      theme.font.weight.semibold,
    color:           theme.colors.success,
    backgroundColor: 'transparent',
    border:          `2px solid ${theme.colors.success}`,
    borderRadius:    theme.radius.md,
    cursor:          'pointer',
    fontFamily:      'inherit',
    letterSpacing:   '0.01em',
    transition:      `all ${theme.transition.fast}`,
    marginTop:       theme.spacing[2],
  },

  goLoginBtnHover: {
    backgroundColor: theme.colors.success,
    color:           theme.colors.white,
  },
};