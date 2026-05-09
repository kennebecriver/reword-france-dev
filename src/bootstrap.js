import { getRuntimeConfig, initGeminiModeToggle } from './config/runtime.js';
import { createSheetsApi } from './api/sheetsApi.js';
import { createCardsEngine } from './engine/cardsEngine.js';
import { store } from './state/store.js';
import { renderTopics } from './ui/topics.js';
import { showView } from './ui/views.js';
import { mountDeckShell } from './ui/deckShell.js';
import { createStudyCard } from './ui/components/studyCard.js';
import { createDictationCard } from './ui/components/dictationCard.js';

const runtimeConfig = getRuntimeConfig();

const studyViewEl = document.getElementById('view-deck');
const dictationViewEl = document.getElementById('view-deck-dictation');

if (!studyViewEl || !dictationViewEl) {
    throw new Error('bootstrap: deck view roots missing');
}

const studyShell = mountDeckShell(studyViewEl, { idSuffix: '' });
const dictShell = mountDeckShell(dictationViewEl, { idSuffix: 'dictation-', hideAutoPlay: true });

const geminiModeState = initGeminiModeToggle([studyShell.geminiToggle, dictShell.geminiToggle]);
const api = createSheetsApi(runtimeConfig);

const Engine = createCardsEngine({
    store,
    sessionKey: 'currentSession',
    viewId: 'deck',
    showView,
    isGeminiModeEnabled: geminiModeState.isEnabled,
    buildCard: createStudyCard,
    dom: {
        stage: studyShell.stage,
        deckTitleEl: studyShell.deckTitleEl,
        deckCounterEl: studyShell.deckCounterEl,
        playStatusEl: studyShell.playStatusEl,
        shuffleBtnEl: studyShell.shuffleBtnEl
    }
});

const DictationEngine = createCardsEngine({
    store,
    sessionKey: 'dictationSession',
    viewId: 'deck-dictation',
    showView,
    isGeminiModeEnabled: geminiModeState.isEnabled,
    buildCard: createDictationCard,
    dom: {
        stage: dictShell.stage,
        deckTitleEl: dictShell.deckTitleEl,
        deckCounterEl: dictShell.deckCounterEl,
        playStatusEl: dictShell.playStatusEl,
        shuffleBtnEl: dictShell.shuffleBtnEl
    }
});

window.Engine = Engine;
window.DictationEngine = DictationEngine;
window.showView = showView;

function bindDeckChrome(shell, engine) {
    shell.backBtn.addEventListener('click', () => showView('topics'));
    shell.doneBtn.addEventListener('click', () => engine.manualSwipe('left'));
    shell.playBtn.addEventListener('click', () => engine.playActiveCard());
    shell.repeatBtn.addEventListener('click', () => engine.manualSwipe('right'));
}

bindDeckChrome(studyShell, Engine);
bindDeckChrome(dictShell, DictationEngine);

function initAutoPlay() {
    const toggle = studyShell.autoPlayToggle;

    const originalSpawn = Engine.spawn;

    Engine.spawn = function wrappedSpawn() {
        originalSpawn.apply(this, arguments);

        if (toggle.checked) {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    const activeCard = studyShell.stage.querySelector('.card-active');
                    if (activeCard && !Engine._isPlaying) {
                        Engine.playActiveCard();
                    }
                }, 150);
            });
        }
    };

    toggle.addEventListener('change', (event) => {
        if (/** @type {HTMLInputElement} */ (event.target).checked) {
            const activeCard = studyShell.stage.querySelector('.card-active');
            if (activeCard && !Engine._isPlaying) {
                setTimeout(() => Engine.playActiveCard(), 50);
            }
        }
    });
}

function bindShuffleButtons() {
    studyShell.shuffleBtnEl.addEventListener('click', () => Engine.shuffleDeck());
    dictShell.shuffleBtnEl.addEventListener('click', () => DictationEngine.shuffleDeck());
}

function bootstrapApp() {
    window.onload = async () => {
        try {
            store.appData = await api.fetchData();
            renderTopics(store.appData, {
                onDeckClick: (deckName) => Engine.initDeck(deckName),
                onDictationClick: (deckName) => DictationEngine.initDeck(deckName)
            });
            showView('topics');
        } catch (err) {
            const loadingMsg = document.getElementById('loading-msg');
            if (loadingMsg) {
                loadingMsg.textContent = `Error: ${err.message}`;
                loadingMsg.style.color = '#ff6b6b';
            }
        }
    };

    bindShuffleButtons();
    initAutoPlay();
}

bootstrapApp();
