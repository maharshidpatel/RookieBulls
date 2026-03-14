/**
 * market/utils/marketHours.js — NYSE Market Hours Calculator
 *
 * Responsibility:
 *  Determines whether the NYSE is currently open for trading.
 *  Exports time utility functions used by service.js and priceUpdater.js.
 *
 * EXPORTS:
 *  isMarketOpen()                — is NYSE currently open? (time + date check)
 *  isTradingDay()                — is today a market day? (date only, no time)
 *  isPastMarketClose()           — is current ET time past 4:16 PM? (sync)
 *  secondsUntilNextMarketOpen()  — TTL utility for candles, profile, flags
 *  secondsUntilMarketClose()     — TTL utility, exported for completeness
 *
 * Why isTradingDay() and isPastMarketClose() are separate:
 *  priceUpdater.js closing batch fires when isMarketOpen() = false
 *  but needs to distinguish "before open" from "after close" on a trading day.
 *  isPastMarketClose() handles the time check (sync, no Redis).
 *  isTradingDay() handles the date check (async, holiday lookup).
 *  Together they gate the closing batch to run exactly once per trading day.
 *
 * Adjusted for Stooq 15-minute data delay:
 *  Open:  9:45 AM ET  (NYSE 9:30 AM + 15 min)
 *  Close: 4:15 PM ET  (NYSE 4:00 PM + 15 min)
 *  Closing batch: 4:16 PM ET (1 minute buffer after adjusted close)
 */

const { get, set } = require('../cache/redisClient')
const { env } = require('../../../config/env')
const https = require('https')

// ── NYSE session constants (adjusted for 15-min Stooq delay) ─────────────

const MARKET_OPEN_HOUR    = 9
const MARKET_OPEN_MINUTE  = 45  // 9:30 AM + 15 min delay
const MARKET_CLOSE_HOUR   = 16
const MARKET_CLOSE_MINUTE = 15  // 4:00 PM + 15 min delay

const EARLY_CLOSE_HOUR    = 13
const EARLY_CLOSE_MINUTE  = 15  // 1:00 PM + 15 min delay

// Closing batch fires at 4:16 PM — 1 minute after adjusted close
// Ensures last Stooq batch has the final delayed closing price
const CLOSING_BATCH_HOUR   = 16
const CLOSING_BATCH_MINUTE = 16

const HOLIDAY_CACHE_KEY = `market:holidays:${new Date().getFullYear()}`
const HOLIDAY_CACHE_TTL = 60 * 60 * 24 // 24 hours

// ── secondsUntilNextMarketOpen() ──────────────────────────────────────────
//
// Returns seconds from now until 9:45 AM ET on the next trading day.
//
// Used as TTL for:
//  candles:TICKER         — expires at open, fresh chart each session
//  profile:TICKER         — expires at open, fresh company data each session
//  watched:tickers        — clean slate each trading day
//  market:opening:done    — expires at next open so opening job repeats
//  market:closing:done    — expires at next open so closing job repeats
//  prevClose:TICKER       — valid until opening job overwrites it next day
//
// Handles weekends: Friday after close → Monday 9:45 AM
// Does NOT account for holidays — TTL slightly short on holiday weeks.
// Acceptable for cache expiry purposes.
// Minimum 60 seconds — prevents TTL of 0 at exact open time.
const secondsUntilNextMarketOpen = () => {
  const nowET = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  )

  const next = new Date(nowET)
  next.setHours(MARKET_OPEN_HOUR, MARKET_OPEN_MINUTE, 0, 0)

  if (nowET >= next) next.setDate(next.getDate() + 1)

  const day = next.getDay()
  if (day === 6) next.setDate(next.getDate() + 2) // Saturday → Monday
  if (day === 0) next.setDate(next.getDate() + 1) // Sunday → Monday

  const diffSec = Math.ceil((next.getTime() - nowET.getTime()) / 1000)
  return Math.max(diffSec, 60)
}

// ── secondsUntilMarketClose() ─────────────────────────────────────────────
//
// Returns seconds from now until 4:15 PM ET today.
// Returns 0 if market has already closed today.
// Exported for completeness — used for closingPrice:TICKER TTL calculation.
const secondsUntilMarketClose = () => {
  const nowET = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  )
  const close = new Date(nowET)
  close.setHours(MARKET_CLOSE_HOUR, MARKET_CLOSE_MINUTE, 0, 0)
  const diffSec = Math.ceil((close.getTime() - nowET.getTime()) / 1000)
  return Math.max(diffSec, 0)
}

// ── isPastMarketClose() ───────────────────────────────────────────────────
//
// Returns true if current ET time is at or past 4:16 PM.
// Sync — no Redis, no async. Used by priceUpdater to detect after-close state.
//
// Why 4:16 PM (not 4:15):
//  1 minute buffer ensures last Stooq batch has the final closing price.
//  Stooq data is 15 min delayed — by 4:16 PM adjusted time, the final
//  price data is confirmed available.
//
// Used together with isTradingDay() to gate the closing batch:
//  isPastMarketClose() = true AND isTradingDay() = true → run closing batch
const isPastMarketClose = () => {
  const nowET = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  )
  const hour   = nowET.getHours()
  const minute = nowET.getMinutes()
  return hour > CLOSING_BATCH_HOUR ||
    (hour === CLOSING_BATCH_HOUR && minute >= CLOSING_BATCH_MINUTE)
}

