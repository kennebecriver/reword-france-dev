import { shuffleArrayInPlace } from './shuffleUtils.js';

const TTS_BASE_URL = 'https://reword-france-463001342259.northamerica-northeast2.run.app/get_voice';

// Global audio element for background playback (required for mobile Media Session)
const bgAudio = new Audio();
bgAudio.preload = 'auto';

// Index-based deck navigation for Listen mode (no swipe queue / discard).
export function createListenEngine({
    store,
    sessionKey,
    viewId,
    showView,
    buildCard,
    onAfterRender,
    onAutoPlayStateChange,
    dom: { stage, deckTitleEl, deckCounterEl, playStatusEl, shuffleBtnEl, backNavBtn, nextNavBtn }
}) {
    let currentIndex = 0;
    let playGeneration = 0;
    let secondPlayTimer = null;
    let delayResolve = null;
    let autoPlayActive = false;
    let autoPlayPaused = false;
    let autoPlayTimer = null;
    let wakeLock = null;

    const requestWakeLock = async () => {
        try {
            if ('wakeLock' in navigator) {
                wakeLock = await navigator.wakeLock.request('screen');
                wakeLock.addEventListener('release', () => { wakeLock = null; });
            }
        } catch (err) {
            console.warn('Wake Lock unavailable:', err);
        }
    };

    const releaseWakeLock = () => {
        if (wakeLock) {
            wakeLock.release().catch(() => {});
            wakeLock = null;
        }
    };

    const updateMediaSession = (state, cardData) => {
        if (!('mediaSession' in navigator)) return;
        if (state === 'playing' && cardData) {
            try {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: cardData.text2 || 'Reword',
                    artist: 'Reword',
                    album: cardData.text1 || '',
                    artwork: [
                        { src: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
                        { src: 'https://via.placeholder.com/512.png?text=Reword', sizes: '512x512', type: 'image/png' }
                    ]
                });
                if ('setPositionState' in navigator.mediaSession) {
                    navigator.mediaSession.setPositionState({
                        duration: 10, // Dummy duration for TTS
                        playbackRate: 1.0,
                        position: 0
                    });
                }
            } catch (e) { /* ignore */ }
            navigator.mediaSession.playbackState = 'playing';
        } else if (state === 'paused') {
            navigator.mediaSession.playbackState = 'paused';
        } else {
            try { navigator.mediaSession.metadata = null; } catch (e) { /* ignore */ }
            navigator.mediaSession.playbackState = 'none';
        }
    };

    // MUST be called synchronously inside a user gesture (e.g., button click)
    const registerMediaSessionHandlers = () => {
        if (!('mediaSession' in navigator)) return;
        try {
            navigator.mediaSession.setActionHandler('play', () => {
                if (autoPlayActive && autoPlayPaused) {
                    engine.toggleAutoPlayPause();
                }
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                if (autoPlayActive && !autoPlayPaused) {
                    engine.toggleAutoPlayPause();
                }
            });
            navigator.mediaSession.setActionHandler('previoustrack', () => {
                engine._goBackInternal();
            });
            navigator.mediaSession.setActionHandler('nexttrack', () => {
                engine._goNextInternal();
            });
            // Add seek handlers to satisfy Android Chrome requirements
            navigator.mediaSession.setActionHandler('seekbackward', (details) => {
                // Not applicable for TTS, but prevents warnings
            });
            navigator.mediaSession.setActionHandler('seekforward', (details) => {
                // Not applicable for TTS, but prevents warnings
            });
        } catch (e) {
            console.warn('Media Session registration failed:', e);
        }
    };

    const initVisibilityHandler = () => {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && autoPlayActive && !autoPlayPaused) {
                requestWakeLock();
                // Re-register handlers just in case the browser dropped them
                registerMediaSessionHandlers();
            }
        });
    };

    initVisibilityHandler();

    const cancelPlaySequence = () => {
        playGeneration += 1;
        if (secondPlayTimer) { clearTimeout(secondPlayTimer); secondPlayTimer = null; }
        if (delayResolve) { delayResolve(false); delayResolve = null; }
        bgAudio.pause();
        bgAudio.src = '';
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
            engine.stopAutoPlay();
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
            engine._onCardRendered();
        },

        goNext() {
            engine.stopAutoPlay();
            engine._goNextInternal();
        },

        /** Internal: go next without stopping auto-play. */
        _goNextInternal() {
            const deck = store[sessionKey];
            if (currentIndex < deck.length - 1) {
                currentIndex += 1;
                engine.renderCard();
            }
        },

        goBack() {
            engine.stopAutoPlay();
            engine._goBackInternal();
        },

        /** Internal: go back without stopping auto-play. */
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
            engine.stopAutoPlay();
            shuffleArrayInPlace(deck);
            currentIndex = 0;
            engine.renderCard();
            if (shuffleBtnEl) {
                shuffleBtnEl.classList.add('shuffling');
                setTimeout(() => shuffleBtnEl.classList.remove('shuffling'), 200);
            }
        },

        // --- Auto-play (On Air) ---

        startAutoPlay() {
            if (autoPlayActive) return;
            autoPlayActive = true;
            autoPlayPaused = false;
            cancelPlaySequence();
            requestWakeLock();
            registerMediaSessionHandlers();
            updateMediaSession('paused');
            if (typeof onAutoPlayStateChange === 'function') onAutoPlayStateChange(true, false);
            engine.playActiveCard().then(() => engine._scheduleNextAuto());
        },

        toggleAutoPlayPause() {
            if (!autoPlayActive) return;
            if (autoPlayPaused) {
                autoPlayPaused = false;
                cancelPlaySequence();
                updateMediaSession('paused');
                if (typeof onAutoPlayStateChange === 'function') onAutoPlayStateChange(true, false);
                engine.playActiveCard().then(() => engine._scheduleNextAuto());
            } else {
                autoPlayPaused = true;
                clearTimeout(autoPlayTimer);
                cancelPlaySequence();
                updateMediaSession('paused');
                if (typeof onAutoPlayStateChange === 'function') onAutoPlayStateChange(true, true);
            }
        },

        stopAutoPlay() {
            if (!autoPlayActive) return;
            clearTimeout(autoPlayTimer);
            autoPlayActive = false;
            autoPlayPaused = false;
            cancelPlaySequence();
            releaseWakeLock();
            updateMediaSession('none');
            if (typeof onAutoPlayStateChange === 'function') onAutoPlayStateChange(false, false);
        },

        isAutoPlaying() { return autoPlayActive && !autoPlayPaused; },
        isAutoPlayPaused() { return autoPlayActive && autoPlayPaused; },

        _scheduleNextAuto() {
            if (!autoPlayActive || autoPlayPaused) return;
            clearTimeout(autoPlayTimer);
            const deck = store[sessionKey];
            if (!deck?.length || currentIndex >= deck.length - 1) { engine.stopAutoPlay(); return; }
            autoPlayTimer = setTimeout(() => {
                if (!autoPlayActive || autoPlayPaused) return;
                engine._goNextInternal();
            }, 3000);
        },

        _onCardRendered() {
            if (!autoPlayActive || autoPlayPaused) return;
            const top = stage.querySelector('.card-active');
            if (top) {
                updateMediaSession('playing', { text1: top.dataset.t1, text2: top.dataset.t2 });
            }
            engine.playActiveCard().then(() => engine._scheduleNextAuto());
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

    return engine;
}
