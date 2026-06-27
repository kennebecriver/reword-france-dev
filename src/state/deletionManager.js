/**
 * deletionManager.js — Tracks marked rows per sheet.
 *
 * Stores hashed row identifiers in localStorage, keyed by sheetId + sheetName.
 * On next app load, these rows are marked with isMarked=true (not hidden).
 * Also calls /color_row API to paint/unpaint rows in the Google Sheet.
 */

import { djb2 } from '../engine/hash.js';

const STORAGE_PREFIX = 'reword_marked_rows_';
const COLOR_ROW_URL = 'https://reword-france-463001342259.northamerica-northeast2.run.app/color_row';

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
 * Compute a unique hash for a row.
 * @param {string} sheetId
 * @param {string} sheetName
 * @param {number} rowIndex
 * @returns {string}
 */
function rowHash(sheetId, sheetName, rowIndex) {
    return djb2(`${sheetId}:${sheetName}:${rowIndex}`);
}

/**
 * Get all marked row hashes for a sheet.
 * @param {string} sheetId
 * @param {string} sheetName
 * @returns {Set<string>}
 */
export function getMarkedRows(sheetId, sheetName) {
    const key = getStorageKey(sheetId, sheetName);
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    try {
        return new Set(JSON.parse(raw));
    } catch {
        return new Set();
    }
}

/**
 * Save marked rows to localStorage.
 * @param {string} sheetId
 * @param {string} sheetName
 * @param {Set<string>} marked
 */
function saveMarkedRows(sheetId, sheetName, marked) {
    const key = getStorageKey(sheetId, sheetName);
    localStorage.setItem(key, JSON.stringify([...marked]));
}

/**
 * Call /color_row API to paint or unpaint a row.
 * @param {string} sheetId
 * @param {string} sheetName
 * @param {number} rowIndex
 * @param {boolean} paint
 */
function callColorRow(sheetId, sheetName, rowIndex, paint) {
    fetch(COLOR_ROW_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId, sheetName, rowIndex, paint: paint ? 1 : 0 })
    }).catch(err => console.warn('color_row failed:', err));
}

/**
 * Mark a row as deleted (paint yellow + save hash).
 * @param {string} sheetId
 * @param {string} sheetName
 * @param {number} rowIndex - 1-indexed row number
 */
export function markRowDeleted(sheetId, sheetName, rowIndex) {
    const marked = getMarkedRows(sheetId, sheetName);
    marked.add(rowHash(sheetId, sheetName, rowIndex));
    saveMarkedRows(sheetId, sheetName, marked);
    callColorRow(sheetId, sheetName, rowIndex, true);
}

/**
 * Unmark a row (unpaint + remove hash).
 * @param {string} sheetId
 * @param {string} sheetName
 * @param {number} rowIndex
 */
export function markRowRestored(sheetId, sheetName, rowIndex) {
    const marked = getMarkedRows(sheetId, sheetName);
    marked.delete(rowHash(sheetId, sheetName, rowIndex));
    saveMarkedRows(sheetId, sheetName, marked);
    callColorRow(sheetId, sheetName, rowIndex, false);
}

/**
 * Apply marks to cards: set isMarked=true for rows that were previously marked.
 * Does NOT filter out — cards stay visible.
 * @param {Array} cards - Array of card objects with rowIndex property
 * @param {string} sheetId
 * @param {string} sheetName
 * @returns {Array}
 */
export function applyMarks(cards, sheetId, sheetName) {
    const marked = getMarkedRows(sheetId, sheetName);
    if (marked.size === 0) return cards;
    return cards.map(card => ({
        ...card,
        isMarked: marked.has(rowHash(sheetId, sheetName, card.rowIndex))
    }));
}
