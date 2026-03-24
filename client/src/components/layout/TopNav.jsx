/*
 * TopNav.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Fixed top navigation bar.
 *   Left:   RookieBulls brand name — clicking navigates to /summary.
 *   Right:  Dark mode toggle + user icon + firstName (links to /profile) +
 *           Logout pill.
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
 *   Reads isDark/toggleTheme from ThemeContext via useThemeMode().
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme, useThemeMode } from '../../context/ThemeContext';
import { useMobile } from '../../hooks/useBreakpoint';

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

/*
 * SunIcon / MoonIcon
 * Inline SVGs for the dark mode toggle button.
 * Sun shown when dark mode is active (click to switch to light).
 * Moon shown when light mode is active (click to switch to dark).
 */
const SunIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const TopNav = () => {
  const { user, logout }         = useAuth();
  const theme                    = useTheme();
  const { isDark, toggleTheme }  = useThemeMode();
  const isMobile                 = useMobile();

  const [logoutHovered,  setLogoutHovered]  = useState(false);
  const [profileHovered, setProfileHovered] = useState(false);
  const [themeHovered,   setThemeHovered]   = useState(false);

  const hover = (setter) => isMobile ? {} : {
    onMouseEnter: () => setter(true),
    onMouseLeave: () => setter(false),
  };

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

  // ── Styles ──────────────────────────────────────────────────────────────────
  //
  // Defined inside the component body so they read the current theme
  // from useTheme(). Module-level styles would evaluate once and never
  // update when the user toggles dark mode.
  //
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
      padding:         isMobile ? `0 ${theme.spacing[3]}` : `0 ${theme.spacing[6]}`,
      zIndex:          100,
    },

    brand: {
      fontSize:       theme.font.size.brand,
      fontWeight:     theme.font.weight.bold,
      color:          theme.colors.accent,
      textDecoration: 'none',
      letterSpacing:  '-0.5px',
      flexShrink:     0,
      marginRight:    isMobile ? theme.spacing[3] : 0,
    },

    right: {
      display:    'flex',
      alignItems: 'center',
      gap:        theme.spacing[2],
      overflowX:  isMobile ? 'auto' : undefined,
      minWidth:   0,
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

    /*
     * Theme toggle — pill-shaped button matching profile/logout pill style.
     * Shows SunIcon in dark mode, MoonIcon in light mode.
     */
    themeToggle: {
      fontSize:        theme.font.size.sm,
      fontWeight:      theme.font.weight.medium,
      color:           themeHovered ? theme.colors.accent : theme.colors.textSecondary,
      border:          `1px solid ${themeHovered ? theme.colors.accent : theme.colors.border}`,
      borderRadius:    theme.radius.full,
      padding:         `5px ${theme.spacing[3]}`,
      backgroundColor: themeHovered ? theme.colors.accentTint : theme.colors.surfaceAlt,
      cursor:          'pointer',
      transition:      `color ${theme.transition.fast}, border-color ${theme.transition.fast}, background-color ${theme.transition.fast}`,
      display:         'flex',
      alignItems:      'center',
      gap:             '5px',
    },

    logoutPill: {
      fontSize:        theme.font.size.sm,
      fontWeight:      theme.font.weight.medium,
      color:           logoutHovered ? theme.colors.danger : theme.colors.textSecondary,
      border:          `1px solid ${logoutHovered ? theme.colors.danger : theme.colors.border}`,
      borderRadius:    theme.radius.full,
      padding:         `5px ${theme.spacing[3]}`,
      backgroundColor: logoutHovered ? theme.colors.dangerTint : theme.colors.surfaceAlt,
      cursor:          'pointer',
      transition:      `color ${theme.transition.fast}, border-color ${theme.transition.fast}, background-color ${theme.transition.fast}`,
    },
  };

  return (
    <nav style={styles.nav}>

      {/* Brand — links to /summary */}
      <Link to="/summary" style={styles.brand}>
        RookieBulls
      </Link>

      {/* Right side: theme toggle + profile pill + logout pill */}
      <div style={styles.right}>

        {/* Dark / light mode toggle */}
        <button
          style={styles.themeToggle}
          onClick={toggleTheme}
          {...hover(setThemeHovered)}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>

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
          {...hover(setProfileHovered)}
        >
          <UserIcon />
          {displayName}
        </Link>

        {/* Logout — danger color on hover */}
        <button
          style={styles.logoutPill}
          onClick={logout}
         {...hover(setLogoutHovered)}
        >
          Logout
        </button>

      </div>
    </nav>
  );
};

export default TopNav;