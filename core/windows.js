'use strict';
// windows.js — Ventanas COT en hora Colombia (UTC-5, sin DST)

const WINDOWS = {
  LDN_NY: { name: 'LDN/NY Overlap', startH: 8, startM: 30, endH: 10, endM: 30 },
  ASIAN:  { name: 'Asian Open',      startH: 19, startM: 0, endH: 21, endM: 0  },
};

function nowColombia() {
  // Colombia = UTC-5, no DST
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc - 5 * 3600000);
}

function inWindow(col, win) {
  const totalMin = col.getHours() * 60 + col.getMinutes();
  const startMin = win.startH * 60 + win.startM;
  const endMin   = win.endH   * 60 + win.endM;
  return totalMin >= startMin && totalMin < endMin;
}

function getCurrentWindow() {
  const col = nowColombia();
  for (const [key, win] of Object.entries(WINDOWS)) {
    if (inWindow(col, win)) return { active: true, key, name: win.name, col };
  }
  return { active: false, key: null, name: 'OBSERVE', col };
}

function isInWindow() {
  return getCurrentWindow().active;
}

function minutesUntilNextWindow() {
  const col = nowColombia();
  const totalMin = col.getHours() * 60 + col.getMinutes();
  const nexts = Object.values(WINDOWS)
    .map(w => {
      const startMin = w.startH * 60 + w.startM;
      const diff = startMin > totalMin ? startMin - totalMin : 1440 - totalMin + startMin;
      return { name: w.name, minutes: diff };
    })
    .sort((a, b) => a.minutes - b.minutes);
  return nexts[0];
}

module.exports = { getCurrentWindow, isInWindow, minutesUntilNextWindow, WINDOWS };
