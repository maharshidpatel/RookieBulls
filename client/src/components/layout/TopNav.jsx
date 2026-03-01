/*
 * TopNav.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibility:
 *   Fixed top navigation bar.
 *   Left:  Company name — clicking navigates to /summary.
 *   Right: User display name (pill, read only) and Logout (pill, danger hover).
 *
 * Does NOT belong here:
 *   Market status, trade actions, page navigation links (those are SecondNav).
 *
 * How it fits:
 *   Rendered by Layout.jsx above all page content.
 *   Reads user and logout from AuthContext via useAuth().
 *
 * Display name:
 *   Derived from email (portion before @) until Step 7 adds firstName.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import theme from '../../styles/theme';

const TopNav = () => {
  const { user, logout } = useAuth();

  const [logoutHovered, setLogoutHovered] = useState(false);

  // Derive display name from email until Step 7 adds firstName.
  // 'alice@example.com' → 'alice'
  const displayName = user?.email?.split('@')[0] ?? '';

  return (
    <nav style={styles.nav}>

      {/* Company name — links to /summary */}
      <Link to="/summary" style={styles.brand}>
        RookieBulls
      </Link>

      {/* Right side: display name pill + logout pill */}
      <div style={styles.right}>

        {/* Username — pill with border, display only, not clickable */}
        <span style={styles.userPill}>
          {displayName}
        </span>

        {/* Logout — pill with border, danger color on hover */}
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
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: theme.layout.topNavHeight,
    backgroundColor: theme.colors.surface,
    borderBottom: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadow.sm,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `0 ${theme.spacing[6]}`,
    zIndex: 100,
  },

  brand: {
    fontSize: theme.font.size.brand,
    fontWeight: theme.font.weight.bold,
    color: theme.colors.accent,
    textDecoration: 'none',
    letterSpacing: '-0.5px',
  },

  right: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing[2],
  },

  // Username — pill shape, border, no hover (read only)
  userPill: {
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.medium,
    color: theme.colors.textSecondary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.full,
    padding: `4px ${theme.spacing[3]}`,
    backgroundColor: theme.colors.surfaceAlt,
    userSelect: 'none',
  },

  // Logout — pill shape, border, transitions to danger on hover
  logoutPill: {
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.medium,
    color: theme.colors.textSecondary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.full,
    padding: `4px ${theme.spacing[3]}`,
    backgroundColor: theme.colors.surfaceAlt,
    cursor: 'pointer',
    transition: `color ${theme.transition.fast}, border-color ${theme.transition.fast}, background-color ${theme.transition.fast}`,
  },

  logoutPillHover: {
    color: theme.colors.danger,
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.dangerTint,
  },
};


export default TopNav;