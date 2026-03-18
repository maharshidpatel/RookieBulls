/*
 * TopNav.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Fixed top navigation bar.
 *   Left:  RookieBulls brand name — clicking navigates to /summary.
 *   Right: User icon + firstName (links to /profile) and Logout pill.
 *
 * Does NOT belong here:
 *   Market status, trade actions, page navigation links (those are SecondNav).
 *
 * STEP 7 CHANGES:
 *   - displayName replaced with firstName from JWT payload
 *   - User pill now links to /profile instead of being read-only
 *   - Inline SVG user icon added beside firstName
 *   - Comment updated to reflect new source of display name
 *
 * How it fits:
 *   Rendered by Layout.jsx above all page content.
 *   Reads user and logout from AuthContext via useAuth().
 *   user.firstName is decoded from the JWT access token on login —
 *   no extra API call needed to display the name.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import theme from '../../styles/theme';

/*
 * UserIcon
 * Inline SVG — no external file or package needed.
 * Standard person silhouette: circle head + curved shoulders.
 * Size matches the surrounding text so it sits inline naturally.
 */
const UserIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '5px', marginTop: '-2px' }}
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

const TopNav = () => {
  const { user, logout } = useAuth();

  const [logoutHovered,  setLogoutHovered]  = useState(false);
  const [profileHovered, setProfileHovered] = useState(false);

  /*
   * firstName comes from the JWT payload decoded at login.
   * AuthContext stores it in user.firstName.
   * If somehow absent (old session), falls back to email prefix.
   *
   * Why not make an API call:
   *   The JWT already carries firstName — no round trip needed.
   *   If the user updates firstName on ProfilePage, AuthContext.updateUser()
   *   refreshes it in memory immediately without re-login.
   */
  const displayName = user?.firstName || user?.email?.split('@')[0] || '';

  return (
    <nav style={styles.nav}>

      {/* Brand — links to /summary */}
      <Link to="/summary" style={styles.brand}>
        RookieBulls
      </Link>

      {/* Right side: profile pill + logout pill */}
      <div style={styles.right}>

        {/*
         * Profile pill — links to /profile.
         * Shows user icon + firstName.
         * Hovering highlights it with accent tint — signals it is clickable.
         * Replaces the old read-only username pill.
         */}
        <Link
          to="/profile"
          style={{
            ...styles.profilePill,
            ...(profileHovered ? styles.profilePillHover : {}),
          }}
          onMouseEnter={() => setProfileHovered(true)}
          onMouseLeave={() => setProfileHovered(false)}
        >
          <UserIcon />
          {displayName}
        </Link>

        {/* Logout — danger color on hover */}
        <button
          style={{
            ...styles.logoutPill,
            ...(logoutHovered ? styles.logoutPillHover : {}),
          }}
          onClick={logout}
          onMouseEnter={() => setLogoutHovered(true)}
          onMouseLeave={() => setLogoutHovered(false)}
        >
          Logout
        </button>

      </div>
    </nav>
  );
};

const styles = {
  nav: {
    position:        'fixed',
    top:             0,
    left:            0,
    right:           0,
    height:          theme.layout.topNavHeight,
    backgroundColor: theme.colors.surface,
    borderBottom:    `1px solid ${theme.colors.border}`,
    boxShadow:       theme.shadow.sm,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'space-between',
    padding:         `0 ${theme.spacing[6]}`,
    zIndex:          100,
  },

  brand: {
    fontSize:      theme.font.size.brand,
    fontWeight:    theme.font.weight.bold,
    color:         theme.colors.accent,
    textDecoration: 'none',
    letterSpacing: '-0.5px',
  },

  right: {
    display:    'flex',
    alignItems: 'center',
    gap:        theme.spacing[2],
  },

  /*
   * Profile pill — same shape as old username pill but now clickable.
   * Link to /profile. Accent tint on hover matches nav pill hover pattern.
   */
  profilePill: {
    fontSize:        theme.font.size.sm,
    fontWeight:      theme.font.weight.medium,
    color:           theme.colors.textSecondary,
    border:          `1px solid ${theme.colors.border}`,
    borderRadius:    theme.radius.full,
    padding:         `4px ${theme.spacing[3]}`,
    backgroundColor: theme.colors.surfaceAlt,
    textDecoration:  'none',
    cursor:          'pointer',
    transition:      `color ${theme.transition.fast}, border-color ${theme.transition.fast}, background-color ${theme.transition.fast}`,
    display:         'flex',
    alignItems:      'center',
  },

  profilePillHover: {
    color:           theme.colors.accent,
    borderColor:     theme.colors.accent,
    backgroundColor: theme.colors.accentTint,
  },

  logoutPill: {
    fontSize:        theme.font.size.sm,
    fontWeight:      theme.font.weight.medium,
    color:           theme.colors.textSecondary,
    border:          `1px solid ${theme.colors.border}`,
    borderRadius:    theme.radius.full,
    padding:         `5px ${theme.spacing[3]}`,
    backgroundColor: theme.colors.surfaceAlt,
    cursor:          'pointer',
    transition:      `color ${theme.transition.fast}, border-color ${theme.transition.fast}, background-color ${theme.transition.fast}`,
  },

  logoutPillHover: {
    color:           theme.colors.danger,
    borderColor:     theme.colors.danger,
    backgroundColor: theme.colors.dangerTint,
  },
};

export default TopNav;