/**
 * market/utils/marketHours.js — NYSE Market Hours Calculator
 *
 * Responsibility:
 *  Determines whether the NYSE is currently open for trading.
 *  Used by market/service.js which is called by trade/service.js
 *  before allowing any buy or sell action.
 *
 * What does not belong here:
 *  No HTTP handlers, no Redis writes, no trade logic.
 *  This module only answers one question: is the market open right now?
 *
 * How it fits into the request flow:
 *  POST /api/trade/buy or /sell
 *  → trade/service.js calls marketService.isMarketOpen()
 *  → market/service.js calls marketHours.isMarketOpen()
 *  → returns true or false
 *  → trade/service.js rejects the trade with 403 if false
 *
 * NYSE trading hours:
 *  Monday–Friday, 9:30am–4:00pm Eastern Time
 *  Closed on US federal holidays
 *  Early close at 1:00pm ET on Black Friday and Christmas Eve (if weekday)
 *
 * Development bypass:
 *  When NODE_ENV is not 'production', isMarketOpen() always returns true.
 *  This lets you test trades at any hour without changing .env flags.
 *  It is impossible to accidentally deploy with the bypass active because
 *  NODE_ENV is always 'production' on the server.
 */

const { get, set } = require('../cache/redisClient')
const { env } = require('../../../config/env')
const https = require('https')

// ── Constants ─────────────────────────────────────────────────────────────

// NYSE regular session: 9:30am–4:00pm Eastern Time
const MARKET_OPEN_HOUR = 9
const MARKET_OPEN_MINUTE = 30
const MARKET_CLOSE_HOUR = 16
const MARKET_CLOSE_MINUTE = 0

// NYSE early close time: 1:00pm Eastern Time
// Applies on Black Friday and Christmas Eve (if weekday)
const EARLY_CLOSE_HOUR = 13
const EARLY_CLOSE_MINUTE = 0

// Redis key and TTL for the holiday list
// Fetched once from date.nager.at, cached for 24 hours
const HOLIDAY_CACHE_KEY = `market:holidays:${new Date().getFullYear()}`
const HOLIDAY_CACHE_TTL = 60 * 60 * 24 // 24 hours in seconds

// ── Early close dates ─────────────────────────────────────────────────────

/**
 * getEarlyCloseDates(year)
 *
 * Returns a hardcoded list of early close dates for the given year.
 * These are NYSE-specific partial trading days not covered by the
 * federal holiday list from date.nager.at.
 *
 * Black Friday: the day after Thanksgiving (4th Thursday of November)
 * Christmas Eve: December 24th, only when it falls on a weekday
 *
 * Why hardcoded:
 *  There is no free API that reliably lists NYSE early close dates.
 *  The list is small, predictable, and changes only if NYSE policy changes.
 *  Hardcoding it is simpler and more reliable than scraping an external source.
 */
const getEarlyCloseDates = (year) => {
  const dates = []

  // Black Friday — day after the 4th Thursday of November
  // Find the first Thursday in November, then add 3 weeks + 1 day
  const nov1 = new Date(year, 10, 1) // November 1st (month is 0-indexed)
  const firstThursday = (4 - nov1.getDay() + 7) % 7 // Days until first Thursday
  const thanksgiving = new Date(year, 10, 1 + firstThursday + 21) // 4th Thursday
  const blackFriday = new Date(thanksgiving)
  blackFriday.setDate(thanksgiving.getDate() + 1)
  dates.push(blackFriday.toISOString().slice(0, 10)) // Format: YYYY-MM-DD

  // Christmas Eve — December 24th, only if it falls on a weekday (Mon–Fri)
  const christmasEve = new Date(year, 11, 24) // December 24th
  const dayOfWeek = christmasEve.getDay() // 0=Sun, 6=Sat
  if (dayOfWeek !== 0 && dayOfWeek !== 6) {
    dates.push(christmasEve.toISOString().slice(0, 10))
  }

  return dates
}

// ── Holiday fetcher ───────────────────────────────────────────────────────

/**
 * getHolidays(year)
 *
 * Returns an array of US federal holiday date strings (YYYY-MM-DD)
 * for the given year.
 *
 * Flow:
 *  1. Check Redis for cached holiday list
 *  2. Cache hit: return parsed array immediately
 *  3. Cache miss: fetch from date.nager.at, store in Redis, return array
 *
 * Why date.nager.at:
 *  Free, no API key, covers all US federal holidays including floating
 *  dates like Thanksgiving (4th Thursday of November) that cannot be
 *  hardcoded as a fixed month/day.
 */
