import { shuffleArrayInPlace } from './shuffleUtils.js';

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
    let activeAudio = null;

    const cancelPlaySequence = () => {
        playGeneration += 1;
        if (secondPlayTimer) {
            clearTimeout(secondPlayTimer);
            secondPlayTimer = null;
        }
        if (delayResolve) {
            delayResolve(false);
            delayResolve = null;
        }
        if (activeAudio) {
            activeAudio.pause();
            activeAudio = null;
        }
    };

    const waitMs = (ms, generation) =>
        new Promise((resolve) => {
            delayResolve = (stillActive) => {
                delayResolve = null;
                resolve(stillActive && generation === playGeneration);
            };
            secondPlayTimer = setTimeout(() => {
                secondPlayTimer = null;
                const resolveDelay = delayResolve;
                delayResolve = null;
                if (resolveDelay) resolveDelay(true);
            }, ms);
        });

    const buildVoiceUrl = (phrase, languageCode) => {
        const params = new URLSearchParams({
            phrase,
            language_code: languageCode
        });
        return `${TTS_BASE_URL}?${params.toString()}`;
    };

    const fetchVoiceResponse = async (phrase, languageCode) => {
        const cacheKey = `tts-listen-${languageCode}-${phrase}`;
        const cache = await caches.open('tts-audio-cache');
        const cached = await cache.match(cacheKey);

        if (cached) return cached;

        const response = await fetch(buildVoiceUrl(phrase, languageCode));
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        await cache.put(cacheKey, response.clone());
        return response;
    };

    const playVoiceResponse = (response, generation) =>
        new Promise((resolve, reject) => {
            if (generation !== playGeneration) {
                resolve();
                return;
            }

            response
                .blob()
                .then((audioBlob) => {
                    if (generation !== playGeneration) {
                        resolve();
                        return;
                    }

                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);
                    activeAudio = audio;

                    audio.onended = () => {
                        URL.revokeObjectURL(audioUrl);
                        if (activeAudio === audio) activeAudio = null;
                        resolve();
                    };

                    audio.onerror = () => {
                        URL.revokeObjectURL(audioUrl);
                        if (activeAudio === audio) activeAudio = null;
                        reject(new Error('Playback error'));
                    };

                    audio.play().catch(reject);
                })
                .catch(reject);
        });

    return {
        initDeck(name) {
            cancelPlaySequence();
            this._isPlaying = false;
            store[sessionKey] = [...store.appData[name]];
            currentIndex = 0;
            deckTitleEl.textContent = name;
            this.renderCard();
            showView(viewId);
        },

        renderCard() {
            cancelPlaySequence();
            this._isPlaying = false;

            const deck = store[sessionKey];
            if (!deck.length) {
                showView('topics');
                return;
            }

            currentIndex = Math.max(0, Math.min(currentIndex, deck.length - 1));
            const card = buildCard(deck[currentIndex]);
            card.className = 'card card-active animating';
            stage.innerHTML = '';
            stage.appendChild(card);
            this.updateCounter();
            this.updateNavButtons();

            if (typeof onAfterRender === 'function') onAfterRender();
        },

        goNext() {
            const deck = store[sessionKey];
            if (currentIndex < deck.length - 1) {
                currentIndex += 1;
                this.renderCard();
            }
        },

        goBack() {
            if (currentIndex > 0) {
                currentIndex -= 1;
                this.renderCard();
            }
        },

        canGoBack() {
            return currentIndex > 0;
        },

        canGoNext() {
            const deck = store[sessionKey];
            return deck.length > 0 && currentIndex < deck.length - 1;
        },

        updateNavButtons() {
            if (backNavBtn) backNavBtn.disabled = !this.canGoBack();
            if (nextNavBtn) nextNavBtn.disabled = !this.canGoNext();
        },

        updateCounter() {
            const total = store[sessionKey].length;
            deckCounterEl.textContent = total ? `${currentIndex + 1} / ${total}` : '0';
        },

        shuffleDeck() {
            const deck = store[sessionKey];
            if (!deck || deck.length < 2) return;

            shuffleArrayInPlace(deck);
            currentIndex = 0;
            this.renderCard();

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
            this._isPlaying = true;

            const playPhrase = async (phrase, languageCode) => {
                playStatusEl.textContent = 'Loading...';
                const response = await fetchVoiceResponse(phrase, languageCode);
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
                if (generation === playGeneration) {
                    playStatusEl.textContent = 'Failed to play';
                }
            } finally {
                if (generation === playGeneration) {
                    this._isPlaying = false;
                    playStatusEl.textContent = 'Ready';
                }
            }
        }
    };
}
