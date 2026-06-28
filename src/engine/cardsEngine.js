import { fetchTTS } from './ttsCache.js';

// Swipe / queue / audio engine parameterized by DOM scope and Card factory (`createCardEl`).
/**
 * Cards engine factory implementing swipe behavior.
 * Manages the session queue (`store[sessionKey]`), renders up to two visible cards,
 * and wires user interaction events.
 */
export function createCardsEngine({
    store,
    sessionKey,
    viewId,
    showView,
    isGeminiModeEnabled,
    buildCard,
    onAfterSpawn,
    dom: { stage, deckTitleEl, deckCounterEl, playStatusEl }
}) {
    return {
        THRESHOLD: 100,

        initDeck(name) {
            store[sessionKey] = [...store.appData[name]];
            deckTitleEl.textContent = name;
            stage.innerHTML = '';
            this.updateCounter();
            this.spawn();
            showView(viewId);
        },

        spawn() {
            while (stage.children.length < 2 && store[sessionKey].length > 0) {
                const data = store[sessionKey].shift();
                stage.prepend(buildCard(data));
            }

            const top = stage.lastElementChild;
            if (top && !top.classList.contains('card-active')) {
                top.className = top.classList.contains('dictation-card')
                    ? 'card dictation-card card-active animating'
                    : 'card card-active animating';
                this.bindEvents(top);
            }

            const next = stage.firstElementChild;
            if (next && next !== top) {
                next.className = next.classList.contains('dictation-card')
                    ? 'card dictation-card card-next animating'
                    : 'card card-next animating';
            }

            if (typeof onAfterSpawn === 'function') onAfterSpawn();
        },

        /**
         * Pointer event handler implementing drag/swipe for a card element.
         * Updates CSS variables for transforms and calls `swipe()` when threshold exceeded.
         */
        bindEvents(el) {
            let start = { x: 0, y: 0 };
            let current = { x: 0, y: 0 };

            const move = (event) => {
                current.x = event.clientX - start.x;
                current.y = event.clientY - start.y;
                el.style.setProperty('--x', `${current.x}px`);
                el.style.setProperty('--y', `${current.y}px`);
                el.style.setProperty('--r', `${current.x * 0.05}deg`);
            };

            const up = () => {
                document.removeEventListener('pointermove', move);
                document.removeEventListener('pointerup', up);
                el.classList.add('animating');
                if (Math.abs(current.x) > this.THRESHOLD) {
                    this.swipe(el, current.x > 0 ? 'right' : 'left');
                } else {
                    el.style.setProperty('--x', '0px');
                    el.style.setProperty('--y', '0px');
                    el.style.setProperty('--r', '0deg');
                }
            };

            el.onpointerdown = (event) => {
                if (event.target.closest('button, input, textarea, select')) return;
                start = { x: event.clientX, y: event.clientY };
                current = { x: 0, y: 0 };
                el.classList.remove('animating');
                document.addEventListener('pointermove', move);
                document.addEventListener('pointerup', up);
            };
        },

        manualSwipe(dir) {
            const top = stage.querySelector('.card-active');
            if (top) this.swipe(top, dir);
        },

        /**
         * Play the active card: reads the phrase via remote TTS with CacheStorage caching,
         * creates an `Audio` instance and manages internal `_isPlaying` state.
         */
        async playActiveCard() {
            const top = stage.querySelector('.card-active');

            if (!playStatusEl) return;
            if (!top) {
                playStatusEl.textContent = 'No active card';
                return;
            }

            let phrase = (top.dataset.t1 || '').trim();
            if (!phrase) {
                playStatusEl.textContent = 'Empty phrase';
                return;
            }

            phrase = phrase.split('|')[0].trim();

            if (this._isPlaying) return;
            this._isPlaying = true;

            playStatusEl.textContent = 'Loading...';

            try {
                playStatusEl.textContent = 'Generating audio...';

                const model = isGeminiModeEnabled() ? 'gemini' : 'default';
                const buffer = await fetchTTS(phrase, 'fr-FR', {
                    model,
                    onStatus: (msg) => { playStatusEl.textContent = msg; }
                });

                const audioBlob = new Blob([buffer]);
                const audioUrl = URL.createObjectURL(audioBlob);

                const audio = new Audio(audioUrl);

                audio.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    playStatusEl.textContent = 'Ready';
                    this._isPlaying = false;
                };

                audio.onerror = () => {
                    URL.revokeObjectURL(audioUrl);
                    playStatusEl.textContent = 'Playback error';
                    this._isPlaying = false;
                };

                await audio.play();
                playStatusEl.textContent = '▶ Playing';
            } catch (error) {
                console.error('Play error:', error);
                playStatusEl.textContent = error.message || 'Failed to play';
                this._isPlaying = false;
            }
        },

        swipe(el, dir) {
            el.classList.add('animating');
            const outX = dir === 'right' ? 1000 : -1000;
            el.style.setProperty('--x', `${outX}px`);
            el.style.opacity = '0';

            if (dir === 'right') {
                store[sessionKey].push({ text1: el.dataset.t1, text2: el.dataset.t2, text3: el.dataset.t3 });
            }

            setTimeout(() => {
                el.remove();
                this.updateCounter();
                this.spawn();
            }, 400);
        },

        updateCounter() {
            const total = store[sessionKey].length + stage.children.length;
            deckCounterEl.textContent = total;
            if (total === 0) showView('topics');
        },

    };
}
