/*
 * FILE: client/src/utils/inactivityTimer.js
 *
 * RESPONSIBILITY:
 *   Tracks user activity and calls logout() after 10 minutes of inactivity.
 *   Activity is defined as: mouse move, click, keypress, scroll, touch.
 *
 * HOW IT WORKS:
 *   A timer is set for 10 minutes on start.
 *   Every time a tracked event fires, the timer resets.
 *   If 10 minutes pass with no event, the logout callback is called.
 *
 * WHAT DOES NOT BELONG HERE:
 *   Auth state, API calls, React components.
 *   This is a pure utility — it receives logout as a callback.
 *
 * USAGE:
 *   Call startInactivityTimer(logout) when the user logs in.
 *   Call stopInactivityTimer() when the user logs out.
 */

// 10 minutes in milliseconds
const INACTIVITY_LIMIT = 10 * 60 * 1000;

// Events that count as user activity
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];

let timer = null;
let logoutCallback = null;

function resetTimer() {
  // Clear the existing timer and start a fresh one.
  // This runs every time a tracked activity event fires.
  clearTimeout(timer);
  timer = setTimeout(() => {
    // 10 minutes elapsed with no activity.
    // Call the logout function passed in at start.
    if (logoutCallback) {
      logoutCallback();
    }
  }, INACTIVITY_LIMIT);
}

export function startInactivityTimer(onInactive) {
  // Store the logout callback so resetTimer can access it.
  logoutCallback = onInactive;

  // Attach all activity listeners to the window.
  // passive: true tells the browser these listeners will not call
  // preventDefault() — allows the browser to optimize scroll performance.
  ACTIVITY_EVENTS.forEach((event) => {
    window.addEventListener(event, resetTimer, { passive: true });
  });

  // Start the initial timer immediately.
  resetTimer();
}

export function stopInactivityTimer() {
  // Clear the timer and remove all event listeners.
  // Called on logout to prevent the timer from running unnecessarily.
  clearTimeout(timer);
  timer = null;
  logoutCallback = null;

  ACTIVITY_EVENTS.forEach((event) => {
    window.removeEventListener(event, resetTimer);
  });
}