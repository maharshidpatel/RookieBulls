/*
 * FILE: client/src/pages/ProfilePage.jsx
 *
 * RESPONSIBILITY:
 *   Displays and allows editing of the authenticated user's profile.
 *   Three sections:
 *     1. Header   — read-only identity summary
 *     2. Personal — editable profile fields, single Save button
 *     3. Password — change password form, separate Save button
 *
 * WHAT DOES NOT BELONG HERE:
 *   - Direct axios calls (services/user.js handles those)
 *   - Auth state (AuthContext handles that)
 *
 * HOW IT FITS:
 *   Protected route inside Layout — TopNav and SecondNav are visible.
 *   On successful firstName/lastName update, calls AuthContext.updateUser()
 *   so TopNav reflects the new name immediately without re-login.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getProfile, updateProfile, changePassword } from '../services/user';
import { useTheme } from '../context/ThemeContext';
import countries from '../data/countries';

/*
 * useHover — same pattern as login/register pages.
 * Inline styles cannot use :hover pseudo-class.
 */
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

/*
 * UserIcon — same SVG as TopNav for visual consistency.
 */
const UserIcon = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

export default function ProfilePage() {
  const theme = useTheme();
  const { updateUser } = useAuth();

  // ── Profile form state ───────────────────────────────────────
  const [profile, setProfile] = useState({
    firstName:   '',
    lastName:    '',
    displayName: '',
    country:     '',
    phone:       '',
    bio:         '',
  });

  // ── Header data (read only) ──────────────────────────────────
  const [headerData, setHeaderData] = useState({
    email:      '',
    createdAt:  '',
    isVerified: false,
  });

  // ── UI state ─────────────────────────────────────────────────
  const [profileLoading,  setProfileLoading]  = useState(true);
  const [profileSaving,   setProfileSaving]   = useState(false);
  const [profileMsg,      setProfileMsg]      = useState({ type: '', text: '' });
  const [profileErrors,   setProfileErrors]   = useState({});

  const [pwForm, setPwForm] = useState({
    currentPassword:  '',
    newPassword:      '',
    confirmPassword:  '',
  });
  const [pwSaving,  setPwSaving]  = useState(false);
  const [pwMsg,     setPwMsg]     = useState({ type: '', text: '' });
  const [pwErrors,  setPwErrors]  = useState({});

  const [profileSaveHovered, profileSaveHoverProps] = useHover();
  const [pwSaveHovered,      pwSaveHoverProps]      = useHover();

  // ── Load profile on mount ────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const result = await getProfile();
        const u = result.data.user;
        setProfile({
          firstName:   u.firstName   || '',
          lastName:    u.lastName    || '',
          displayName: u.displayName || '',
          country:     u.country     || '',
          phone:       u.phone       || '',
          bio:         u.bio         || '',
        });
        setHeaderData({
          email:      u.email,
          createdAt:  u.createdAt,
          isVerified: u.isVerified,
        });
      } catch {
        setProfileMsg({ type: 'error', text: 'Failed to load profile.' });
      } finally {
        setProfileLoading(false);
      }
    }
    load();
  }, []);

  // ── Save profile ─────────────────────────────────────────────
  async function handleProfileSave(e) {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });
    setProfileErrors({});
    setProfileSaving(true);

    try {
      const result = await updateProfile(profile);
      const updated = result.data.user;

      setProfile({
        firstName:   updated.firstName   || '',
        lastName:    updated.lastName    || '',
        displayName: updated.displayName || '',
        country:     updated.country     || '',
        phone:       updated.phone       || '',
        bio:         updated.bio         || '',
      });

      /*
       * Sync firstName/lastName into AuthContext so TopNav
       * reflects the new name immediately — no re-login needed.
       */
      updateUser({
        firstName: updated.firstName,
        lastName:  updated.lastName,
      });

      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 422 && data?.errors) {
        const mapped = {};
        data.errors.forEach(({ field, message }) => { mapped[field] = message; });
        setProfileErrors(mapped);
      } else {
        setProfileMsg({ type: 'error', text: data?.message || 'Failed to save profile.' });
      }
    } finally {
      setProfileSaving(false);
    }
  }

  // ── Save password ────────────────────────────────────────────
  async function handlePasswordSave(e) {
    e.preventDefault();
    setPwMsg({ type: '', text: '' });
    setPwErrors({});

    /*
     * Client-side confirm check before hitting the server.
     * Server also validates this — double protection.
     */
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    setPwSaving(true);

    try {
      await changePassword(pwForm);
      setPwMsg({ type: 'success', text: 'Password updated successfully.' });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 422 && data?.errors) {
        const mapped = {};
        data.errors.forEach(({ field, message }) => { mapped[field] = message; });
        setPwErrors(mapped);
      } else {
        setPwMsg({ type: 'error', text: data?.message || 'Failed to update password.' });
      }
    } finally {
      setPwSaving(false);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────
  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  // ── STYLES ─────────────────────────────────────────────────────────────────
const s = {
  page: {
    padding:   `${theme.spacing[6]} ${theme.spacing[6]}`,
    minHeight: '100%',
  },

  inner: {
    maxWidth:      '680px',
    margin:        '0 auto',
    display:       'flex',
    flexDirection: 'column',
    gap:           theme.spacing[5],
  },

  loadingWrap: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    minHeight:      '300px',
  },

  spinner: {
    width:          '40px',
    height:         '40px',
    borderRadius:   theme.radius.full,
    border:         `3px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.accent,
    animation:      'spin 0.8s linear infinite',
  },

  // ── Card ────────────────────────────────────────────────────
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius:    theme.radius.lg,
    border:          `1px solid ${theme.colors.border}`,
    boxShadow:       theme.shadow.sm,
    padding:         theme.spacing[6],
  },

  // ── Header section ──────────────────────────────────────────
  headerRow: {
    display:    'flex',
    alignItems: 'center',
    gap:        theme.spacing[5],
  },

  avatarWrap: {
    width:           '72px',
    height:          '72px',
    borderRadius:    theme.radius.full,
    backgroundColor: theme.colors.accentTint,
    border:          `2px solid ${theme.colors.accent}`,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    color:           theme.colors.accent,
    flexShrink:      0,
  },

  headerInfo: {
    flex: 1,
  },

  headerName: {
    margin:     '0 0 4px 0',
    fontSize:   theme.font.size.xl,
    fontWeight: theme.font.weight.bold,
    color:      theme.colors.textPrimary,
  },

  headerEmail: {
    margin:   '0 0 8px 0',
    fontSize: theme.font.size.sm,
    color:    theme.colors.textSecondary,
  },

  headerMeta: {
    display:    'flex',
    alignItems: 'center',
    gap:        theme.spacing[3],
    flexWrap:   'wrap',
  },

  metaItem: {
    fontSize: theme.font.size.xs,
    color:    theme.colors.textMuted,
  },

  verifiedBadge: {
    fontSize:        theme.font.size.xs,
    fontWeight:      theme.font.weight.semibold,
    color:           theme.colors.statusOpenText,
    backgroundColor: theme.colors.statusOpenBg,
    border:          `1px solid ${theme.colors.statusOpenBorder}`,
    borderRadius:    theme.radius.full,
    padding:         `2px ${theme.spacing[2]}`,
  },

  unverifiedBadge: {
    fontSize:        theme.font.size.xs,
    fontWeight:      theme.font.weight.semibold,
    color:           theme.colors.statusClosedText,
    backgroundColor: theme.colors.statusClosedBg,
    border:          `1px solid ${theme.colors.statusClosedBorder}`,
    borderRadius:    theme.radius.full,
    padding:         `2px ${theme.spacing[2]}`,
  },

  // ── Section titles ──────────────────────────────────────────
  sectionTitle: {
    margin:     '0 0 4px 0',
    fontSize:   theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
    color:      theme.colors.textPrimary,
  },

  sectionSubtitle: {
    margin:        '0 0 20px 0',
    fontSize:      theme.font.size.sm,
    color:         theme.colors.textSecondary,
    paddingBottom: theme.spacing[4],
    borderBottom:  `1px solid ${theme.colors.border}`,
  },

  // ── Form ────────────────────────────────────────────────────
  form: {
    display:       'flex',
    flexDirection: 'column',
    gap:           theme.spacing[4],
  },

  nameRow: {
    display: 'flex',
    gap:     theme.spacing[3],
  },

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

  select: {
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
    cursor:          'pointer',
  },

  bioLabelRow: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
  },

  charCount: {
    fontSize: theme.font.size.xs,
  },

  textarea: {
    padding:         theme.spacing[3],
    fontSize:        theme.font.size.sm,
    border:          `1px solid ${theme.colors.border}`,
    borderRadius:    theme.radius.md,
    outline:         'none',
    color:           theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
    fontFamily:      'inherit',
    width:           '100%',
    resize:          'vertical',
    lineHeight:      theme.font.lineHeight.normal,
  },

  fieldError: {
    margin:   0,
    fontSize: theme.font.size.xs,
    color:    theme.colors.danger,
  },

  // ── Messages ────────────────────────────────────────────────
  successMsg: {
    margin:     0,
    fontSize:   theme.font.size.sm,
    color:      theme.colors.success,
    fontWeight: theme.font.weight.medium,
  },

  errorMsg: {
    margin:     0,
    fontSize:   theme.font.size.sm,
    color:      theme.colors.danger,
    fontWeight: theme.font.weight.medium,
  },

  // ── Save button row ─────────────────────────────────────────
  saveRow: {
    display:        'flex',
    justifyContent: 'flex-end',
    marginTop:      theme.spacing[1],
  },

  saveBtn: {
    height:          '40px',
    padding:         `0 ${theme.spacing[6]}`,
    fontSize:        theme.font.size.sm,
    fontWeight:      theme.font.weight.semibold,
    backgroundColor: theme.colors.accent,
    color:           theme.colors.white,
    border:          `2px solid ${theme.colors.accent}`,
    borderRadius:    theme.radius.md,
    fontFamily:      'inherit',
    letterSpacing:   '0.01em',
    transition:      `all ${theme.transition.fast}`,
  },

  saveBtnHover: {
    backgroundColor: theme.colors.accentTint,
    color:           theme.colors.accentHover,
    border:          `2px solid ${theme.colors.accentHover}`,
  },
};

  if (profileLoading) {
    return (
      <div style={s.loadingWrap}>
        <div style={s.spinner} />
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.inner}>

        {/* ── Section 1: Header ─────────────────────────────── */}
        <div style={s.card}>
          <div style={s.headerRow}>
            <div style={s.avatarWrap}>
              <UserIcon />
            </div>
            <div style={s.headerInfo}>
              <h1 style={s.headerName}>
                {profile.firstName} {profile.lastName}
              </h1>
              <p style={s.headerEmail}>{headerData.email}</p>
              <div style={s.headerMeta}>
                <span style={s.metaItem}>
                  Member since {formatDate(headerData.createdAt)}
                </span>
                {headerData.isVerified ? (
                  <span style={s.verifiedBadge}>✓ Verified</span>
                ) : (
                  <span style={s.unverifiedBadge}>Unverified</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 2: Personal Info ──────────────────────── */}
        <div style={s.card}>
          <h2 style={s.sectionTitle}>Personal Information</h2>
          <p style={s.sectionSubtitle}>
            Update your profile details. Email cannot be changed.
          </p>

          <form onSubmit={handleProfileSave} style={s.form}>

            {/* First + Last name side by side */}
            <div style={s.nameRow}>
              <ProfileField
                label="First name"
                value={profile.firstName}
                onChange={v => setProfile(p => ({ ...p, firstName: v }))}
                error={profileErrors.firstName}
                placeholder="Jane"
              />
              <ProfileField
                label="Last name"
                value={profile.lastName}
                onChange={v => setProfile(p => ({ ...p, lastName: v }))}
                error={profileErrors.lastName}
                placeholder="Smith"
              />
            </div>

            <ProfileField
              label="Display name"
              value={profile.displayName}
              onChange={v => setProfile(p => ({ ...p, displayName: v }))}
              error={profileErrors.displayName}
              placeholder="Optional — shown on leaderboards"
            />

            {/* Country dropdown */}
            <div style={s.field}>
              <label style={s.label}>Country</label>
              <select
                value={profile.country}
                onChange={e => setProfile(p => ({ ...p, country: e.target.value }))}
                style={s.select}
              >
                <option value="">Select country</option>
                {countries.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            <ProfileField
              label="Phone"
              value={profile.phone}
              onChange={v => setProfile(p => ({ ...p, phone: v }))}
              error={profileErrors.phone}
              placeholder="Optional"
              type="tel"
              maxLength={10}
            />

            {/* Bio — textarea with character counter */}
            <div style={s.field}>
              <div style={s.bioLabelRow}>
                <label style={s.label}>Bio</label>
                <span style={{
                  ...s.charCount,
                  color: profile.bio.length > 180
                    ? theme.colors.danger
                    : theme.colors.textMuted,
                }}>
                  {profile.bio.length}/200
                </span>
              </div>
              <textarea
                value={profile.bio}
                onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                placeholder="Optional — tell others about yourself"
                maxLength={200}
                rows={3}
                style={s.textarea}
              />
              {profileErrors.bio && (
                <p style={s.fieldError}>{profileErrors.bio}</p>
              )}
            </div>

            {/* Inline save message */}
            {profileMsg.text && (
              <p style={profileMsg.type === 'success' ? s.successMsg : s.errorMsg}>
                {profileMsg.text}
              </p>
            )}

            <div style={s.saveRow}>
              <button
                type="submit"
                disabled={profileSaving}
                style={{
                  ...s.saveBtn,
                  ...(profileSaveHovered && !profileSaving ? s.saveBtnHover : {}),
                  opacity: profileSaving ? 0.75 : 1,
                  cursor:  profileSaving ? 'not-allowed' : 'pointer',
                }}
                {...profileSaveHoverProps}
              >
                {profileSaving ? 'Saving...' : 'Save profile'}
              </button>
            </div>

          </form>
        </div>

        {/* ── Section 3: Change Password ────────────────────── */}
        <div style={s.card}>
          <h2 style={s.sectionTitle}>Change Password</h2>
          <p style={s.sectionSubtitle}>
            Requires your current password for verification.
          </p>

          <form onSubmit={handlePasswordSave} style={s.form}>

            <PasswordField
              label="Current password"
              value={pwForm.currentPassword}
              onChange={v => setPwForm(p => ({ ...p, currentPassword: v }))}
              error={pwErrors.currentPassword}
              placeholder="Your current password"
            />

            <PasswordField
              label="New password"
              value={pwForm.newPassword}
              onChange={v => setPwForm(p => ({ ...p, newPassword: v }))}
              error={pwErrors.newPassword}
              placeholder="Minimum 10 characters"
            />

            <PasswordField
              label="Confirm new password"
              value={pwForm.confirmPassword}
              onChange={v => setPwForm(p => ({ ...p, confirmPassword: v }))}
              error={pwErrors.confirmPassword}
              placeholder="Repeat new password"
            />

            {pwMsg.text && (
              <p style={pwMsg.type === 'success' ? s.successMsg : s.errorMsg}>
                {pwMsg.text}
              </p>
            )}

            <div style={s.saveRow}>
              <button
                type="submit"
                disabled={pwSaving}
                style={{
                  ...s.saveBtn,
                  ...(pwSaveHovered && !pwSaving ? s.saveBtnHover : {}),
                  opacity: pwSaving ? 0.75 : 1,
                  cursor:  pwSaving ? 'not-allowed' : 'pointer',
                }}
                {...pwSaveHoverProps}
              >
                {pwSaving ? 'Saving...' : 'Update password'}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}

// ── PROFILE FIELD ──────────────────────────────────────────────────────────
function ProfileField({ label, value, onChange, placeholder, error, type = 'text', maxLength }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const s = {
    field: {
      display:       'flex',
      flexDirection: 'column',
      gap:           '5px',
      flex:          1,
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
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...s.input,
          borderColor: error
            ? theme.colors.danger
            : focused
            ? theme.colors.accent
            : theme.colors.border,
          boxShadow: focused && !error
            ? `0 0 0 3px ${theme.colors.accentTint}`
            : 'none',
        }}
      />
      {error && <p style={s.fieldError}>{error}</p>}
    </div>
  );
}

// ── PASSWORD FIELD ─────────────────────────────────────────────────────────
function PasswordField({ label, value, onChange, placeholder, error }) {
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
        type="password"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...s.input,
          borderColor: error
            ? theme.colors.danger
            : focused
            ? theme.colors.accent
            : theme.colors.border,
          boxShadow: focused && !error
            ? `0 0 0 3px ${theme.colors.accentTint}`
            : 'none',
        }}
      />
      {error && <p style={s.fieldError}>{error}</p>}
    </div>
  );
}