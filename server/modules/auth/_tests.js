/*
 * FILE: server/modules/auth/_tests.js
 *
 * PURPOSE:
 *   Manual test cases for the auth module API endpoints.
 *   These are not automated tests — they are Thunder Client
 *   or curl requests used to verify the module works end to end.
 *
 *   Run these any time the auth module is modified.
 *   All tests must pass before committing auth-related changes.
 *
 * PREREQUISITES:
 *   - Docker running (docker compose up -d)
 *   - Server running (npm run dev in /server)
 *   - Base URL: http://localhost:5000
 *
 * ─── TEST 1 — Register: Valid Input ──────────────────────────
 *
 * Request:
 *   POST /api/auth/register
 *   Content-Type: application/json
 *   Body: {
 *     "email": "test@example.com",
 *     "password": "password123"
 *   }
 *
 * Expected:
 *   Status: 201
 *   Body: {
 *     "success": true,
 *     "message": "Registration successful",
 *     "data": {
 *       "user": {
 *         "_id": "<mongoId>",
 *         "email": "test@example.com",
 *         "role": "user",
 *         "createdAt": "<timestamp>"
 *       }
 *     }
 *   }
 *
 * Verifies:
 *   - User is created in MongoDB
 *   - passwordHash is NOT returned in the response
 *   - Role defaults to "user"
 *
 *
 * ─── TEST 2 — Register: Duplicate Email ──────────────────────
 *
 * Request:
 *   POST /api/auth/register
 *   Body: { "email": "test@example.com", "password": "password123" }
 *   (same as Test 1 — intentionally duplicate)
 *
 * Expected:
 *   Status: 409
 *   Body: { "message": "Email is already registered" }
 *
 * Verifies:
 *   - Duplicate email check works in service layer
 *
 *
 * ─── TEST 3 — Register: Invalid Input ────────────────────────
 *
 * Request:
 *   POST /api/auth/register
 *   Body: { "email": "notanemail", "password": "123" }
 *
 * Expected:
 *   Status: 422
 *   Body: {
 *     "success": false,
 *     "errors": [
 *       { "field": "email", "message": "Must be a valid email address" },
 *       { "field": "password", "message": "Password must be between 8 and 72 characters" }
 *     ]
 *   }
 *
 * Verifies:
 *   - Validators reject bad input before controller runs
 *   - Field-level error messages are returned
 *
 *
 * ─── TEST 4 — Login: Valid Credentials ───────────────────────
 *
 * Request:
 *   POST /api/auth/login
 *   Body: { "email": "test@example.com", "password": "password123" }
 *
 * Expected:
 *   Status: 200
 *   Body: {
 *     "success": true,
 *     "message": "Login successful",
 *     "data": {
 *       "accessToken": "<jwt>",
 *       "refreshToken": "<jwt>",
 *       "user": {
 *         "_id": "<mongoId>",
 *         "email": "test@example.com",
 *         "role": "user"
 *       }
 *     }
 *   }
 *
 * Verifies:
 *   - Correct credentials return both tokens
 *   - passwordHash is NOT in the response
 *
 * Note:
 *   Copy the accessToken from this response.
 *   It is required for Test 6.
 *   Access tokens expire in 15 minutes — run Test 6 immediately.
 *
 *
 * ─── TEST 5 — Login: Wrong Password ──────────────────────────
 *
 * Request:
 *   POST /api/auth/login
 *   Body: { "email": "test@example.com", "password": "wrongpassword" }
 *
 * Expected:
 *   Status: 401
 *   Body: { "message": "Invalid email or password" }
 *
 * Verifies:
 *   - Wrong password is rejected
 *   - Error message does not reveal whether email exists
 *
 *
 * ─── TEST 6 — Protected Route: JWT Middleware ─────────────────
 *
 * Request A (no token):
 *   GET /api/test/protected
 *
 * Expected:
 *   Status: 401
 *   Body: { "message": "Access token is required" }
 *
 * ---
 *
 *  Temporary test route — remove after 2.7 testing is complete
    const { authenticate } = require('./middleware/auth');
    app.get('/api/test/protected', authenticate, (req, res) => {
    res.json({
        success: true,
        message: 'You are authenticated',
        user: req.user,
    });
    });
    
 * Request B (valid token):
 *   GET /api/test/protected
 *   Headers: { Authorization: "Bearer <accessToken from Test 4>" }
 *
 * Expected:
 *   Status: 200
 *   Body: {
 *     "success": true,
 *     "message": "You are authenticated",
 *     "user": {
 *       "sub": "<mongoId>",
 *       "role": "user",
 *       "iat": <timestamp>,
 *       "exp": <timestamp>
 *     }
 *   }
 *
 * Verifies:
 *   - Requests without token are rejected
 *   - Valid token grants access
 *   - req.user is populated with decoded JWT payload
 *
 * Note:
 *   The test route used for this test is temporary.
 *   It must be removed from server.js after this test passes.
 *   Authorization header format: "Bearer <token>" with a space.
 *   The key must be named "Authorization" exactly.
 */