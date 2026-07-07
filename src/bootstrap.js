import { getRuntimeConfig, initGeminiModeToggle } from './config/runtime.js';
import { createSheetsApi } from './api/sheetsApi.js';
import { createCardsEngine } from './engine/cardsEngine.js';
import { createListenEngine } from './engine/listenEngine.js';
import { createAutoPlay, createAutoPlayFr, fetchTTS } from './engine/autoPlay.js';
import { store } from './state/store.js';
import { renderTopics } from './ui/topics.js';
import { showView } from './ui/views.js';
import { mountDeckShell } from './ui/deckShell.js';
import { createStudyCard } from './ui/components/studyCard.js';
import { createDictationCard } from './ui/components/dictationCard.js';
import { createListenCard, revealHiddenPhrase } from './ui/components/listenCard.js';
import { shuffleTopicSourceDeck } from './engine/shuffleUtils.js';
import { applyMarks, markRowDeleted, markRowRestored, clearMarkedRows } from './state/deletionManager.js';
import { clearListenHistory } from './state/listenHistory.js';

const runtimeConfig = getRuntimeConfig();

const studyViewEl = document.getElementById('view-deck');
const dictationViewEl = document.getElementById('view-deck-dictation');
const listenViewEl = document.getElementById('view-deck-listen');

if (!studyViewEl || !dictationViewEl || !listenViewEl) {
    throw new Error('bootstrap: deck view roots missing');
}

const studyShell = mountDeckShell(studyViewEl, { idSuffix: '', hideOnAir: true });
const dictShell = mountDeckShell(dictationViewEl, { idSuffix: 'dictation-', hideOnAir: true });
const listenShell = mountDeckShell(listenViewEl, { idSuffix: 'listen-', hideAutoPlay: true, showRevealToggle: true });

listenShell.doneBtn.textContent = 'Back';
listenShell.doneBtn.classList.remove('btn-done');
listenShell.doneBtn.classList.add('btn-nav-back');
listenShell.repeatBtn.textContent = 'Next';
listenShell.repeatBtn.classList.remove('btn-repeat');
listenShell.repeatBtn.classList.add('btn-nav-next');

const geminiModeState = initGeminiModeToggle([studyShell.geminiToggle, dictShell.geminiToggle, listenShell.geminiToggle]);

// ─── Reveal toggle for Listen mode ─────────────────────────────────────
function applyRevealToggleState() {
    if (!listenShell.revealToggle) return;
    const showAllText = !listenShell.revealToggle.checked; // unchecked = show text
    const cards = listenShell.stage.querySelectorAll('.listen-card-inner');
    cards.forEach((card) => {
        const eyeZone = card.querySelector('.card-eye-zone');
        const secondaryText = card.querySelector('.card-text-secondary');
        const extraText = card.querySelector('.card-text-extra');
        if (showAllText) {
            // Toggle unchecked: show text for all cards, hide eye-zone
            if (eyeZone) eyeZone.style.display = 'none';
            if (secondaryText) secondaryText.style.display = 'block';
            if (extraText) extraText.style.display = 'block';
        } else {
            // Toggle checked: hide text, show eye-zone (reveal-btn visible)
            if (eyeZone) eyeZone.style.display = 'flex';
            if (secondaryText) secondaryText.style.display = 'none';
            if (extraText) extraText.style.display = 'none';
        }
    });
}

if (listenShell.revealToggle) {
    listenShell.revealToggle.checked = true; // default: text hidden, reveal-btn visible
    listenShell.revealToggle.addEventListener('change', () => {
        applyRevealToggleState();
        // Scroll to the active card after toggle changes layout
        const activeItem = listenShell.stage.querySelector('.listen-list-item.active');
        if (activeItem) {
            activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
}

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
        playStatusEl: studyShell.playStatusEl
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
        playStatusEl: dictShell.playStatusEl
    }
});

const ListenEngine = createListenEngine({
    store,
    sessionKey: 'listenSession',
    viewId: 'deck-listen',
    showView,
    sheetId: runtimeConfig.sheetId,
    dom: {
        stage: listenShell.stage,
        deckTitleEl: listenShell.deckTitleEl,
        deckCounterEl: listenShell.deckCounterEl,
        playStatusEl: listenShell.playStatusEl,
        backNavBtn: listenShell.doneBtn,
        nextNavBtn: listenShell.repeatBtn
    }
});

// Re-apply toggle state after every listen card render (cards are rebuilt from scratch)
ListenEngine._onCardRendered = () => applyRevealToggleState();

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

function setOnAirFrButtonState(isActive, isPaused) {
    const btn = listenShell.onairFrBtnEl;
    if (isActive && !isPaused) {
        btn.textContent = '⏹';
        btn.classList.add('onair-active', 'onair-active-fr');
        btn.title = 'Stop French-only auto-play';
    } else if (isActive && isPaused) {
        btn.textContent = '⏸';
        btn.classList.add('onair-active', 'onair-active-fr');
        btn.title = 'Resume French-only auto-play';
    } else {
        btn.textContent = '🇫🇷';
        btn.classList.remove('onair-active', 'onair-active-fr');
        btn.title = 'French only';
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
    getGeminiMode: geminiModeState.isEnabled,
    getCardData: () => {
        const activeItem = listenShell.stage.querySelector('.listen-list-item.active');
        if (!activeItem) return null;
        const card = activeItem.querySelector('.listen-card-inner');
        return card ? { text1: card.dataset.t1, text2: card.dataset.t2 } : null;
    },
    onStateChange: setOnAirButtonState,
    onStepStart: () => {
        // blink play status if needed
    },
    onTtsError: (msg) => { listenShell.playStatusEl.textContent = msg; },
    onBeforeNext: () => {
        const activeItem = listenShell.stage.querySelector('.listen-list-item.active');
        if (activeItem) {
            const card = activeItem.querySelector('.listen-card-inner');
            if (card) revealHiddenPhrase(card);
        }
    },
    onStepEnd: () => {
        listenShell.playStatusEl.textContent = 'Ready';
    }
});

