/**
 * App.jsx — Root Application Component
 *
 * The top level of the React component tree.
 * Every page and component in Rookie Bulls is a descendant of this.
 *
 * Responsibilities:
 *  - Set up React Router so URLs map to page components
 *  - Wrap the application in Context providers
 *    so global state is available everywhere
 *
 * What does NOT belong here:
 *  - Any UI layout or content (goes in pages/ and components/)
 *  - Any API calls (goes in services/)
 *  - Any business logic (stays in the backend)
 *
 * This file grows as new pages are added to the router.
 * It should stay thin — routing and providers only.
 */

function App() {
  return (
    <div>
      <h1>Rookie Bulls</h1>
      <p>Frontend is running.</p>
    </div>
  )
}

export default App