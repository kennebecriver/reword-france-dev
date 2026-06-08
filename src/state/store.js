// Centralized mutable state for the whole SPA.
// We keep the same runtime model as before, only move it into a dedicated module.
export const store = {
    appData: {},
    currentSession: [],
    dictationSession: [],
    listenSession: []
};
