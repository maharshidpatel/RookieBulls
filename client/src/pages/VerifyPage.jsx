/*
 * FILE: client/src/pages/VerifyPage.jsx
 *
 * RESPONSIBILITY:
 *   Handles the email verification link click.
 *   Mounted at /verify/:token — public route, no Layout, no nav.
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Auth state management (AuthContext handles that)
 *   - Token storage (this page does not log the user in)
 *
 * HOW IT FITS:
 *   User clicks the link in the verification email.
 *   Browser opens: http://localhost:5173/verify/<token>
 *   This page mounts, reads the token from the URL,
 *   calls GET /api/auth/verify/:token on mount,
 *   then renders one of four states based on the response.
 *
 * FOUR STATES:
 *   loading  — API call in flight
 *   success  — token valid, user is now verified
 *   expired  — token existed but is past 24h expiry
 *   invalid  — no user found with this token (used or never existed)
 *
 * RESEND:
 *   Expired and invalid states show an email input + resend button.
 *   Calls POST /api/auth/resend-verification on submit.
 *   Rate limited server-side — 3 attempts per hour per IP.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { verifyEmail, resendVerification } from '../services/auth';
import theme from '../styles/theme';

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

export default function VerifyPage() {
  /*
   * useParams reads URL parameters defined in the route.
   * Route defined as /verify/:token in App.jsx.
   * token here is the 64-char hex string from the email link.
   */
  const { token } = useParams();
  const navigate  = useNavigate();

  /*
   * status: 'loading' | 'success' | 'expired' | 'invalid'
   * Drives which UI state is rendered.
   */
  const [status, setStatus]           = useState('loading');
  const [resendEmail, setResendEmail] = useState('');
  const [resendState, setResendState] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'
  const [resendError, setResendError] = useState('');

  const [loginHovered,  loginHoverProps]  = useHover();
  const [resendHovered, resendHoverProps] = useHover();

  /*
   * Call the verify endpoint on mount.
   * useEffect with empty array runs once after the component renders.
   *
   * Three possible server responses:
   *   200 → status = 'success'
   *   400 → status = 'expired'  (token exists but past expiry)
   *   404 → status = 'invalid'  (no user has this token)
   */
  useEffect(() => {
    async function verify() {
      try {
        await verifyEmail(token);
        setStatus('success');
      } catch (err) {
        const httpStatus = err.response?.status;
        if (httpStatus === 400) {
          setStatus('expired');
        } else {
          setStatus('invalid');
        }
      }
    }

    verify();
  }, [token]);

  async function handleResend(e) {
    e.preventDefault();
    setResendState('sending');
    setResendError('');

    try {
      await resendVerification(resendEmail);
      setResendState('sent');
    } catch (err) {
      const msg = err.response?.data?.message;
      setResendError(msg || 'Failed to send. Please try again.');
      setResendState('error');
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>

        {/* ── Brand mark ──────────────────────────────────────── */}
        <div style={s.brandRow}>
          <div style={s.logoMark}>
            <span style={s.logoText}>RB</span>
          </div>
          <span style={s.brandName}>RookieBulls</span>
        </div>

        {/* ── State rendering ──────────────────────────────────── */}
        {status === 'loading' && <LoadingState />}
        {status === 'success' && (
          <SuccessState
            navigate={navigate}
            loginHovered={loginHovered}
            loginHoverProps={loginHoverProps}
          />
        )}
        {(status === 'expired' || status === 'invalid') && (
          <ResendState
            status={status}
            resendEmail={resendEmail}
            setResendEmail={setResendEmail}
            resendState={resendState}
            resendError={resendError}
            handleResend={handleResend}
            navigate={navigate}
            resendHovered={resendHovered}
            resendHoverProps={resendHoverProps}
            loginHovered={loginHovered}
            loginHoverProps={loginHoverProps}
          />
        )}

      </div>
    </div>
  );
}

// ── LOADING STATE ─────────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div style={s.stateBox}>
      <div style={s.spinner} />
      <p style={s.stateTitle}>Verifying your email...</p>
      <p style={s.stateSubtitle}>This will only take a moment.</p>
    </div>
  );
}

