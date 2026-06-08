import { getRuntimeConfig, initGeminiModeToggle } from './config/runtime.js';
import { createSheetsApi } from './api/sheetsApi.js';
import { createCardsEngine } from './engine/cardsEngine.js';
import { store } from './state/store.js';
import { renderTopics } from './ui/topics.js';
import { showView } from './ui/views.js';
import { mountDeckShell } from './ui/deckShell.js';
import { createStudyCard } from './ui/components/studyCard.js';
import { createDictationCard } from './ui/components/dictationCard.js';
import { createListenCard } from './ui/components/listenCard.js';
import { shuffleTopicSourceDeck } from './engine/shuffleUtils.js';

const runtimeConfig = getRuntimeConfig();

const studyViewEl = document.getElementById('view-deck');
const dictationViewEl = document.getElementById('view-deck-dictation');
const listenViewEl = document.getElementById('view-deck-listen');

if (!studyViewEl || !dictationViewEl || !listenViewEl) {
    throw new Error('bootstrap: deck view roots missing');
}

const studyShell = mountDeckShell(studyViewEl, { idSuffix: '' });
const dictShell = mountDeckShell(dictationViewEl, { idSuffix: 'dictation-' });
const listenShell = mountDeckShell(listenViewEl, { idSuffix: 'listen-' });

const geminiModeState = initGeminiModeToggle([
    studyShell.geminiToggle,
    dictShell.geminiToggle,
    listenShell.geminiToggle
]);
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

function focusDictationAnswerInput(stageEl) {
    const input = stageEl?.querySelector?.('.card-active .dictation-input');
    if (input instanceof HTMLInputElement) {
        requestAnimationFrame(() => input.focus({ preventScroll: true }));
    }
}

const DictationEngine = createCardsEngine({
    store,
    sessionKey: 'dictationSession',
    viewId: 'deck-dictation',
    showView,
    isGeminiModeEnabled: geminiModeState.isEnabled,
    buildCard: createDictationCard,
    onAfterSpawn() {
        focusDictationAnswerInput(dictShell.stage);
    },
    dom: {
        stage: dictShell.stage,
        deckTitleEl: dictShell.deckTitleEl,
        deckCounterEl: dictShell.deckCounterEl,
        playStatusEl: dictShell.playStatusEl,
        shuffleBtnEl: dictShell.shuffleBtnEl
    }
});

const ListenEngine = createCardsEngine({
    store,
    sessionKey: 'listenSession',
    viewId: 'deck-listen',
    showView,
    isGeminiModeEnabled: geminiModeState.isEnabled,
    buildCard: createListenCard,
    dom: {
        stage: listenShell.stage,
        deckTitleEl: listenShell.deckTitleEl,
        deckCounterEl: listenShell.deckCounterEl,
        playStatusEl: listenShell.playStatusEl,
        shuffleBtnEl: listenShell.shuffleBtnEl
    }
});

window.Engine = Engine;
window.DictationEngine = DictationEngine;
window.ListenEngine = ListenEngine;
window.showView = showView;

function bindDeckChrome(shell, engine) {
    shell.backBtn.addEventListener('click', () => showView('topics'));
    shell.doneBtn.addEventListener('click', () => engine.manualSwipe('left'));
    shell.playBtn.addEventListener('click', () => engine.playActiveCard());
    shell.repeatBtn.addEventListener('click', () => engine.manualSwipe('right'));
}

bindDeckChrome(studyShell, Engine);
bindDeckChrome(dictShell, DictationEngine);
bindDeckChrome(listenShell, ListenEngine);

function initDeckKeyboardShortcuts() {
    document.addEventListener(
        'keydown',
        (e) => {
            const studyActive = document.getElementById('view-deck')?.classList.contains('active');
            const dictActive = document.getElementById('view-deck-dictation')?.classList.contains('active');
            const listenActive = document.getElementById('view-deck-listen')?.classList.contains('active');
            if (!studyActive && !dictActive && !listenActive) return;

            const ctrl = e.ctrlKey && !e.metaKey;

            if (dictActive && ctrl && e.key === 'Enter') {
                e.preventDefault();
                DictationEngine.manualSwipe('left');
                return;
            }

            if (!ctrl || (e.key !== 'z' && e.key !== 'Z')) return;

            const inDictInput =
                dictActive && document.activeElement?.classList?.contains?.('dictation-input');
            if (inDictInput) return;

            e.preventDefault();
            if (dictActive) DictationEngine.manualSwipe('left');
            else if (listenActive) ListenEngine.manualSwipe('left');
            else Engine.manualSwipe('left');
        },
        true
    );
}

function initAutoPlayForDeck(shell, engine) {
    const toggle = shell.autoPlayToggle;

    const originalSpawn = engine.spawn;

    engine.spawn = function wrappedSpawn() {
        originalSpawn.apply(this, arguments);

        if (toggle.checked) {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    const activeCard = shell.stage.querySelector('.card-active');
                    if (activeCard && !engine._isPlaying) {
                        engine.playActiveCard();
                    }
                }, 150);
            });
        }
    };

    toggle.addEventListener('change', (event) => {
        if (/** @type {HTMLInputElement} */ (event.target).checked) {
            const activeCard = shell.stage.querySelector('.card-active');
            if (activeCard && !engine._isPlaying) {
                setTimeout(() => engine.playActiveCard(), 50);
            }
        }
    });
}

function initAutoPlay() {
    initAutoPlayForDeck(studyShell, Engine);
    initAutoPlayForDeck(dictShell, DictationEngine);
    initAutoPlayForDeck(listenShell, ListenEngine);
}

function bindShuffleButtons() {
    studyShell.shuffleBtnEl.addEventListener('click', () => Engine.shuffleDeck());
    dictShell.shuffleBtnEl.addEventListener('click', () => DictationEngine.shuffleDeck());
    listenShell.shuffleBtnEl.addEventListener('click', () => ListenEngine.shuffleDeck());
}

function bootstrapApp() {
    window.onload = async () => {
        try {
            store.appData = await api.fetchData();
            renderTopics(store.appData, {
                onDeckClick: (deckName) => Engine.initDeck(deckName),
                onDictationClick: (deckName) => DictationEngine.initDeck(deckName),
                onListenClick: (deckName) => ListenEngine.initDeck(deckName),
                onShuffleDeck: (deckName) => shuffleTopicSourceDeck(store, deckName)
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
    initDeckKeyboardShortcuts();
}

bootstrapApp();
