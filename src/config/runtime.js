// Runtime configuration parsed from URL params.
export function getRuntimeConfig() {
    const params = new URLSearchParams(window.location.search);
    return {
        apiKey: params.get('key'),
        sheetId: params.get('id')
    };
}

// Gemini mode flag + UI sync.
// We intentionally keep all behavior identical to the original implementation.
export function initGeminiModeToggle() {
    const path = window.location.pathname;
    let isGeminiMode = path.includes('/GEMINI_TTS/');

    const geminiToggle = document.getElementById('gemini-mode-toggle');
    if (geminiToggle) {
        geminiToggle.checked = isGeminiMode;
        geminiToggle.addEventListener('change', (event) => {
            isGeminiMode = event.target.checked;
        });

        if (!isGeminiMode) {
            geminiToggle.closest('label').style.display = 'none';
            geminiToggle.closest('label').nextElementSibling.style.display = 'none';
        }
    }

    return {
        isEnabled: () => isGeminiMode
    };
}
