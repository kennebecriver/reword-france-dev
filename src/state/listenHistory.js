/**
 * listenHistory.js — Persists Listen mode card order and active position.
 *
 * Stores in localStorage:
 * - order: array of rowIndex values in current deck order
 * - activeIndex: position of currently active card
 * - cardCount: number of cards when saved (for desync detection)
 *
 * Key format: reword_listen_history_{sheetId}_{deckName}
 */

const STORAGE_PREFIX = 'reword_listen_history_';

/**
 * Get the localStorage key for a deck's listen history.
 * @param {string} sheetId
 * @param {string} deckName
 * @returns {string}
 */
function getStorageKey(sheetId, deckName) {
    return `${STORAGE_PREFIX}${sheetId}_${deckName}`;
}

/**
 * Load listen history for a deck.
 * @param {string} sheetId
 * @param {string} deckName
 * @returns {{ order: number[], activeIndex: number, cardCount: number } | null}
 */
export function loadListenHistory(sheetId, deckName) {
    const key = getStorageKey(sheetId, deckName);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.order) || typeof parsed.activeIndex !== 'number' || typeof parsed.cardCount !== 'number') {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

/**
 * Save listen history for a deck.
 * @param {string} sheetId
 * @param {string} deckName
 * @param {number[]} order - Array of rowIndex values
 * @param {number} activeIndex - Current active card position
 */
export function saveListenHistory(sheetId, deckName, order, activeIndex) {
    const key = getStorageKey(sheetId, deckName);
    const data = {
        order,
        activeIndex,
        cardCount: order.length
    };
    localStorage.setItem(key, JSON.stringify(data));
}

/**
 * Clear listen history for a deck.
 * @param {string} sheetId
 * @param {string} deckName
 */
export function clearListenHistory(sheetId, deckName) {
    const key = getStorageKey(sheetId, deckName);
    localStorage.removeItem(key);
}

/**
 * Check if saved history is still valid (card count matches).
 * @param {string} sheetId
 * @param {string} deckName
 * @param {number} currentCardCount
 * @returns {boolean}
 */
export function isHistoryValid(sheetId, deckName, currentCardCount) {
    const history = loadListenHistory(sheetId, deckName);
    if (!history) return false;
    return history.cardCount === currentCardCount;
}
