// Swipe / queue / audio engine parameterized by DOM scope and Card factory (`createCardEl`).
export function createCardsEngine({
    store,
    sessionKey,
    viewId,
    showView,
    isGeminiModeEnabled,
    buildCard,
    dom: { stage, deckTitleEl, deckCounterEl, playStatusEl, shuffleBtnEl }
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
            const top = stage.querySelector('.card-active');
            if (top) this.swipe(top, dir);
        },

        async playActiveCard() {
            const top = stage.querySelector('.card-active');

            if (!playStatusEl) return;
            if (!top) {
                playStatusEl.textContent = 'No active card';
                return;
            }

            const phrase = (top.dataset.t1 || '').trim();
            if (!phrase) {
                playStatusEl.textContent = 'Empty phrase';
                return;
            }

            if (this._isPlaying) return;
            this._isPlaying = true;

            playStatusEl.textContent = 'Loading...';

            try {
                const cacheKey = `tts-${isGeminiModeEnabled() ? 'gemini' : 'default'}-${phrase}`;
                const cache = await caches.open('tts-audio-cache');

                const legacyCacheKey = `tts-${phrase}`;
                let response = (await cache.match(legacyCacheKey)) || (await cache.match(cacheKey));

                if (!response) {
                    playStatusEl.textContent = 'Generating audio...';

                    const modelParam = isGeminiModeEnabled() ? '&model=gemini' : '';
                    const url = `https://reword-france-463001342259.northamerica-northeast2.run.app/get_voice?phrase=${encodeURIComponent(phrase)}${modelParam}`;

                    response = await fetch(url);

                    if (!response.ok) {
                        throw new Error(`Server returned ${response.status}`);
                    }

                    await cache.put(cacheKey, response.clone());
                }

                const audioBlob = await response.blob();
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
                playStatusEl.textContent = 'Failed to play';
                this._isPlaying = false;
            }
        },

        swipe(el, dir) {
            el.classList.add('animating');
            const outX = dir === 'right' ? 1000 : -1000;
            el.style.setProperty('--x', `${outX}px`);
            el.style.opacity = '0';

            if (dir === 'right') {
                store[sessionKey].push({ text1: el.dataset.t1, text2: el.dataset.t2 });
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

        _shuffleArray(arr) {
            for (let i = arr.length - 1; i > 0; i -= 1) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        },

        shuffleDeck() {
            this._shuffleArray(store[sessionKey]);

            const nextCard = stage.firstElementChild;

            if (nextCard && store[sessionKey].length > 0) {
                const newData = store[sessionKey].shift();
                const newNext = buildCard(newData);
                newNext.className = newNext.classList.contains('dictation-card')
                    ? 'card dictation-card card-next animating'
                    : 'card card-next animating';
                nextCard.replaceWith(newNext);
            }

            if (shuffleBtnEl) {
                shuffleBtnEl.classList.add('shuffling');
                setTimeout(() => shuffleBtnEl.classList.remove('shuffling'), 200);
            }

            console.log(`Deck shuffled: ${store[sessionKey].length} cards in queue`);
        }
    };
}
