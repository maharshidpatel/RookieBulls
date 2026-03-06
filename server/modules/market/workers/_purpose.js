/**
 * FOLDER: /server/modules/market/workers
 *
 * Contains background processes that run on a fixed interval
 * independently of user requests.
 *
 * Why background workers exist:
 *  Without a worker, prices are only fetched when a user makes
 *  a request. This means the first user to load their portfolio
 *  after a cache expiry triggers live Stooq calls — adding latency
 *  to their request and risking rate limit issues under load.
 *
 *  Workers invert this: prices are always warm in Redis before
 *  any user request arrives. User requests only ever read from
 *  Redis — they never trigger external provider calls for prices.
 *
 * Workers are started once from server.js after MongoDB and Redis
 * connect. They run for the lifetime of the server process.
 *
 * FILES:
 *  priceUpdater.js
 *    Interval:  every 60 seconds
 *    Behavior:  queries Position.distinct('ticker') from MongoDB
 *               fetches latest quote from stooqProvider for each ticker
 *               writes price:TICKER and quote:TICKER into Redis (TTL 90s)
 *    Scale:     only fetches tickers with active user positions
 *               0 external calls if no positions exist
 *    Started:   server.js calls startPriceUpdater() after connectDB()
 */