/**
 * FOLDER: /server/modules
 *
 * The core of the backend. Every feature of Rookie Bulls
 * is organized as a self-contained module inside this folder.
 *
 * What is a module:
 *  A module is a folder that contains everything needed
 *  for one specific feature domain — its routes, controller,
 *  service, database model, and validators.
 *  Nothing inside a module needs to look outside the module
 *  to do its job, except importing shared middleware or utilities.
 *
 * Current modules:
 *  - auth/       → registration, login, token management
 *  - user/       → profile data, account settings
 *  - wallet/     → virtual credits, balance, transaction ledger
 *  - market/     → stock price data (mocked in MVP)
 *  - trade/      → buy and sell simulation engine
 *  - portfolio/  → user holdings, positions, profit and loss
 *  - education/  → lessons and learning content (post-MVP)
 *
 * Why organize by module instead of by file type:
 *  Alternative approach (by file type):
 *    /routes/auth.js, /routes/trade.js, /routes/wallet.js
 *    /controllers/auth.js, /controllers/trade.js
 *    /models/auth.js, /models/trade.js
 *
 *  Problem: when working on the trade feature you are jumping
 *  between four different folders constantly.
 *
 *  Module approach:
 *    /modules/trade/ contains everything about trading in one place.
 *  When you work on trading you stay in one folder.
 *
 * Rule:
 *  Modules do not import from each other directly.
 *  If module A needs something from module B, that shared
 *  logic gets extracted to utils/ or middleware/.
 */