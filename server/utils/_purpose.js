/**
 * FOLDER: /server/utils
 *
 * Small, stateless helper functions used across the application.
 * These are not features — they are tools that features use.
 *
 * What lives here:
 *  - response.js   → standardizes how every API response is shaped
 *                    instead of every controller writing its own
 *                    res.json format, they all use the same helper
 *                    ensuring the frontend always gets a consistent shape
 *
 * Example of what a utility does:
 *  Without a utility:
 *    res.json({ success: true, data: user })      ← in one controller
 *    res.json({ ok: true, result: user })          ← in another controller
 *    res.json({ user: user })                      ← in a third controller
 *  The frontend has to handle three different shapes.
 *
 *  With a utility:
 *    res.json(successResponse(user))               ← everywhere
 *  The frontend always gets the same shape.
 *
 * Rules:
 *  - Utility functions must be pure — same input always gives same output
 *  - They must not import from modules or middleware
 *  - They must not contain business logic
 *  - If a helper is only used by one module, it stays in that module
 *    It only moves here when two or more modules need it
 */