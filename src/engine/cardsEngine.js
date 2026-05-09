import { createStudyCard } from '../ui/components/studyCard.js';

// Main flashcard engine.
// Logic is preserved from original monolithic script.
export function createCardsEngine({ store, showView, isGeminiModeEnabled }) {
    return {
        THRESHOLD: 100,

        initDeck(name) {
            store.currentSession = [...store.appData[name]];
            document.getElementById('deck-title').textContent = name;
            document.getElementById('card-stage').innerHTML = '';
            this.updateCounter();
            this.spawn();
            showView('deck');
        },

        spawn() {
            const stage = document.getElementById('card-stage');
            while (stage.children.length < 2 && store.currentSession.length > 0) {
                const data = store.currentSession.shift();
                stage.prepend(this.createCardEl(data));
            }

            const top = stage.lastElementChild;
            if (top && !top.classList.contains('card-active')) {
                top.className = 'card card-active animating';
                this.bindEvents(top);
            }

            const next = stage.firstElementChild;
            if (next && next !== top) next.className = 'card card-next animating';
        },

        createCardEl(data) {
            return createStudyCard(data);
        },

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
                if (event.target.closest('button')) return;
                start = { x: event.clientX, y: event.clientY };
                current = { x: 0, y: 0 };
                el.classList.remove('animating');
                document.addEventListener('pointermove', move);
                document.addEventListener('pointerup', up);
            };
        },

        manualSwipe(dir) {
            const top = document.querySelector('.card-active');
            if (top) this.swipe(top, dir);
        },

        async playActiveCard() {
            const statusEl = document.getElementById('play-status');
            const top = document.querySelector('.card-active');

            if (!statusEl) return;
            if (!top) {
                statusEl.textContent = 'No active card';
                return;
            }

            const phrase = (top.dataset.t1 || '').trim();
            if (!phrase) {
                statusEl.textContent = 'Empty phrase';
                return;
            }

            // Protection from repetitive taps while audio is being processed.
            if (this._isPlaying) return;
            this._isPlaying = true;

            statusEl.textContent = 'Loading...';

            try {
                const cacheKey = `tts-${isGeminiModeEnabled() ? 'gemini' : 'default'}-${phrase}`;
                const cache = await caches.open('tts-audio-cache');

                // Legacy cache key support kept to preserve current behavior.
                const legacyCacheKey = `tts-${phrase}`;
                let response = (await cache.match(legacyCacheKey)) || (await cache.match(cacheKey));

                if (!response) {
                    statusEl.textContent = 'Generating audio...';

                    const modelParam = isGeminiModeEnabled() ? '&model=gemini' : '';
                    const url = `https://reword-france-463001342259.northamerica-northeast2.run.app/get_voice?phrase=${encodeURIComponent(phrase)}${modelParam}`;

                    response = await fetch(url);

                    if (!response.ok) {
                        throw new Error(`Server returned ${response.status}`);
                    }

                    // Store generated audio in browser cache.
                    await cache.put(cacheKey, response.clone());
                }

                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);

                const audio = new Audio(audioUrl);

                audio.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    statusEl.textContent = 'Ready';
                    this._isPlaying = false;
                };

                audio.onerror = () => {
                    URL.revokeObjectURL(audioUrl);
                    statusEl.textContent = 'Playback error';
                    this._isPlaying = false;
                };

                await audio.play();
                statusEl.textContent = '▶ Playing';
            } catch (error) {
                console.error('Play error:', error);
                statusEl.textContent = 'Failed to play';
                this._isPlaying = false;
            }
        },

        swipe(el, dir) {
            el.classList.add('animating');
            const outX = dir === 'right' ? 1000 : -1000;
            el.style.setProperty('--x', `${outX}px`);
            el.style.opacity = '0';

            if (dir === 'right') {
                store.currentSession.push({ text1: el.dataset.t1, text2: el.dataset.t2 });
            }

            setTimeout(() => {
                el.remove();
                this.updateCounter();
                this.spawn();
            }, 400);
        },

        updateCounter() {
            const total = store.currentSession.length + document.getElementById('card-stage').children.length;
            document.getElementById('deck-counter').textContent = total;
            if (total === 0) showView('topics');
        },

        // Fisher-Yates shuffle: shuffles the array in place.
        _shuffleArray(arr) {
            for (let i = arr.length - 1; i > 0; i -= 1) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        },

        // Public method to shuffle the deck queue.
        shuffleDeck() {
            // 1. Shuffle the upcoming cards queue.
            this._shuffleArray(store.currentSession);

            // 2. Refresh next card preview (if present) to reflect new order.
            const stage = document.getElementById('card-stage');
            const nextCard = stage?.firstElementChild;

            if (nextCard && store.currentSession.length > 0) {
                const newData = store.currentSession.shift();
                const newNext = this.createCardEl(newData);
                newNext.className = 'card card-next animating';
                nextCard.replaceWith(newNext);
            }

            // 3. Visual feedback on shuffle button.
            const btn = document.getElementById('shuffle-btn');
            if (btn) {
                btn.classList.add('shuffling');
                setTimeout(() => btn.classList.remove('shuffling'), 200);
            }

            console.log(`Deck shuffled: ${store.currentSession.length} cards in queue`);
        }
    };
}
