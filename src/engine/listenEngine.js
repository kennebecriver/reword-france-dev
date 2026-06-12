import { shuffleArrayInPlace } from './shuffleUtils.js';
import { bgAudio, createSilenceBlob } from './autoPlay.js';

const TTS_BASE_URL = 'https://reword-france-463001342259.northamerica-northeast2.run.app/get_voice';

// Index-based deck navigation for Listen mode (no swipe queue / discard).
export function createListenEngine({
    store,
    sessionKey,
    viewId,
    showView,
    buildCard,
    onAfterRender,
    dom: { stage, deckTitleEl, deckCounterEl, playStatusEl, shuffleBtnEl, backNavBtn, nextNavBtn }
}) {
    let currentIndex = 0;
    let playGeneration = 0;
    let secondPlayTimer = null;
    let delayResolve = null;

    const cancelPlaySequence = () => {
        playGeneration += 1;
        if (secondPlayTimer) { clearTimeout(secondPlayTimer); secondPlayTimer = null; }
        if (delayResolve) { delayResolve(false); delayResolve = null; }
        bgAudio.pause();
        // Don't clear bgAudio.src — Android drops media session
    };

    const waitMs = (ms, generation) =>
        new Promise((resolve) => {
            delayResolve = (stillActive) => {
                delayResolve = null;
                resolve(stillActive && generation === playGeneration);
            };
            // Audio-based timer via autoPlay's silence blob generator
            const timerAudio = new Audio();
            timerAudio.volume = 0;
            const blob = createSilenceBlob(ms);
            const url = URL.createObjectURL(blob);
            timerAudio.src = url;
            timerAudio.onended = () => {
                URL.revokeObjectURL(url);
                const resolveDelay = delayResolve;
                delayResolve = null;
                if (resolveDelay) resolveDelay(true);
            };
            timerAudio.play().catch(() => {
                // Fallback setTimeout
                secondPlayTimer = setTimeout(() => {
                    secondPlayTimer = null;
                    const resolveDelay = delayResolve;
                    delayResolve = null;
                    if (resolveDelay) resolveDelay(true);
                }, ms);
            });
        });

    const buildVoiceUrl = (phrase, languageCode) => {
        const params = new URLSearchParams({ phrase, language_code: languageCode });
        return `${TTS_BASE_URL}?${params.toString()}`;
    };

    const fetchVoiceResponse = async (phrase, languageCode) => {
        const cacheKey = `tts-listen-${languageCode}-${phrase}`;
        const cache = await caches.open('tts-audio-cache');
        const cached = await cache.match(cacheKey);
        if (cached) return cached;

        const response = await fetch(buildVoiceUrl(phrase, languageCode));
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        await cache.put(cacheKey, response.clone());
        return response;
    };

    const playVoiceResponse = (response, generation) =>
        new Promise((resolve, reject) => {
            if (generation !== playGeneration) { resolve(); return; }
            response.blob().then((audioBlob) => {
                if (generation !== playGeneration) { resolve(); return; }
                const audioUrl = URL.createObjectURL(audioBlob);
                
                // Use the global bgAudio element for background playback support
                bgAudio.src = audioUrl;
                bgAudio.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    resolve();
                };
                bgAudio.onerror = () => {
                    URL.revokeObjectURL(audioUrl);
                    reject(new Error('Playback error'));
                };
                bgAudio.play().catch(reject);
            }).catch(reject);
        });

    const engine = {
        initDeck(name) {
            if (typeof engine._autoPlayStop === 'function') engine._autoPlayStop();
            engine._isPlaying = false;
            store[sessionKey] = [...store.appData[name]];
            currentIndex = 0;
            deckTitleEl.textContent = name;
            engine.renderCard();
            showView(viewId);
        },

        renderCard() {
            cancelPlaySequence();
            engine._isPlaying = false;

            const deck = store[sessionKey];
            if (!deck.length) { showView('topics'); return; }

            currentIndex = Math.max(0, Math.min(currentIndex, deck.length - 1));
            const card = buildCard(deck[currentIndex]);
            card.className = 'card card-active animating';
            stage.innerHTML = '';
            stage.appendChild(card);
            engine.updateCounter();
            engine.updateNavButtons();
            if (typeof onAfterRender === 'function') onAfterRender();
            // Notify autoPlay, if attached
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
                engine.renderCard();
            }
        },

        goBack() {
            if (typeof engine._autoPlayStop === 'function') engine._autoPlayStop();
            engine._goBackInternal();
        },

        _goBackInternal() {
            if (currentIndex > 0) {
                currentIndex -= 1;
                engine.renderCard();
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
            engine.renderCard();
            if (shuffleBtnEl) {
                shuffleBtnEl.classList.add('shuffling');
                setTimeout(() => shuffleBtnEl.classList.remove('shuffling'), 200);
            }
        },

        async playActiveCard() {
            const top = stage.querySelector('.card-active');

            if (!playStatusEl) return;
            if (!top) {
                playStatusEl.textContent = 'No active card';
                return;
            }

            const visiblePhrase = (top.dataset.t2 || '').trim();
            const hiddenPhrase = (top.dataset.t1 || '').trim();

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
                const response = await fetchVoiceResponse(phraseFirstPart, languageCode);
                if (generation !== playGeneration) return;

                playStatusEl.textContent = '▶ Playing';
                await playVoiceResponse(response, generation);
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
