/**
 * FOLDER: /server/middleware
 *
 * Middleware is code that runs on every request (or a subset of requests)
 * before the request reaches the route handler.
 *
 * Think of middleware as a pipeline:
 *  Request → middleware 1 → middleware 2 → middleware 3 → controller
 *
 * Each middleware function receives the request, does one job,
 * then either passes the request forward or stops it with an error.
 *
 * What lives here:
 *  - auth.js         → verifies JWT tokens on protected routes
 *                      if token is missing or invalid, request is rejected
 *                      before it ever reaches the controller
 *
 *  - errorHandler.js → catches any error thrown anywhere in the app
 *                      formats it into a consistent JSON error response
 *                      so the frontend always gets the same error shape
 *
 *  - rateLimiter.js  → tracks how many requests an IP address makes
 *                      blocks excessive requests to prevent abuse
 *
 * Why middleware lives in its own folder:
 *  These functions are shared across multiple modules.
 *  Any module can attach them to any route without duplication.
 *  If auth logic lived inside the auth module, other modules
 *  could not use it without importing across module boundaries.
 *
 * Rule:
 *  If logic needs to run before a controller across multiple modules,
 *  it belongs here. If it only applies inside one module, it
 *  stays inside that module.
 */