// ── isTradingDay() ────────────────────────────────────────────────────────
//
// Returns true if today is a market trading day — weekday, not a holiday.
// Does NOT check current time — date only.
//
// Used by priceUpdater for two jobs:
//  Opening job: only copy closingPrice → prevClose on actual trading days
//  Closing job: only capture closing price on actual trading days
//
// Why separate from isMarketOpen():
//  isMarketOpen() checks time AND date — false before 9:45 AM even on weekdays.
//  isTradingDay() checks date only — true all day on a trading day.
//  The closing batch fires after 4:16 PM when isMarketOpen() is false,
//  so we need a way to confirm today was a trading day without a time check.
const isTradingDay = async () => {
  const nowET = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  )
  const day = nowET.getDay()
  if (day === 0 || day === 6) return false

  const year     = nowET.getFullYear()
  const todayStr = `${year}-${String(nowET.getMonth() + 1).padStart(2, '0')}-${String(nowET.getDate()).padStart(2, '0')}`

  try {
    const holidays = await getHolidays(year)
    if (holidays.includes(todayStr)) return false
  } catch {
    return true // fail open — better to run than skip on API failure
  }

  return true
}

// ── getEarlyCloseDates(year) ──────────────────────────────────────────────
//
// Hardcoded NYSE early close dates — Black Friday and Christmas Eve (if weekday).
// No free API covers these reliably.
const getEarlyCloseDates = (year) => {
  const dates = []

  const nov1 = new Date(year, 10, 1)
  const firstThursday = (4 - nov1.getDay() + 7) % 7
  const thanksgiving  = new Date(year, 10, 1 + firstThursday + 21)
  const blackFriday   = new Date(thanksgiving)
  blackFriday.setDate(thanksgiving.getDate() + 1)
  dates.push(blackFriday.toISOString().slice(0, 10))

  const christmasEve = new Date(year, 11, 24)
  const dow = christmasEve.getDay()
  if (dow !== 0 && dow !== 6) dates.push(christmasEve.toISOString().slice(0, 10))

  return dates
}

// ── getHolidays(year) ─────────────────────────────────────────────────────
//
// Returns US federal holiday date strings for a given year.
// Redis cached 24 hours — fetches from date.nager.at on miss.
const getHolidays = (year) => {
  return new Promise(async (resolve, reject) => {
    try {
      const cached = await get(HOLIDAY_CACHE_KEY)
      if (cached) return resolve(JSON.parse(cached))

      const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/US`
      https.get(url, (res) => {
        let raw = ''
        res.on('data', (chunk) => { raw += chunk })
        res.on('end', async () => {
          try {
            const holidays = JSON.parse(raw)
            const dates    = holidays.map(h => h.date)
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

// ── isMarketOpen() ────────────────────────────────────────────────────────
//
// Returns true if NYSE is currently accepting trades.
// Development bypass: always true when NODE_ENV !== 'production'.
//
// Check order:
//  1. Dev bypass
//  2. Weekend
//  3. Federal holiday
//  4. Early close (Black Friday / Christmas Eve)
//  5. Trading hours 9:45 AM – 4:15 PM ET
const isMarketOpen = async () => {
  if (env.NODE_ENV !== 'production') return true

  const nowET = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  )

  const year   = nowET.getFullYear()
  const day    = nowET.getDay()
  const hour   = nowET.getHours()
  const minute = nowET.getMinutes()
  const todayStr = `${year}-${String(nowET.getMonth() + 1).padStart(2, '0')}-${String(nowET.getDate()).padStart(2, '0')}`

  if (day === 0 || day === 6) return false

  try {
    const holidays = await getHolidays(year)
    if (holidays.includes(todayStr)) return false
  } catch (err) {
    console.error('Market hours: holiday check failed, continuing:', err.message)
  }

  const earlyCloseDates = getEarlyCloseDates(year)
  if (earlyCloseDates.includes(todayStr)) {
    const pastEarlyClose = hour > EARLY_CLOSE_HOUR ||
      (hour === EARLY_CLOSE_HOUR && minute >= EARLY_CLOSE_MINUTE)
    if (pastEarlyClose) return false
  }

  const afterOpen   = hour > MARKET_OPEN_HOUR ||
    (hour === MARKET_OPEN_HOUR && minute >= MARKET_OPEN_MINUTE)
  const beforeClose = hour < MARKET_CLOSE_HOUR ||
    (hour === MARKET_CLOSE_HOUR && minute < MARKET_CLOSE_MINUTE)

  return afterOpen && beforeClose
}

module.exports = {
  isMarketOpen,
  isTradingDay,
  isPastMarketClose,
  secondsUntilNextMarketOpen,
  secondsUntilMarketClose,
}