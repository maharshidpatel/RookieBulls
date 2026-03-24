/*
 * FILE: client/src/pages/LoginPage.jsx
 *
 * RESPONSIBILITY:
 *   Login form — two-column split layout.
 *   Left panel: branding (exported as LeftPanel, reused by RegisterPage).
 *   Right panel: email + password form.
 *
 * HOVER EFFECTS:
 *   Submit button   — filled green → inverts white on hover
 *   Register button — outlined green → fills green on hover
 *
 * MOBILE (< 768px):
 *   Layout stacks vertically — form on top, branding panel below.
 *   LeftPanel uses full width with reduced padding.
 */

import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { loginUser, resendVerification } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useMobile } from '../hooks/useBreakpoint';

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

export default function LoginPage() {
  const theme    = useTheme();
  const isMobile = useMobile();

  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [isUnverified, setIsUnverified]   = useState(false);
  const [resendStatus, setResendStatus]   = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  const [submitHovered,   submitHoverProps]   = useHover();
  const [registerHovered, registerHoverProps] = useHover();

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) return <Navigate to="/summary" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setIsUnverified(false);
    setResendStatus('');

    try {
      const result = await loginUser(email, password);
      login(result.data.user, result.data.accessToken, result.data.refreshToken);
      navigate('/summary');
    } catch (err) {
      const status = err.response?.status;
      const data   = err.response?.data;
      if (status === 403) {
        setIsUnverified(true);
        setError(data?.message || 'Please verify your email before logging in.');
      } else {
        setError(data?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendLoading(true);
    setResendStatus('');
    try {
      await resendVerification(email);
      setResendStatus('sent');
    } catch (err) {
      setResendStatus(err.response?.data?.message || 'Failed to send. Try again.');
    } finally {
      setResendLoading(false);
    }
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  //
  // Inside component body so they read the current theme from useTheme().
  //
  const s = {
    /*
     * Two-column layout on desktop, stacked on mobile.
     * column-reverse on mobile: form appears first (top), branding below.
     */
    page: {
      display:       'flex',
      flexDirection: isMobile ? 'column-reverse' : 'row',
      minHeight:     '100vh',
      fontFamily:    theme.font.family,
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
      maxWidth:      '420px',
      display:       'flex',
      flexDirection: 'column',
      gap:           theme.spacing[5],
    },

    formHeader: {
      marginBottom: theme.spacing[2],
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
      gap:             theme.spacing[3],
      backgroundColor: theme.colors.dangerTint,
      border:          `1px solid ${theme.colors.danger}`,
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

    errorContent: { flex: 1 },

    errorText: {
      margin:     '0 0 4px 0',
      fontSize:   theme.font.size.sm,
      color:      theme.colors.danger,
      fontWeight: theme.font.weight.medium,
    },

    resendRow: { marginTop: theme.spacing[2] },

    resendBtn: {
      fontSize:     theme.font.size.xs,
      fontWeight:   theme.font.weight.medium,
      color:        theme.colors.danger,
      background:   'none',
      border:       `1px solid ${theme.colors.danger}`,
      borderRadius: theme.radius.sm,
      padding:      '3px 10px',
      cursor:       'pointer',
      fontFamily:   'inherit',
    },

    resendSuccess: {
      margin:     0,
      fontSize:   theme.font.size.xs,
      color:      theme.colors.success,
      fontWeight: theme.font.weight.medium,
    },

    resendError: {
      margin:   '4px 0 0 0',
      fontSize: theme.font.size.xs,
      color:    theme.colors.danger,
    },

    form: {
      display:       'flex',
      flexDirection: 'column',
      gap:           theme.spacing[4],
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
      border:          `2px solid ${theme.colors.success}`,
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

    registerBtn: {
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
    registerBtnHover: {
      backgroundColor: theme.colors.successTint,
      color:           theme.colors.successHover,
      border:          `2px solid ${theme.colors.successHover}`,
    },
  };

  return (
    <div style={s.page}>
      <LeftPanel />

      <div style={s.right}>
        <div style={s.formBox}>

          <div style={s.formHeader}>
            <h1 style={s.heading}>Welcome back</h1>
            <p style={s.subheading}>Log in to your account to continue</p>
          </div>

          {error && (
            <div style={s.errorBanner}>
              <span style={s.errorIcon}>!</span>
              <div style={s.errorContent}>
                <p style={s.errorText}>{error}</p>
                {isUnverified && (
                  <div style={s.resendRow}>
                    {resendStatus === 'sent' ? (
                      <p style={s.resendSuccess}>
                        Verification email sent — check your inbox.
                      </p>
                    ) : (
                      <button
                        onClick={handleResend}
                        disabled={resendLoading}
                        style={s.resendBtn}
                      >
                        {resendLoading ? 'Sending...' : 'Resend verification email'}
                      </button>
                    )}
                    {resendStatus && resendStatus !== 'sent' && (
                      <p style={s.resendError}>{resendStatus}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={s.form}>
            <Field
              label="Email address"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={loading}
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
              disabled={loading}
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
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          <div style={s.divider}>
            <span style={s.dividerLine} />
            <span style={s.dividerText}>New to RookieBulls?</span>
            <span style={s.dividerLine} />
          </div>

          <Link
            to="/register"
            style={{
              ...s.registerBtn,
              ...(registerHovered ? s.registerBtnHover : {}),
            }}
            {...registerHoverProps}
          >
            Create a free account
          </Link>

        </div>
      </div>
    </div>
  );
}


/*
 * FIELD — reusable labeled input.
 * Exported so RegisterPage can import and use it directly.
 */
export function Field({ label, type, value, onChange, placeholder, disabled, error }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const s = {
    field: {
      display:       'flex',
      flexDirection: 'column',
      gap:           '5px',
    },
    label: {
      fontSize:   theme.font.size.sm,
      fontWeight: theme.font.weight.medium,
      color:      theme.colors.textPrimary,
    },
    input: {
      height:          theme.ui.inputHeight,
      padding:         `0 ${theme.spacing[3]}`,
      fontSize:        theme.font.size.sm,
      border:          `1px solid ${theme.colors.border}`,
      borderRadius:    theme.radius.md,
      outline:         'none',
      color:           theme.colors.textPrimary,
      backgroundColor: theme.colors.surface,
      fontFamily:      'inherit',
      width:           '100%',
      transition:      `border-color ${theme.transition.fast}, box-shadow ${theme.transition.fast}`,
    },
    fieldError: {
      margin:   0,
      fontSize: theme.font.size.xs,
      color:    theme.colors.danger,
    },
  };

  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...s.input,
          borderColor: error
            ? theme.colors.danger
            : focused
            ? theme.colors.success
            : theme.colors.border,
          boxShadow: focused && !error
            ? `0 0 0 3px ${theme.colors.successTint}`
            : 'none',
        }}
      />
      {error && <p style={s.fieldError}>{error}</p>}
    </div>
  );
}


/*
 * LEFT PANEL — exported and reused by RegisterPage.
 *
 * Desktop: fixed 42% width, vertically centered branding.
 * Mobile:  full width, stacked below the form (parent uses column-reverse).
 *          Reduced padding and smaller brand name for compact display.
 */
export function LeftPanel() {
  const theme    = useTheme();
  const isMobile = useMobile();

  const s = {
    left: {
      flex:            isMobile ? undefined : '0 0 42%',
      width:           isMobile ? '100%' : undefined,
      backgroundColor: theme.colors.success,
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      padding:         isMobile ? '2rem 1.5rem' : '3rem 2.5rem',
    },

    brand: {
      color:    theme.colors.white,
      maxWidth: '340px',
      width:    '100%',
    },

    logoMark: {
      width:           '52px',
      height:          '52px',
      borderRadius:    theme.radius.md,
      backgroundColor: 'rgba(255,255,255,0.15)',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      marginBottom:    theme.spacing[4],
      border:          '1px solid rgba(255,255,255,0.25)',
    },

    logoText: {
      fontSize:      theme.font.size.lg,
      fontWeight:    theme.font.weight.bold,
      color:         theme.colors.white,
      letterSpacing: '0.5px',
    },

    brandName: {
      fontSize:      isMobile ? '2rem' : '2.75rem',
      fontWeight:    theme.font.weight.bold,
      margin:        '0 0 8px 0',
      letterSpacing: '-1px',
      lineHeight:    1.1,
    },

    tagline: {
      fontSize:   theme.font.size.md,
      margin:     '0 0 2.5rem 0',
      opacity:    0.85,
      lineHeight: theme.font.lineHeight.normal,
      fontWeight: theme.font.weight.medium,
    },

    bullets: {
      display:       'flex',
      flexDirection: 'column',
      gap:           theme.spacing[4],
      marginBottom:  theme.spacing[8],
    },

    bullet: {
      display:    'flex',
      alignItems: 'flex-start',
      gap:        theme.spacing[3],
    },

    bulletIcon: {
      width:           '28px',
      height:          '28px',
      borderRadius:    theme.radius.sm,
      backgroundColor: 'rgba(255,255,255,0.18)',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      fontSize:        theme.font.size.sm,
      fontWeight:      theme.font.weight.bold,
      flexShrink:      0,
      textAlign:       'center',
      lineHeight:      '28px',
    },

    bulletText: {
      fontSize:   theme.font.size.sm,
      opacity:    0.9,
      lineHeight: theme.font.lineHeight.normal,
      paddingTop: '4px',
    },

    disclaimer: {
      fontSize:      theme.font.size.xs,
      opacity:       0.6,
      borderTop:     '1px solid rgba(255,255,255,0.2)',
      paddingTop:    theme.spacing[4],
      letterSpacing: '0.02em',
      textTransform: 'uppercase',
    },
  };

  return (
    <div style={s.left}>
      <div style={s.brand}>

        <div style={s.logoMark}>
          <span style={s.logoText}>RB</span>
        </div>

        <p style={s.brandName}>RookieBulls</p>
        <p style={s.tagline}>Learn to trade. Risk nothing.</p>

        <div style={s.bullets}>
          {[
            { icon: '$', text: '$100,000 virtual credits on signup' },
            { icon: '~', text: 'Real delayed market data — NYSE & NASDAQ' },
            { icon: '↑', text: 'Track portfolio performance over time' },
          ].map(({ icon, text }) => (
            <div key={text} style={s.bullet}>
              <span style={s.bulletIcon}>{icon}</span>
              <span style={s.bulletText}>{text}</span>
            </div>
          ))}
        </div>

        <div style={s.disclaimer}>
          Simulation only. No real money involved.
        </div>

      </div>
    </div>
  );
}