// ── SUCCESS STATE ─────────────────────────────────────────────────────────────
function SuccessState({ navigate, loginHovered, loginHoverProps }) {
  return (
    <div style={s.stateBox}>
      <div style={{ ...s.iconWrap, backgroundColor: theme.colors.successTint, border: `2px solid ${theme.colors.success}` }}>
        <span style={{ ...s.iconChar, color: theme.colors.success }}>✓</span>
      </div>

      <p style={s.stateTitle}>Email verified</p>
      <p style={s.stateSubtitle}>
        Your account is now active. You can log in and start trading.
      </p>

      <button
        onClick={() => navigate('/login')}
        style={{
          ...s.primaryBtn,
          ...(loginHovered ? s.primaryBtnHover : {}),
        }}
        {...loginHoverProps}
      >
        Go to Login
      </button>
    </div>
  );
}

// ── RESEND STATE ──────────────────────────────────────────────────────────────
//
// Shown for both 'expired' and 'invalid' — slightly different heading,
// same resend form below.
//
function ResendState({
  status, resendEmail, setResendEmail,
  resendState, resendError, handleResend,
  navigate, resendHovered, resendHoverProps,
  loginHovered, loginHoverProps,
}) {
  const isExpired = status === 'expired';

  /*
   * When resend succeeds, replace the entire state content
   * with the success view — do not show the error icon alongside it.
   */
  if (resendState === 'sent') {
    return (
      <div style={s.stateBox}>
        <div style={{
          ...s.iconWrap,
          backgroundColor: theme.colors.successTint,
          border: `2px solid ${theme.colors.success}`,
        }}>
          <span style={{ ...s.iconChar, color: theme.colors.success }}>✓</span>
        </div>

        <p style={s.stateTitle}>Verification email sent</p>
        <p style={s.stateSubtitle}>
          Check your inbox and click the new link to verify your account.
        </p>

        <button
          onClick={() => navigate('/login')}
          style={{
            ...s.secondaryBtn,
            ...(loginHovered ? s.secondaryBtnHover : {}),
            marginTop: theme.spacing[2],
          }}
          {...loginHoverProps}
        >
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <div style={s.stateBox}>
      <div style={{
        ...s.iconWrap,
        backgroundColor: '#fef2f2',
        border: `2px solid ${theme.colors.danger}`,
      }}>
        <span style={{ ...s.iconChar, color: theme.colors.danger }}>
          {isExpired ? '⏱' : '✕'}
        </span>
      </div>

      <p style={s.stateTitle}>
        {isExpired ? 'Link has expired' : 'Invalid link'}
      </p>
      <p style={s.stateSubtitle}>
        {isExpired
          ? 'Verification links are valid for 24 hours. Request a new one below.'
          : 'This link is invalid or has already been used. Request a new one below.'}
      </p>

      <form onSubmit={handleResend} style={s.resendForm}>
        <div style={s.field}>
          <label style={s.label}>Your email address</label>
          <input
            type="email"
            value={resendEmail}
            onChange={e => setResendEmail(e.target.value)}
            placeholder="you@example.com"
            required
            style={s.input}
          />
        </div>

        {resendError && (
          <p style={s.resendError}>{resendError}</p>
        )}

        <button
          type="submit"
          disabled={resendState === 'sending'}
          style={{
            ...s.primaryBtn,
            ...(resendHovered && resendState !== 'sending' ? s.primaryBtnHover : {}),
            opacity: resendState === 'sending' ? 0.75 : 1,
            cursor:  resendState === 'sending' ? 'not-allowed' : 'pointer',
          }}
          {...resendHoverProps}
        >
          {resendState === 'sending' ? 'Sending...' : 'Resend verification email'}
        </button>

        <button
          type="button"
          onClick={() => navigate('/login')}
          style={{
            ...s.secondaryBtn,
            ...(loginHovered ? s.secondaryBtnHover : {}),
          }}
          {...loginHoverProps}
        >
          Back to Login
        </button>
      </form>
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const s = {
  /*
   * Full-page centered layout.
   * No TopNav or SecondNav — this is a standalone public page.
   * Background matches the app background so it feels consistent.
   */
  page: {
    minHeight:       '100vh',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: theme.colors.background,
    fontFamily:      theme.font.family,
    padding:         theme.spacing[4],
  },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius:    theme.radius.lg,
    border:          `1px solid ${theme.colors.border}`,
    boxShadow:       theme.shadow.md,
    padding:         `${theme.spacing[8]} ${theme.spacing[8]}`,
    width:           '100%',
    maxWidth:        '440px',
    display:         'flex',
    flexDirection:   'column',
    gap:             theme.spacing[6],
  },

  // ── Brand row ──────────────────────────────────────────────
  brandRow: {
    display:    'flex',
    alignItems: 'center',
    gap:        theme.spacing[3],
  },

  logoMark: {
    width:           '36px',
    height:          '36px',
    borderRadius:    theme.radius.sm,
    backgroundColor: theme.colors.success,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },

  logoText: {
    fontSize:      theme.font.size.xs,
    fontWeight:    theme.font.weight.bold,
    color:         theme.colors.white,
    letterSpacing: '0.5px',
  },

  brandName: {
    fontSize:      theme.font.size.lg,
    fontWeight:    theme.font.weight.bold,
    color:         theme.colors.textPrimary,
    letterSpacing: '-0.3px',
  },

  // ── State box ──────────────────────────────────────────────
  stateBox: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           theme.spacing[3],
    textAlign:     'center',
  },

  iconWrap: {
    width:          '64px',
    height:         '64px',
    borderRadius:   theme.radius.full,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   theme.spacing[1],
  },

  iconChar: {
    fontSize:   '26px',
    fontWeight: theme.font.weight.bold,
    lineHeight:  1,
  },

  stateTitle: {
    margin:     0,
    fontSize:   theme.font.size.xl,
    fontWeight: theme.font.weight.bold,
    color:      theme.colors.textPrimary,
  },

  stateSubtitle: {
    margin:     0,
    fontSize:   theme.font.size.sm,
    color:      theme.colors.textSecondary,
    lineHeight: theme.font.lineHeight.normal,
    maxWidth:   '340px',
  },

  // ── Spinner ────────────────────────────────────────────────
  /*
   * Pure CSS spinner — no package needed.
   * border creates a circle, one side is transparent to create the gap.
   * Animation is defined in global.css @keyframes spin.
   * If spin is not in global.css yet, it is added in the note below.
   */
  spinner: {
    width:           '48px',
    height:          '48px',
    borderRadius:    theme.radius.full,
    border:          `3px solid ${theme.colors.border}`,
    borderTopColor:  theme.colors.success,
    animation:       'spin 0.8s linear infinite',
    marginBottom:    theme.spacing[1],
  },

  // ── Resend form ────────────────────────────────────────────
  resendForm: {
    display:       'flex',
    flexDirection: 'column',
    gap:           theme.spacing[3],
    width:         '100%',
    marginTop:     theme.spacing[1],
  },

  field: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '5px',
    textAlign:     'left',
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
  },

  resendError: {
    margin:     0,
    fontSize:   theme.font.size.xs,
    color:      theme.colors.danger,
    textAlign:  'left',
  },

  sentBox: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           theme.spacing[2],
    width:         '100%',
  },

  // ── Buttons ────────────────────────────────────────────────
  primaryBtn: {
    width:           '100%',
    height:          '44px',
    fontSize:        theme.font.size.sm,
    fontWeight:      theme.font.weight.semibold,
    backgroundColor: theme.colors.success,
    color:           theme.colors.white,
    border:          `2px solid ${theme.colors.success}`,
    borderRadius:    theme.radius.md,
    cursor:          'pointer',
    fontFamily:      'inherit',
    letterSpacing:   '0.01em',
    transition:      `all ${theme.transition.fast}`,
    marginTop:       theme.spacing[1],
  },

  primaryBtnHover: {
    backgroundColor: theme.colors.successTint,
    color:           theme.colors.successHover,
    border:          `2px solid ${theme.colors.successHover}`,
  },

  secondaryBtn: {
    width:           '100%',
    height:          '44px',
    fontSize:        theme.font.size.sm,
    fontWeight:      theme.font.weight.semibold,
    backgroundColor: 'transparent',
    color:           theme.colors.success,
    border:          `2px solid ${theme.colors.success}`,
    borderRadius:    theme.radius.md,
    cursor:          'pointer',
    fontFamily:      'inherit',
    letterSpacing:   '0.01em',
    transition:      `all ${theme.transition.fast}`,
  },

  secondaryBtnHover: {
    backgroundColor: theme.colors.successTint,
    color:           theme.colors.successHover,
    border:          `2px solid ${theme.colors.successHover}`,
  },
};