const listenAutoPlayFr = createAutoPlayFr({
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
    getGeminiMode: geminiModeState.isEnabled,
    getCardData: () => {
        const activeItem = listenShell.stage.querySelector('.listen-list-item.active');
        if (!activeItem) return null;
        const card = activeItem.querySelector('.listen-card-inner');
        return card ? { text1: card.dataset.t1, text2: card.dataset.t2 } : null;
    },
    onStateChange: setOnAirFrButtonState,
    onStepStart: () => {
        // blink play status if needed
    },
    onTtsError: (msg) => { listenShell.playStatusEl.textContent = msg; },
    onBeforeNext: () => {
        const activeItem = listenShell.stage.querySelector('.listen-list-item.active');
        if (activeItem) {
            const card = activeItem.querySelector('.listen-card-inner');
            if (card) revealHiddenPhrase(card);
        }
    },
    onStepEnd: () => {
        listenShell.playStatusEl.textContent = 'Ready';
    }
});

// Attach auto-play hooks to ListenEngine
ListenEngine._onCardRendered = () => {
    listenAutoPlay.onCardRendered();
    listenAutoPlayFr.onCardRendered();
};
ListenEngine._autoPlayStop = () => {
    listenAutoPlay.stop();
    listenAutoPlayFr.stop();
};
ListenEngine._getGeminiMode = geminiModeState.isEnabled;
ListenEngine._onDeleteCard = (deckName, rowIndex, isMarked) => {
    const sheetId = runtimeConfig.sheetId;
    if (isMarked) {
        markRowDeleted(sheetId, deckName, rowIndex);
    } else {
        markRowRestored(sheetId, deckName, rowIndex);
    }
    // Only mark in localStorage; card stays on screen until next load
};

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
    shell.backBtn.addEventListener('click', () => {
        listenAutoPlay.stop();
        listenAutoPlayFr.stop();
        showView('topics');
    });
    shell.doneBtn.addEventListener('click', () => engine.goBack());
    shell.playBtn.addEventListener('click', () => engine.playActiveCard());
    shell.repeatBtn.addEventListener('click', () => engine.goNext());
    shell.onairBtnEl.addEventListener('click', () => {
        if (listenAutoPlayFr.isPlaying() || listenAutoPlayFr.isPaused()) {
            listenAutoPlayFr.stop();
        }
        if (listenAutoPlay.isPlaying() || listenAutoPlay.isPaused()) {
            listenAutoPlay.togglePause();
        } else {
            listenAutoPlay.start();
        }
    });
    shell.onairFrBtnEl.addEventListener('click', () => {
        if (listenAutoPlay.isPlaying() || listenAutoPlay.isPaused()) {
            listenAutoPlay.stop();
        }
        if (listenAutoPlayFr.isPlaying() || listenAutoPlayFr.isPaused()) {
            listenAutoPlayFr.togglePause();
        } else {
            listenAutoPlayFr.start();
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

            if (listenActive && e.key === 'ArrowUp') {
                e.preventDefault();
                ListenEngine.goBack();
                return;
            }

            if (listenActive && e.key === 'ArrowDown') {
                e.preventDefault();
                ListenEngine.goNext();
                return;
            }

            if (listenActive && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                e.preventDefault();
                const activeItem = listenShell.stage.querySelector('.listen-list-item.active');
                if (activeItem) {
                    const deleteBtn = activeItem.querySelector('.listen-card-delete-btn');
                    if (deleteBtn) deleteBtn.click();
                }
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
    // Shuffle buttons removed from deck views - only topic-level shuffle remains
}

function bootstrapApp() {
    window.onload = async () => {
        try {
            const rawData = await api.fetchData();
            // Apply marks to rows previously marked as deleted
            const sheetId = runtimeConfig.sheetId;
            const markedData = {};
            for (const [name, cards] of Object.entries(rawData)) {
                markedData[name] = applyMarks(cards, sheetId, name);
            }
            store.appData = markedData;
            renderTopics(store.appData, {
                onDeckClick: (deckName) => Engine.initDeck(deckName),
                onDictationClick: (deckName) => DictationEngine.initDeck(deckName),
                onListenClick: (deckName) => ListenEngine.initDeck(deckName),
                onShuffleDeck: (deckName) => {
                    console.log('Before shuffle:', store.appData[deckName].map(c => c.rowIndex));
                    shuffleTopicSourceDeck(store, deckName);
                    console.log('After shuffle:', store.appData[deckName].map(c => c.rowIndex));
                    clearListenHistory(runtimeConfig.sheetId, deckName);
                    console.log('History cleared for', deckName);
                },
                onResetHistory: (deckName) => {
                    clearMarkedRows(runtimeConfig.sheetId, deckName);
                    clearListenHistory(runtimeConfig.sheetId, deckName);
                }
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
