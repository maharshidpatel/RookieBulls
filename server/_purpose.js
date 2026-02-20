/**
 * FOLDER: /server
 *
 * The entire backend application lives here.
 * This is a Node.js + Express API server.
 *
 * What this folder contains:
 *  - server.js        → application entry point
 *  - config/          → database and environment setup
 *  - middleware/      → shared request processing logic
 *  - modules/         → all features organized by domain
 *  - utils/           → small shared helper functions
 *
 * How it works:
 *  Node.js executes server.js first.
 *  server.js wires everything together and starts the HTTP server.
 *  All incoming requests from the React frontend arrive here.
 *  All responses go back to the frontend from here.
 *
 * What this folder does NOT contain:
 *  - Any UI code (lives in /client)
 *  - Any static assets like images or fonts
 *
 * Deployment target:
 *  DigitalOcean VPS running inside Docker
 */

/** 
 * Why devDependencies Exist and What Nodemon Actually Does
 * 
 * The Core Problem Nodemon Solves
    
 *   When you run your server with node server.js, Node.js reads the file once, loads it into memory, and starts running it. From that point on, Node.js does not look at your files again. It is running from memory.
    
 *  This means when you change any file and save it, nothing updates. The server is still running the old version from when it started.
    
    Your only option without nodemon:
    1. Make a code change
    2. Go to terminal
    3. Press Ctrl+C to stop the server
    4. Run node server.js again
    5. Go back to your code
    6. Repeat for every single change

 *   During active development you change files constantly. Doing this manually 50 times a day is genuinely painful and breaks your focus every time.


 * What Nodemon Does
    
    Nodemon is a wrapper around Node.js. Instead of node server.js you run nodemon server.js.

    Nodemon starts your server exactly like Node.js does, but additionally it watches every file in your project for changes. The moment you save any file, nodemon:
    1. Detects the file change
    2. Stops the running server
    3. Restarts it automatically with the updated code
    
    The whole cycle takes less than a second. You save a file and your server is already running the new version. You never touch the terminal.
    
    That is the entire purpose of nodemon. Nothing more than that.

*  Why It Is a devDependency

    Think about the two environments your application runs in:
    Development (your laptop)
    - You are actively writing code
    - Files change constantly
    - You need auto-restart
    - nodemon is useful here

    Production (DigitalOcean server)
    - Code is deployed and stable
    - Files never change while the server is running
    - Auto-restart on file change is meaningless
    - nodemon serves no purpose here

    Running nodemon in production would be wasteful — it sits there watching files that never change, consuming memory and CPU for no reason. Worse, if something accidentally triggered a file change on the server, nodemon would restart your live application mid-request, potentially dropping connections.

    Production uses node server.js directly. Nodemon is a development convenience tool only.

* How npm Uses This Distinction

    When you run npm install normally, npm installs both dependencies and devDependencies.
    When you run npm install --omit=dev or when NODE_ENV=production is set, npm only installs dependencies and skips devDependencies entirely.
    
    On DigitalOcean your deployment will run:

    npm install --omit=dev
    ```
    This means nodemon never gets downloaded to your production server. The deployment is leaner and faster because it only installs what production actually needs.

    ---
    ### Visual Summary
    ```
    Your Laptop (development)
    npm install
        → installs dependencies     (express, mongoose, bcryptjs etc.)
        → installs devDependencies  (nodemon)
    npm run dev
        → runs: nodemon server.js
        → auto-restarts on every file save

    DigitalOcean (production)
    npm install --omit=dev
        → installs dependencies only (express, mongoose, bcryptjs etc.)
        → nodemon is never downloaded
    npm start
        → runs: node server.js
        → stable, no file watching
    ```

    ---
    ### The Broader Principle

    devDependencies is not just for nodemon. Any tool that helps you build the application but is not needed to run it belongs there:
    ```
    Testing frameworks   → only needed when running tests locally
    Code formatters      → only needed when writing code
    Build tools          → only needed during the build process
    Linters              → only needed during development
 */

/**
 * DEPENDENCIES — Why Each Package Exists in Rookie Bulls
 * ─────────────────────────────────────────────────────
 *
 * PRODUCTION DEPENDENCIES (npm install)
 * These are required for the application to run in any environment.
 *
 *
 * express
 *   Web framework for Node.js.
 *   Handles incoming HTTP requests and outgoing responses.
 *   Provides routing, middleware support, and request parsing.
 *   Without it: building an HTTP server in raw Node.js is verbose
 *   and error prone.
 *
 *
 * mongoose
 *   Connects Node.js to MongoDB and enforces document structure
 *   through schemas.
 *   Without it: MongoDB accepts any shape of data with no
 *   validation, and queries require the raw MongoDB driver
 *   which is more verbose and less structured.
 *
 *
 * dotenv
 *   Reads the .env file and loads every variable into process.env
 *   so the application can access secrets and config values
 *   without hardcoding them in source code.
 *   Without it: process.env.MONGO_URI would be undefined and
 *   credentials would have to be written directly in code files.
 *
 *
 * cors
 *   Tells the browser which frontend origins are allowed to make
 *   requests to this API.
 *   The browser blocks requests between different origins by default.
 *   React runs on localhost:5173, Express runs on localhost:5000 —
 *   these are different origins.
 *   Without it: every request from the React frontend is blocked
 *   by the browser before it reaches the server.
 *
 *
 * helmet
 *   Sets secure HTTP response headers automatically.
 *   Protects against common attacks like clickjacking,
 *   content type sniffing, and cross-site scripting.
 *   Without it: the application works but has known, easily
 *   preventable security gaps.
 *
 *
 * morgan
 *   Logs every incoming HTTP request to the terminal.
 *   Shows method, URL, status code, and response time.
 *   Without it: you have no visibility into what requests are
 *   hitting your server during development unless you manually
 *   add console.log statements everywhere.
 *
 *
 * bcryptjs
 *   Hashes passwords before storing them in the database.
 *   A hash is a one-way transformation — it cannot be reversed.
 *   When a user logs in, their input is hashed and compared
 *   against the stored hash. The real password is never stored.
 *   Without it: passwords would be stored as plain text — if the
 *   database was ever exposed, every user account would be compromised.
 *   Uses pure JavaScript so it works on Windows without native
 *   compilation (unlike the bcrypt package which requires C++ build tools).
 *
 *
 * jsonwebtoken
 *   Creates and verifies JWT tokens used for authentication.
 *   After a successful login, the server signs a token with a secret
 *   and sends it to the frontend. The frontend sends it back with
 *   every request to prove the user is authenticated.
 *   Without it: the server has no way to identify who is making
 *   a request after the login step.
 *
 *
 * ─────────────────────────────────────────────────────
 * DEV DEPENDENCIES (npm install --save-dev)
 * Only installed in development. Never installed in production.
 *
 *
 * nodemon
 *   Watches project files for changes and automatically restarts
 *   the Node.js server when a file is saved.
 *   Without it: every code change requires manually stopping
 *   and restarting the server in the terminal.
 *   Never used in production — files on a live server do not
 *   change while it is running.
 */