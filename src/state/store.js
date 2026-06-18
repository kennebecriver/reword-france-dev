/**
 * Central mutable application store.
 * Fields: `appData` — loaded topics, `currentSession`, `dictationSession`, `listenSession` — session queues/arrays.
 * Rule: only engines (`createCardsEngine`, `createListenEngine`) and bootstrap should mutate these keys.
 */
// Centralized mutable state for the whole SPA.
// We keep the same runtime model as before, only move it into a dedicated module.
export const store = {
    appData: {},
    currentSession: [],
    dictationSession: [],
    listenSession: []
};
