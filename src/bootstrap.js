import { getRuntimeConfig, initGeminiModeToggle } from './config/runtime.js';
import { createSheetsApi } from './api/sheetsApi.js';
import { createCardsEngine } from './engine/cardsEngine.js';
import { createListenEngine } from './engine/listenEngine.js';
import { createAutoPlay, fetchTTS } from './engine/autoPlay.js';
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

const studyShell = mountDeckShell(studyViewEl, { idSuffix: '', hideOnAir: true });
const dictShell = mountDeckShell(dictationViewEl, { idSuffix: 'dictation-', hideOnAir: true });
const listenShell = mountDeckShell(listenViewEl, { idSuffix: 'listen-', hideAutoPlay: true });

listenShell.doneBtn.textContent = 'Back';
listenShell.doneBtn.classList.remove('btn-done');
listenShell.doneBtn.classList.add('btn-nav-back');
listenShell.repeatBtn.textContent = 'Next';
listenShell.repeatBtn.classList.remove('btn-repeat');
listenShell.repeatBtn.classList.add('btn-nav-next');

function hideGeminiToggle(shell) {
    const geminiToggle = shell.geminiToggle;
    if (!geminiToggle) return;

    const label = geminiToggle.closest('label');
    const caption = label?.nextElementSibling;
    if (label) label.style.display = 'none';
    if (caption?.classList?.contains('toggle-label')) caption.style.display = 'none';
    geminiToggle.disabled = true;
}

const geminiModeState = initGeminiModeToggle([studyShell.geminiToggle, dictShell.geminiToggle]);
hideGeminiToggle(listenShell);

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

const ListenEngine = createListenEngine({
    store,
    sessionKey: 'listenSession',
    viewId: 'deck-listen',
    showView,
    dom: {
        stage: listenShell.stage,
        deckTitleEl: listenShell.deckTitleEl,
        deckCounterEl: listenShell.deckCounterEl,
        playStatusEl: listenShell.playStatusEl,
        shuffleBtnEl: listenShell.shuffleBtnEl,
        backNavBtn: listenShell.doneBtn,
        nextNavBtn: listenShell.repeatBtn
    }
});

// ─── On Air (auto-play) for Listen mode ──────────────────────────────────

function setOnAirButtonState(isActive, isPaused) {
    const btn = listenShell.onairBtnEl;
    if (isActive && !isPaused) {
        btn.textContent = '⏹';
        btn.classList.add('onair-active');
        btn.title = 'Stop auto-play';
    } else if (isActive && isPaused) {
        btn.textContent = '⏸';
        btn.classList.add('onair-active');
        btn.title = 'Resume auto-play';
    } else {
        btn.textContent = '▶';
        btn.classList.remove('onair-active');
        btn.title = 'Auto-play mode';
    }
}

const listenAutoPlay = createAutoPlay({
    getCurrentIndex: () => {
        const deck = store.listenSession;
        const activeItem = listenShell.stage.querySelector('.listen-list-item.active');
        if (!deck || !activeItem) return 0;
        return parseInt(activeItem.dataset.index, 10) || 0;
    },
    getDeckLength: () => store.listenSession.length,
    goNextInternal: () => ListenEngine._goNextInternal(),
    goBackInternal: () => ListenEngine._goBackInternal(),
    fetchTTS,
    getCardData: () => {
        const activeItem = listenShell.stage.querySelector('.listen-list-item.active');
        if (!activeItem) return null;
        const card = activeItem.querySelector('.listen-card-inner');
        return card ? { text1: card.dataset.t1, text2: card.dataset.t2 } : null;
    },
    onStateChange: setOnAirButtonState,
    onStepStart: () => {
        // blink play status if needed
    }
});

// Attach auto-play hooks to ListenEngine
ListenEngine._onCardRendered = () => listenAutoPlay.onCardRendered();
ListenEngine._autoPlayStop = () => listenAutoPlay.stop();

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

function bindListenChrome(shell, engine) {
    shell.backBtn.addEventListener('click', () => showView('topics'));
    shell.doneBtn.addEventListener('click', () => engine.goBack());
    shell.playBtn.addEventListener('click', () => engine.playActiveCard());
    shell.repeatBtn.addEventListener('click', () => engine.goNext());
    shell.onairBtnEl.addEventListener('click', () => {
        if (listenAutoPlay.isPlaying() || listenAutoPlay.isPaused()) {
            listenAutoPlay.togglePause();
        } else {
            listenAutoPlay.start();
        }
    });
}

bindDeckChrome(studyShell, Engine);
bindDeckChrome(dictShell, DictationEngine);
bindListenChrome(listenShell, ListenEngine);

function initDeckKeyboardShortcuts() {
    document.addEventListener(
        'keydown',
        (e) => {
            const listenActive = document.getElementById('view-deck-listen')?.classList.contains('active');
            const studyActive = document.getElementById('view-deck')?.classList.contains('active');
            const dictActive = document.getElementById('view-deck-dictation')?.classList.contains('active');
            if (!studyActive && !dictActive && !listenActive) return;

            const ctrl = e.ctrlKey && !e.metaKey;

            // Media keys routed to Media Session API instead (handles headphones)
            if (listenActive && (e.key === 'MediaPlayPause' || e.key === 'Play' || e.key === 'Pause')) {
                e.preventDefault();
                return;
            }

            if (listenActive && e.key === 'ArrowLeft') {
                e.preventDefault();
                ListenEngine.goBack();
                return;
            }

            if (listenActive && e.key === 'ArrowRight') {
                e.preventDefault();
                ListenEngine.goNext();
                return;
            }

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
    // Listen mode uses On Air button instead of the old auto-play toggle
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
