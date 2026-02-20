/** 

HTTP Request → routes.js → controller.js → service.js → model.js → MongoDB
                                                ↓
HTTP Response ← controller.js ← service.js ←────────────────────────

─────────────────────────────────────────────
 * routes.js — URL Endpoint Definitions
 *
 * Defines which HTTP method + URL path maps to which controller function.
 * This file only wires URLs to controllers. Nothing else.
 *
 * Example:
 *   POST /register → registerController
 *   POST /login    → loginController
 *
 * What does NOT belong here:
 *  - Request/response logic (goes in controller.js)
 *  - Business logic (goes in service.js)
 *  - Database queries (goes in service.js or model.js)
 *
 * Middleware that applies to specific routes is attached here.
 * Example: auth middleware on protected routes.
 * ─────────────────────────────────────────────
 */

/**
 * ─────────────────────────────────────────────
 * controller.js — HTTP Request and Response Handler
 *
 * Sits between the route and the service layer.
 * Handles everything related to HTTP — nothing more.
 *
 * Responsibilities:
 *  - Read data from the incoming request (req.body, req.params, req.query)
 *  - Call the appropriate service function with that data
 *  - Send the HTTP response back to the client
 *  - Handle HTTP-level errors (wrong status codes etc.)
 *
 * What does NOT belong here:
 *  - Business logic or decisions (goes in service.js)
 *  - Direct database access (goes in service.js via model)
 *  - Data validation (goes in validators.js)
 *
 * Rule: If you are writing an if-statement that makes a
 * business decision, it belongs in service.js not here.
 * ─────────────────────────────────────────────
 */

/**
 * ─────────────────────────────────────────────
 * service.js — Business Logic Layer
 *
 * The core of each module. Contains all decisions, rules,
 * and operations that make the feature work.
 *
 * Responsibilities:
 *  - Enforce business rules
 *    (e.g. user cannot buy more shares than credits allow)
 *  - Coordinate between models
 *    (e.g. create a trade AND update the wallet in one operation)
 *  - Call external services if needed
 *  - Throw meaningful errors when rules are violated
 *
 * What does NOT belong here:
 *  - HTTP concerns like req/res (goes in controller.js)
 *  - Raw database schema definitions (goes in model.js)
 *
 * Rule: This layer should be testable without
 * an HTTP request existing at all.
 * ─────────────────────────────────────────────
 */

/**
 * ─────────────────────────────────────────────
 * model.js — Database Schema Definition
 *
 * Defines the structure of a MongoDB document for this module.
 * Uses Mongoose to declare field names, types, and constraints.
 *
 * Responsibilities:
 *  - Define what fields a document has
 *  - Set field types (String, Number, Date, ObjectId etc.)
 *  - Set constraints (required, unique, default values)
 *  - Define indexes for query performance
 *
 * What does NOT belong here:
 *  - Business logic (goes in service.js)
 *  - HTTP handling (goes in controller.js)
 *
 * Rule: This file describes the shape of data only.
 * It does not decide what to do with that data.
 *
 * Note on MongoDB vs SQL:
 *  - SQL has tables with fixed columns
 *  - MongoDB has collections of documents
 *  - A Mongoose schema enforces structure on those documents
 *  - Without a schema, MongoDB accepts any shape of data
 * ─────────────────────────────────────────────
 */

/**
 * ─────────────────────────────────────────────
 * validators.js — Input Validation Rules
 *
 * Validates the shape and content of data coming into the API
 * before it reaches the controller or service layer.
 *
 * Responsibilities:
 *  - Check required fields are present
 *  - Check field types are correct
 *  - Check field formats (email format, password length etc.)
 *  - Reject bad requests early with clear error messages
 *
 * Why validate here instead of in the service:
 *  - Catches bad input at the edge of the system
 *    before any logic or database operations run
 *  - Keeps service.js focused on business logic
 *    not data cleaning
 *  - Returns user-friendly errors immediately
 *
 * Rule: If the data shape is wrong, it never
 * reaches the controller. It stops here.
 * ─────────────────────────────────────────────
 */

