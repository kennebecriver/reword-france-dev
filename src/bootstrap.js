import { getRuntimeConfig, initGeminiModeToggle } from './config/runtime.js';
import { createSheetsApi } from './api/sheetsApi.js';
import { createCardsEngine } from './engine/cardsEngine.js';
import { store } from './state/store.js';
import { renderTopics } from './ui/topics.js';
import { showView } from './ui/views.js';

const runtimeConfig = getRuntimeConfig();
const geminiModeState = initGeminiModeToggle();
const api = createSheetsApi(runtimeConfig);

const Engine = createCardsEngine({
    store,
    showView,
    isGeminiModeEnabled: geminiModeState.isEnabled
});

// Keep globals to preserve existing inline handlers in HTML.
window.Engine = Engine;
window.showView = showView;

function initAutoPlay() {
    const toggle = document.getElementById('auto-play-toggle');
    if (!toggle) return;

    // Save original spawn and wrap with auto-play behavior.
    const originalSpawn = Engine.spawn;

    Engine.spawn = function wrappedSpawn() {
        originalSpawn.apply(this, arguments);

        if (toggle.checked) {
            // Small delay to avoid animation race conditions.
            requestAnimationFrame(() => {
                setTimeout(() => {
                    const activeCard = document.querySelector('.card-active');
                    if (activeCard && !Engine._isPlaying) {
                        Engine.playActiveCard();
                    }
                }, 150);
            });
        }
    };

    // When switched on, immediately play current active card.
    toggle.addEventListener('change', (event) => {
        if (event.target.checked) {
            const activeCard = document.querySelector('.card-active');
            if (activeCard && !Engine._isPlaying) {
                setTimeout(() => Engine.playActiveCard(), 50);
            }
        }
    });
}

function bindUIEvents() {
    document.getElementById('shuffle-btn')?.addEventListener('click', () => {
        Engine.shuffleDeck();
    });
}

function bootstrapApp() {
    window.onload = async () => {
        try {
            store.appData = await api.fetchData();
            renderTopics(store.appData, (deckName) => Engine.initDeck(deckName));
            showView('topics');
        } catch (err) {
            document.getElementById('loading-msg').innerHTML = `<span style="color:#ff6b6b">Error: ${err.message}</span>`;
        }
    };

    bindUIEvents();
    initAutoPlay();
}

bootstrapApp();
