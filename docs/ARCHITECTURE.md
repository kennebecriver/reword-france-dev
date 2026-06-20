# Project Architecture (brief)

This file provides an overview of the project's structure and data flows for Reword France.

- Entry point: `src/bootstrap.js` — composes the app, reads runtime config, creates API/engines and renders the UI.

- Main layers:
  - UI: `src/ui/*` — components and screens (topics, deck shell, cards).
  - State: `src/state/store.js` — mutable global store shaped as { appData, currentSession, dictationSession, listenSession }.
  - Engine: `src/engine/*` — mode logic (Study/Dictation = `cardsEngine`, Listen = `listenEngine`, Autoplay = `autoPlay`).
  - API: `src/api/sheetsApi.js` — loads data from Google Sheets.

- Data flows (simplified):
  1. `bootstrap` loads data via `createSheetsApi().fetchData()` and writes to `store.appData`.
  2. `renderTopics()` renders the topics grid from `store.appData`.
  3. On topic click `bootstrap` creates an engine (cards/listen) and calls `initDeck(name)`:
     - `initDeck` copies `store.appData[name]` into the corresponding session (e.g., `store.currentSession`).
     - the engine renders cards via `createStudyCard`/`createDictationCard`/`renderListenList`.
  4. TTS playback: engines request TTS via `fetchTTS`/`createAutoPlay` and play via `bgAudio`.

- Mutability notes:
  - `store` is mutable. Convention: only bootstrap and engines should modify `store.appData` and session keys.
  - `shuffleTopicSourceDeck` currently mutates `store.appData` in-place.

- Deletion mechanism (Listen mode):
  - `src/state/deletionManager.js` tracks deleted rows per sheet in `localStorage`.
  - Storage key format: `reword_deleted_rows_{sheetId}_{sheetName}`.
  - Flow: UI button click → `listenList.js` callback → `listenEngine._onDeleteCard` hook → `bootstrap.js` handler → `deletionManager.markRowDeleted/markRowRestored`.
  - Deleted rows are filtered out on next app load via `filterDeletedRows()`.
  - Cards remain visible in current session until reload.

- Recommendations:
  - Document the audio subsystem (`docs/AUDIO.md`).
  - Consider consolidating `window.*` globals into a single `app` namespace.
