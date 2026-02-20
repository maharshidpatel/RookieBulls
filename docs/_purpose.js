/**
 * FOLDER: /docs
 *
 * Project-level documentation that does not belong inside code files.
 *
 * Files:
 *  - architecture.md   → high level system design decisions
 *                        why the stack was chosen, how the pieces connect,
 *                        what the deployment looks like
 *
 *  - api-contracts.md  → every API endpoint documented
 *                        URL, method, request body shape,
 *                        response shape, error responses
 *                        this is the agreement between frontend and backend
 *                        both sides build to this contract
 *
 * Why documentation lives in the repo:
 *  Documentation that lives outside the codebase gets out of date
 *  and eventually abandoned. When docs live next to the code,
 *  updating them becomes part of the same workflow as updating code.
 *  A git commit can include both a code change and its documentation update.
 */