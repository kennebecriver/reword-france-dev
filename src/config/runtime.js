// Runtime configuration parsed from URL params.
/**
 * Return API configuration from URL query params: { apiKey, sheetId }.
 */
export function getRuntimeConfig() {
    const params = new URLSearchParams(window.location.search);
    return {
        apiKey: params.get('key'),
        sheetId: params.get('id')
    };
}

/** @param {HTMLInputElement[]} toggles */
function syncGeminiMetaVisibility(isGeminiPath, toggles) {
    if (isGeminiPath) return;
    toggles.forEach((toggle) => {
        if (!toggle) return;
        const label = toggle.closest('label');
        const next = label?.nextElementSibling;
        if (label) label.style.display = 'none';
        if (next && next.classList?.contains('toggle-label')) next.style.display = 'none';
    });
}

/** @param {HTMLInputElement[]} toggles */
function syncGeminiChecked(toggles, checked) {
    toggles.forEach((t) => {
        if (t) t.checked = checked;
    });
}

/**
 * Gemini flag + sync across multiple checkbox inputs (e.g. study + dictation deck screens).
 * @param {HTMLInputElement[]} geminiToggleInputs
 */
/**
 * Initialize a synchronized Gemini checkbox across multiple screens;
 * returns `{ isEnabled: () => boolean }` to read current state.
 */
export function initGeminiModeToggle(geminiToggleInputs = []) {
    const path = window.location.pathname;
    let isGeminiMode = !path.includes('/NO_GEMINI/');

    const toggles = geminiToggleInputs.filter(Boolean);

    syncGeminiMetaVisibility(isGeminiMode, toggles);

    toggles.forEach((geminiToggle) => {
        geminiToggle.checked = isGeminiMode;
        geminiToggle.addEventListener('change', (event) => {
            isGeminiMode = /** @type {HTMLInputElement} */ (event.target).checked;
            syncGeminiChecked(toggles, isGeminiMode);
        });
    });

    return {
        isEnabled: () => isGeminiMode
    };
}
