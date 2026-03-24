/**
 * FOLDER: /client/src/context
 *
 * React Context provides a way to share data across many components
 * without passing it manually through every level of the component tree.
 *
 * The problem it solves:
 *  The logged-in user's data is needed in many places:
 *   - TopNav (to show the username)
 *   - Protected routes (to check if they are logged in)
 *   - ProfilePage (to sync name updates without re-login)
 *
 *  The active theme is needed in every component that renders UI:
 *   - All pages, nav bars, modals, panels
 *   - Switches between light and dark color palettes
 *
 *  Without Context, you would pass these objects as props from
 *  the top level down through every component in between,
 *  even components that do not use it themselves.
 *  This is called prop drilling and it makes code messy fast.
 *
 *  With Context, any component can access shared state directly
 *  without it being passed manually through the tree.
 *
 * Files:
 *  - AuthContext.jsx   → stores the logged-in user, their token,
 *                        login function, logout function, and
 *                        updateUser for syncing profile changes.
 *                        Any component that needs to know who is
 *                        logged in imports useAuth() from here.
 *
 *  - ThemeContext.jsx  → stores the active theme (light or dark),
 *                        persists preference in localStorage,
 *                        syncs data-theme attribute on <html>.
 *                        useTheme() returns the active theme object.
 *                        useThemeMode() returns { isDark, toggleTheme }
 *                        for the toggle button in TopNav.
 */