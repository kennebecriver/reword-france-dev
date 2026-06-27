/**
 * deletionManager.js — Tracks deleted rows per sheet.
 *
 * Stores deleted row indices in localStorage, keyed by sheetId + sheetName.
 * On next app load, these rows are excluded from decks.
 */

const STORAGE_PREFIX = 'reword_deleted_rows_';

/**
 * Get the localStorage key for a specific sheet.
 * @param {string} sheetId
 * @param {string} sheetName
 * @returns {string}
 */
function getStorageKey(sheetId, sheetName) {
    return `${STORAGE_PREFIX}${sheetId}_${sheetName}`;
}

/**
 * Get all deleted row indices for a sheet.
 * @param {string} sheetId
 * @param {string} sheetName
 * @returns {Set<number>}
 */
export function getDeletedRows(sheetId, sheetName) {
    // Stub: deletion tracking disabled for now
    return new Set();
}

/**
 * Mark a row as deleted.
 * @param {string} sheetId
 * @param {string} sheetName
 * @param {number} rowIndex - 1-indexed row number
 */
export function markRowDeleted(sheetId, sheetName, rowIndex) {
    const deleted = getDeletedRows(sheetId, sheetName);
    deleted.add(rowIndex);
    const key = getStorageKey(sheetId, sheetName);
    //localStorage.setItem(key, JSON.stringify([...deleted]));
}

/**
 * Unmark a row as deleted (restore it).
 * @param {string} sheetId
 * @param {string} sheetName
 * @param {number} rowIndex
 */
export function markRowRestored(sheetId, sheetName, rowIndex) {
    const deleted = getDeletedRows(sheetId, sheetName);
    deleted.delete(rowIndex);
    const key = getStorageKey(sheetId, sheetName);
    //localStorage.setItem(key, JSON.stringify([...deleted]));
}

/**
 * Filter out deleted rows from a deck.
 * @param {Array} cards - Array of card objects with rowIndex property
 * @param {string} sheetId
 * @param {string} sheetName
 * @returns {Array}
 */
export function filterDeletedRows(cards, sheetId, sheetName) {
    const deleted = getDeletedRows(sheetId, sheetName);
    if (deleted.size === 0) return cards;
    return cards.filter(card => !deleted.has(card.rowIndex));
}
