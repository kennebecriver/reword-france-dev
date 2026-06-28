import { shuffleArrayInPlace } from './shuffleUtils.js';
import { bgAudio, fetchTTS } from './autoPlay.js';
import { renderListenList } from '../ui/listenList.js';
import { loadListenHistory, saveListenHistory } from '../state/listenHistory.js';

// Index-based deck navigation for Listen mode (no swipe queue / discard).
/**
 * Listen mode engine: index-based navigation over a deck, vertical list rendering
 * and playback via shared `bgAudio`. Manages `currentIndex` and exposes navigation methods.
 */
export function createListenEngine({
    store,
    sessionKey,
    viewId,
    showView,
    onAfterRender,
    sheetId,
    dom: { stage, deckTitleEl, deckCounterEl, playStatusEl, shuffleBtnEl, backNavBtn, nextNavBtn }
}) {
    let currentIndex = 0;
    let playGeneration = 0;
    let currentDeckName = null;

    const cancelPlaySequence = () => {
        playGeneration += 1;
        bgAudio.pause();
    };

    const waitMs = (ms, generation) =>
        new Promise((resolve) => {
            const check = () => {
                if (generation !== playGeneration) { resolve(false); return; }
                resolve(true);
            };
            setTimeout(check, ms);
        });

    const engine = {
        initDeck(name) {
            if (typeof engine._autoPlayStop === 'function') engine._autoPlayStop();
            engine._isPlaying = false;
            currentDeckName = name;
            
            // Try to restore from localStorage history
            const history = sheetId ? loadListenHistory(sheetId, name) : null;
            const sourceDeck = store.appData[name];
            
            if (history && history.cardCount === sourceDeck.length) {
                // Restore order from history
                const orderMap = new Map(sourceDeck.map(card => [card.rowIndex, card]));
                const restoredDeck = history.order
                    .map(rowIndex => orderMap.get(rowIndex))
                    .filter(card => card !== undefined);
                
                // If restoration failed (missing cards), fall back to source
                if (restoredDeck.length === sourceDeck.length) {
                    store[sessionKey] = restoredDeck;
                    currentIndex = Math.min(history.activeIndex, restoredDeck.length - 1);
                } else {
                    // History is invalid, reset
                    store[sessionKey] = [...sourceDeck];
                    currentIndex = 0;
                }
            } else {
                // No history or card count mismatch, start fresh
                store[sessionKey] = [...sourceDeck];
                currentIndex = 0;
            }
            
            deckTitleEl.textContent = name;
            engine.renderCard(true); // true = auto-scroll to top/active
            
            // Save initial state to localStorage
            if (sheetId) {
                const order = store[sessionKey].map(card => card.rowIndex);
                saveListenHistory(sheetId, name, order, currentIndex);
            }
            
            showView(viewId);
        },

        renderCard(autoScroll = false) {
            cancelPlaySequence();
            engine._isPlaying = false;

            const deck = store[sessionKey];
            if (!deck.length) { showView('topics'); return; }

            currentIndex = Math.max(0, Math.min(currentIndex, deck.length - 1));
            
            // Render the vertical list, passing a click handler to jump to a card
            renderListenList(stage, deck, currentIndex, (index) => {
                currentIndex = index;
                engine.renderCard(true);
            }, autoScroll, (rowIndex, isMarked) => {
                // Delete callback
                if (typeof engine._onDeleteCard === 'function') {
                    engine._onDeleteCard(currentDeckName, rowIndex, isMarked);
                }
            });

            engine.updateCounter();
            engine.updateNavButtons();
            
            // Save current state to localStorage
            if (sheetId && currentDeckName) {
                const order = deck.map(card => card.rowIndex);
                saveListenHistory(sheetId, currentDeckName, order, currentIndex);
            }
            
            if (typeof onAfterRender === 'function') onAfterRender();
            if (typeof engine._onCardRendered === 'function') engine._onCardRendered();
        },

        goNext() {
            if (typeof engine._autoPlayStop === 'function') engine._autoPlayStop();
            engine._goNextInternal();
        },

        _goNextInternal() {
            const deck = store[sessionKey];
            if (currentIndex < deck.length - 1) {
                currentIndex += 1;
                engine.renderCard(true);
            }
        },

        goBack() {
            if (typeof engine._autoPlayStop === 'function') engine._autoPlayStop();
            engine._goBackInternal();
        },

        _goBackInternal() {
            if (currentIndex > 0) {
                currentIndex -= 1;
                engine.renderCard(true);
            }
        },

        canGoBack() { return currentIndex > 0; },

        canGoNext() {
            const deck = store[sessionKey];
            return deck.length > 0 && currentIndex < deck.length - 1;
        },

        updateNavButtons() {
            if (backNavBtn) backNavBtn.disabled = !engine.canGoBack();
            if (nextNavBtn) nextNavBtn.disabled = !engine.canGoNext();
        },

        updateCounter() {
            const total = store[sessionKey].length;
            deckCounterEl.textContent = total ? `${currentIndex + 1} / ${total}` : '0';
        },

        shuffleDeck() {
            const deck = store[sessionKey];
            if (!deck || deck.length < 2) return;
            if (typeof engine._autoPlayStop === 'function') engine._autoPlayStop();
            shuffleArrayInPlace(deck);
            currentIndex = 0;
            engine.renderCard(true);
            
            // Save shuffled order to localStorage
            if (sheetId && currentDeckName) {
                const order = deck.map(card => card.rowIndex);
                saveListenHistory(sheetId, currentDeckName, order, currentIndex);
            }
            
            if (shuffleBtnEl) {
                shuffleBtnEl.classList.add('shuffling');
                setTimeout(() => shuffleBtnEl.classList.remove('shuffling'), 200);
            }
        },

        /**
         * Plays the hidden (French) phrase for the current index.
         * Uses `playGeneration` to cancel stale playback operations.
         */
        async playActiveCard() {
            const deck = store[sessionKey];
            const cardData = deck[currentIndex];

            if (!playStatusEl) return;
            if (!cardData) {
                playStatusEl.textContent = 'No active card';
                return;
            }

            const hiddenPhrase = (cardData.text1 || '').trim();

            if (!hiddenPhrase) {
                playStatusEl.textContent = 'No hidden phrase';
                return;
            }

            cancelPlaySequence();
            const generation = playGeneration;
            engine._isPlaying = true;

            const playPhrase = async (phrase, languageCode) => {
                playStatusEl.textContent = 'Loading...';
                const phraseFirstPart = phrase.split('|')[0].trim();
                try {
                    const buffer = await fetchTTS(phraseFirstPart, languageCode, {
                        model: languageCode === 'fr-FR'
                            ? (typeof engine._getGeminiMode === 'function' ? engine._getGeminiMode() ? 'gemini' : 'default' : 'gemini')
                            : undefined,
                        onStatus: (msg) => { if (playStatusEl) playStatusEl.textContent = msg; }
                    });
                    if (generation !== playGeneration) return;
                    const blob = new Blob([buffer]);
                    const url = URL.createObjectURL(blob);
                    playStatusEl.textContent = '▶ Playing';
                    await new Promise((resolve, reject) => {
                        bgAudio.src = url;
                        bgAudio.onended = () => { URL.revokeObjectURL(url); resolve(); };
                        bgAudio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Playback error')); };
                        bgAudio.play().catch(reject);
                    });
                } catch (e) {
                    if (generation === playGeneration) playStatusEl.textContent = e.message || 'Failed to play';
                    throw e;
                }
            };

            try {
                // Only play the hidden French phrase (text1) as requested by user
                await playPhrase(hiddenPhrase, 'fr-FR');
            } catch (error) {
                console.error('Play error:', error);
                if (generation === playGeneration) playStatusEl.textContent = error.message || 'Failed to play';
            } finally {
                if (generation === playGeneration) {
                    engine._isPlaying = false;
                    playStatusEl.textContent = 'Ready';
                }
            }
        }
    };

    // Hooks for autoPlay module (attached externally via bootstrap)
    engine._onCardRendered = null;
    engine._autoPlayStop = null;
    engine._getGeminiMode = null;
    engine._onDeleteCard = null;

    return engine;
}