/**
 * FOLDER: /docs
 *
 * Project-level documentation that does not belong inside code files.
 *
 * Files:
 *  - architecture.md   → stack overview, module structure, Redis key reference,
 *                        Stooq call budget, startup sequence, market hours
 *
 *  - api-contracts.md  → every API endpoint: URL, method, request body,
 *                        response shape, error responses
 *                        this is the agreement between frontend and backend
 *
 *  - DATA_FLOW.md      → priceUpdater three-job breakdown, resolveQuote() paths,
 *                        portfolio read path and Redis fallback chain
 *
 *  - market-module.md  → Step 5 architecture decisions: provider choice (Stooq),
 *                        two-key Redis strategy, ticker search, market hours
 *
 * Why documentation lives in the repo:
 *  Documentation that lives outside the codebase gets out of date
 *  and eventually abandoned. When docs live next to the code,
 *  updating them becomes part of the same workflow as updating code.
 *  A git commit can include both a code change and its documentation update.
 */