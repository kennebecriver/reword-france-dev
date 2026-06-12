import { shuffleArrayInPlace } from './shuffleUtils.js';
import { bgAudio, fetchTTS } from './autoPlay.js';
import { renderListenList } from '../ui/listenList.js';

// Index-based deck navigation for Listen mode (no swipe queue / discard).
export function createListenEngine({
    store,
    sessionKey,
    viewId,
    showView,
    onAfterRender,
    dom: { stage, deckTitleEl, deckCounterEl, playStatusEl, shuffleBtnEl, backNavBtn, nextNavBtn }
}) {
    let currentIndex = 0;
    let playGeneration = 0;

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
            store[sessionKey] = [...store.appData[name]];
            currentIndex = 0;
            deckTitleEl.textContent = name;
            engine.renderCard(true); // true = auto-scroll to top/active
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
            }, autoScroll);

            engine.updateCounter();
            engine.updateNavButtons();
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
            if (shuffleBtnEl) {
                shuffleBtnEl.classList.add('shuffling');
                setTimeout(() => shuffleBtnEl.classList.remove('shuffling'), 200);
            }
        },

        async playActiveCard() {
            const deck = store[sessionKey];
            const cardData = deck[currentIndex];

            if (!playStatusEl) return;
            if (!cardData) {
                playStatusEl.textContent = 'No active card';
                return;
            }

            const visiblePhrase = (cardData.text2 || '').trim();
            const hiddenPhrase = (cardData.text1 || '').trim();

            if (!visiblePhrase && !hiddenPhrase) {
                playStatusEl.textContent = 'Empty phrase';
                return;
            }

            cancelPlaySequence();
            const generation = playGeneration;
            engine._isPlaying = true;

            const playPhrase = async (phrase, languageCode) => {
                playStatusEl.textContent = 'Loading...';
                const phraseFirstPart = phrase.split('|')[0].trim();
                try {
                    const buffer = await fetchTTS(phraseFirstPart, languageCode);
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
                    if (generation === playGeneration) playStatusEl.textContent = 'Failed to play';
                    throw e;
                }
            };

            try {
                if (visiblePhrase) {
                    await playPhrase(visiblePhrase, 'ru-RU');
                    if (generation !== playGeneration) return;
                }
                if (hiddenPhrase) {
                    const shouldContinue = await waitMs(3000, generation);
                    if (!shouldContinue) return;
                    await playPhrase(hiddenPhrase, 'fr-FR');
                }
            } catch (error) {
                console.error('Play error:', error);
                if (generation === playGeneration) playStatusEl.textContent = 'Failed to play';
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

    return engine;
}
