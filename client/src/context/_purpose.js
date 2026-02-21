/**
 * FOLDER: /client/src/context
 *
 * React Context provides a way to share data across many components
 * without passing it manually through every level of the component tree.
 *
 * The problem it solves:
 *  The logged-in user's data is needed in many places:
 *   - Navbar (to show the username)
 *   - Dashboard (to show their portfolio)
 *   - Trade form (to know who is trading)
 *   - Protected routes (to check if they are logged in)
 *
 *  Without Context, you would pass the user object as a prop from
 *  the top level down through every component in between,
 *  even components that do not use it themselves.
 *  This is called prop drilling and it makes code messy fast.
 *
 *  With Context, any component can access the user data directly
 *  without it being passed manually through the tree.
 *
 * Files planned:
 *  - AuthContext.jsx  → stores the logged-in user, their token,
 *                       login function, and logout function
 *                       any component that needs to know who is
 *                       logged in imports from here
 */