const getHolidays = (year) => {
  // Returns a Promise because Redis and HTTP calls are async
  return new Promise(async (resolve, reject) => {
    try {
      // Step 1: check Redis cache
      const cached = await get(HOLIDAY_CACHE_KEY)
      if (cached) {
        // Cache hit — parse the JSON string back into an array and return
        return resolve(JSON.parse(cached))
      }

      // Step 2: cache miss — fetch from date.nager.at
      const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/US`

      https.get(url, (res) => {
        let raw = ''
        res.on('data', (chunk) => { raw += chunk })
        res.on('end', async () => {
          try {
            const holidays = JSON.parse(raw)

            // Extract just the date strings from the response objects
            // Response shape: [{ date: 'YYYY-MM-DD', name: '...', ... }]
            const dates = holidays.map(h => h.date)

            // Store in Redis for 24 hours so this fetch only happens once per day
            await set(HOLIDAY_CACHE_KEY, JSON.stringify(dates), HOLIDAY_CACHE_TTL)

            resolve(dates)
          } catch (err) {
            reject(new Error('Failed to parse holiday response: ' + err.message))
          }
        })
      }).on('error', (err) => {
        reject(new Error('Failed to fetch holidays: ' + err.message))
      })

    } catch (err) {
      reject(err)
    }
  })
}

// ── Main export ───────────────────────────────────────────────────────────

/**
 * isMarketOpen()
 *
 * Returns true if the NYSE is currently accepting trades, false otherwise.
 *
 * Checks in order:
 *  1. Development bypass — always true if NODE_ENV !== 'production'
 *  2. Weekend check — false on Saturday and Sunday
 *  3. Federal holiday check — false if today is a US federal holiday
 *  4. Early close check — false if today is an early close day and
 *     current EST time is past 1:00pm
 *  5. Trading hours check — true only between 9:30am and 4:00pm EST
 *
 * Why async:
 *  Step 3 requires reading from Redis (and possibly calling date.nager.at)
 *  which are async operations. The entire function must be async as a result.
 */
const isMarketOpen = async () => {

  // Step 1: development bypass
  // NODE_ENV=development means always open — lets you test trades at any hour
  // NODE_ENV=production means real calculation applies
  if (env.NODE_ENV !== 'production') {
    return true
  }

  // Get current time in Eastern Time (ET)
  // EST is UTC-5, EDT is UTC-4 — toLocaleString handles DST automatically
  const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const year = nowET.getFullYear()
  const month = nowET.getMonth()   // 0-indexed
  const date = nowET.getDate()
  const day = nowET.getDay()       // 0=Sunday, 6=Saturday
  const hour = nowET.getHours()
  const minute = nowET.getMinutes()

  // Format today as YYYY-MM-DD for comparison against holiday date strings
  const todayStr = `${year}-${String(nowET.getMonth() + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`

  // Step 2: weekend check
  if (day === 0 || day === 6) {
    return false
  }

  // Step 3: federal holiday check
  try {
    const holidays = await getHolidays(year)
    if (holidays.includes(todayStr)) {
      return false
    }
  } catch (err) {
    // If the holiday fetch fails, log it and continue.
    // Failing open (allowing trades) is better than blocking all trades
    // because a holiday API is temporarily unreachable.
    console.error('Market hours: holiday check failed, continuing:', err.message)
  }

  // Step 4: early close check
  const earlyCloseDates = getEarlyCloseDates(year)
  if (earlyCloseDates.includes(todayStr)) {
    // Market closes at 1:00pm ET on early close days
    const pastEarlyClose = hour > EARLY_CLOSE_HOUR ||
      (hour === EARLY_CLOSE_HOUR && minute >= EARLY_CLOSE_MINUTE)
    if (pastEarlyClose) return false
    // Before 1:00pm on an early close day — fall through to normal hours check
  }

  // Step 5: regular trading hours check
  // Market opens at 9:30am ET, closes at 4:00pm ET
  const afterOpen = hour > MARKET_OPEN_HOUR ||
    (hour === MARKET_OPEN_HOUR && minute >= MARKET_OPEN_MINUTE)
  const beforeClose = hour < MARKET_CLOSE_HOUR ||
    (hour === MARKET_CLOSE_HOUR && minute < MARKET_CLOSE_MINUTE)

  return afterOpen && beforeClose
}

module.exports = { isMarketOpen }