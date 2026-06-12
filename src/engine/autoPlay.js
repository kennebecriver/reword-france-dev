/**
 * autoPlay.js — On Air: режим автоматического листенинга.
 *
 * ─── ПРОБЛЕМА ───
 * Android Chrome при выключенном экране:
 *   1) Жёстко тормозит setTimeout/setInterval (до ~1 раза в минуту).
 *   2) Может убивать медиа-сессию (пропадает уведомление в шторке).
 *   3) Блокирует работу динамически созданных Audio-элементов.
 *
 * ─── РЕШЕНИЕ ───
 * - Аудио-таймеры: вместо setTimeout генерируем беззвучный WAV и играем его
 *   через отдельный <audio>. Событие onended не тормозится никогда.
 * - Два глобальных аудио-элемента:
 *     bgAudio   — для TTS (фразы с сервера), src НЕ очищается между треками,
 *                 чтобы не сбросить медиа-сессию Android.
 *     timerAudio — для беззвучных WAV-таймеров, полностью независим.
 * - Media Session API: метаданные (artwork, title) + playbackState сообщают
 *   ОС что это медиаплеер, а не обычный сайт.
 * - Wake Lock API: удерживает экран активным (где поддерживается).
 * - Хендлеры наушников регистрируются внутри пользовательского жеста —
 *   требование Android/iOS.
 *
 * ─── КАК РАБОТАЕТ ───
 *   startAutoPlay()
 *     │
 *     ├─ requestWakeLock() + registerMediaSessionHandlers()
 *     ├─ playActiveCard() → TTS фразы (bgAudio)
 *     │     └─ onended → _scheduleNextAuto()
 *     │           └─ createSilenceBlob(3000) → timerAudio.play()
 *     │                 └─ onended → _goNextInternal() → renderCard()
 *     │                       └─ _onCardRendered() → playActiveCard() → ...
 *     └── так до конца колоды
 *
 *   toggleAutoPlayPause() — пауза/возобновление (реагирует на наушники)
 *   stopAutoPlay() — полная остановка, освобождение Wake Lock
 *   goNext/goBack/shuffle — при ручных действиях автоплеер отключается
 */

// ─── ГЛОБАЛЬНЫЕ АУДИО-ЭЛЕМЕНТЫ ──────────────────────────────────────────

/** @type {HTMLAudioElement} Основной плеер для TTS.
 *  Создаётся один раз на уровне модуля — Android требует постоянной
 *  ссылки для фоновой работы. */
export const bgAudio = new Audio();
bgAudio.preload = 'auto';
bgAudio.volume = 1.0;

/** @type {HTMLAudioElement} Беззвучный плеер для аудио-таймеров.
 *  Полностью независим от bgAudio, чтобы таймеры и TTS не мешали друг другу. */
export const timerAudio = new Audio();
timerAudio.preload = 'auto';
timerAudio.volume = 0; // без звука

/**
 * Сгенерировать беззвучный WAV-файл заданной длины.
 * Используется вместо setTimeout — событие onended у <audio>
 * срабатывает точно даже при выключенном экране.
 *
 * @param {number} ms — длительность в миллисекундах
 * @returns {Blob} WAV-блоб с тишиной
 */
export function createSilenceBlob(ms) {
    const sampleRate = 8000;
    const numSamples = Math.floor(sampleRate * ms / 1000);
    const numChannels = 1;
    const bitsPerSample = 16;
    const dataSize = numSamples * numChannels * (bitsPerSample / 8);
    const buf = new ArrayBuffer(44 + dataSize);
    const dv = new DataView(buf);
    const w = (off, str) => {
        for (let i = 0; i < str.length; i++) dv.setUint8(off + i, str.charCodeAt(i));
    };
    w(0, 'RIFF'); dv.setUint32(4, 36 + dataSize, true);
    w(8, 'WAVE'); w(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
    dv.setUint16(22, numChannels, true); dv.setUint32(24, sampleRate, true);
    dv.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    dv.setUint16(32, numChannels * (bitsPerSample / 8), true);
    dv.setUint16(34, bitsPerSample, true);
    w(36, 'data'); dv.setUint32(40, dataSize, true);
    return new Blob([buf], { type: 'audio/wav' });
}

// ─── ИНТЕРФЕЙС autoPlay ──────────────────────────────────────────────────

/**
 * Создаёт экземпляр автоплеера для Listen-движка.
 *
 * @param {{
 *   getCurrentIndex: () => number,
 *   getDeckLength: () => number,
 *   goNextInternal: () => void,
 *   goBackInternal: () => void,
 *   playActiveCard: () => Promise<void>,
 *   renderCard: () => void,
 *   getCardData: () => ({ text1: string, text2: string }|null),
 *   onStateChange: (isActive: boolean, isPaused: boolean) => void
 * }} api — колбэки к движку
 * @returns {{
 *   start: () => void,
 *   togglePause: () => void,
 *   stop: () => void,
 *   isPlaying: () => boolean,
 *   isPaused: () => boolean,
 *   onCardRendered: () => void,
 *   cancel: () => void
 * }}
 */
export function createAutoPlay(api) {
    /** @type {boolean} Активен ли автоплеер */
    let _active = false;
    /** @type {boolean} На паузе? */
    let _paused = false;
    /** @type {number|null} Таймер fallback */
    let _timer = null;
    /** @type {string|null} URL текущего WAV-таймера */
    let _silenceUrl = null;
    /** @type {WakeLockSentinel|null} */
    let _wakeLock = null;

    // ─── Wake Lock ────────────────────────────────────────────────────────

    /** Запросить Wake Lock (чтобы экран не гас, если поддерживается). */
    const _requestWakeLock = async () => {
        try {
            if ('wakeLock' in navigator) {
                _wakeLock = await navigator.wakeLock.request('screen');
                _wakeLock.addEventListener('release', () => { _wakeLock = null; });
            }
        } catch (err) {
            console.warn('[autoPlay] Wake Lock unavailable:', err);
        }
    };

    /** Освободить Wake Lock. */
    const _releaseWakeLock = () => {
        if (_wakeLock) {
            _wakeLock.release().catch(() => {});
            _wakeLock = null;
        }
    };

    // ─── Media Session ────────────────────────────────────────────────────

    /**
     * Обновить метаданные и состояние Media Session.
     * Без artwork (512x512) Android Chrome не продвигает вкладку
     * в статус фонового медиаплеера.
     */
    const _updateMediaSession = (state, cardData) => {
        if (!('mediaSession' in navigator)) return;
        if (state === 'playing' && cardData) {
            try {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: cardData.text2 || 'Reword',
                    artist: 'Reword',
                    album: cardData.text1 || '',
                    artwork: [
                        { src: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
                        // SVG data URI — гарантированно загрузится без сети
                        { src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Crect width='512' height='512' fill='%231a1a2e' rx='60'/%3E%3Ctext x='256' y='300' text-anchor='middle' fill='%23fff' font-size='280' font-family='sans-serif'%3ER%3C/text%3E%3C/svg%3E",
                          sizes: '512x512', type: 'image/svg+xml' }
                    ]
                });
                if ('setPositionState' in navigator.mediaSession) {
                    navigator.mediaSession.setPositionState({
                        duration: 10,
                        playbackRate: 1.0,
                        position: 0
                    });
                }
            } catch (e) { /* ignore */ }
            navigator.mediaSession.playbackState = 'playing';
        } else if (state === 'paused') {
            navigator.mediaSession.playbackState = 'paused';
        } else {
            // 'none'
            try { navigator.mediaSession.metadata = null; } catch (e) { /* ignore */ }
            navigator.mediaSession.playbackState = 'none';
        }
    };

    /**
     * Зарегистрировать обработчики кнопок наушников (Media Session action handlers).
     * ДОЛЖНО вызываться синхронно внутри пользовательского жеста (клик),
     * иначе Android/iOS игнорируют регистрацию.
     */
    const _registerHandlers = () => {
        if (!('mediaSession' in navigator)) return;
        try {
            navigator.mediaSession.setActionHandler('play', () => {
                if (_active && _paused) togglePause();
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                if (_active && !_paused) togglePause();
            });
            navigator.mediaSession.setActionHandler('previoustrack', () => {
                api.goBackInternal();
            });
            navigator.mediaSession.setActionHandler('nexttrack', () => {
                api.goNextInternal();
            });
            // Заглушки — без них Android отключает сессию
            navigator.mediaSession.setActionHandler('seekbackward', () => {});
            navigator.mediaSession.setActionHandler('seekforward', () => {});
        } catch (e) {
            console.warn('[autoPlay] Media Session handlers failed:', e);
        }
    };

    /** Перехватить Wake Lock и хендлеры при возвращении экрана. */
    const _onVisibilityChange = () => {
        if (!document.hidden && _active && !_paused) {
            _requestWakeLock();
            _registerHandlers();
        }
    };
    document.addEventListener('visibilitychange', _onVisibilityChange);

    // ─── АУДИО-ТАЙМЕРЫ ───────────────────────────────────────────────────

    /**
     * Сгенерировать беззвучный WAV-файл заданной длины.
     * Используется вместо setTimeout — событие onended у <audio>
     * срабатывает точно даже при выключенном экране.
     *
     * @param {number} ms — длительность в миллисекундах
     * @returns {Blob} WAV-блоб с тишиной
     */
    const _createSilenceBlob = (ms) => {
        const sampleRate = 8000;
        const numSamples = Math.floor(sampleRate * ms / 1000);
        const numChannels = 1;
        const bitsPerSample = 16;
        const dataSize = numSamples * numChannels * (bitsPerSample / 8);
        const buf = new ArrayBuffer(44 + dataSize);
        const dv = new DataView(buf);
        const w = (off, str) => {
            for (let i = 0; i < str.length; i++) dv.setUint8(off + i, str.charCodeAt(i));
        };
        w(0, 'RIFF'); dv.setUint32(4, 36 + dataSize, true);
        w(8, 'WAVE'); w(12, 'fmt ');
        dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
        dv.setUint16(22, numChannels, true); dv.setUint32(24, sampleRate, true);
        dv.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
        dv.setUint16(32, numChannels * (bitsPerSample / 8), true);
        dv.setUint16(34, bitsPerSample, true);
        w(36, 'data'); dv.setUint32(40, dataSize, true);
        // Сэмплы и так нулевые (ArrayBuffer инициализирован 0)
        return new Blob([buf], { type: 'audio/wav' });
    };

    /**
     * Запустить беззвучный таймер через timerAudio.
     * @param {number} ms — длительность
     * @param {() => void} onEnd — колбэк по окончании
     */
    const _startSilenceTimer = (ms, onEnd) => {
        _clearSilenceTimer();
        if (_silenceUrl) { URL.revokeObjectURL(_silenceUrl); _silenceUrl = null; }
        const blob = _createSilenceBlob(ms);
        const url = URL.createObjectURL(blob);
        _silenceUrl = url;
        timerAudio.src = url;
        timerAudio.onended = () => {
            URL.revokeObjectURL(url);
            _silenceUrl = null;
            if (typeof onEnd === 'function') onEnd();
        };
        timerAudio.play().catch(() => {
            // Fallback — если play() не сработал
            _timer = setTimeout(() => {
                _timer = null;
                if (typeof onEnd === 'function') onEnd();
            }, ms);
        });
    };

    /** Остановить текущий аудио-таймер. */
    const _clearSilenceTimer = () => {
        if (_timer) { clearTimeout(_timer); _timer = null; }
        timerAudio.pause();
        timerAudio.src = '';
        if (_silenceUrl) { URL.revokeObjectURL(_silenceUrl); _silenceUrl = null; }
    };

    // ─── ПУБЛИЧНЫЙ API ───────────────────────────────────────────────────

    const autoPlay = {
        /** Запустить автоплеер. */
        start() {
            if (_active) return;
            _active = true;
            _paused = false;
            _requestWakeLock();
            _registerHandlers();
            _updateMediaSession('paused');
            api.onStateChange(true, false);
            api.playActiveCard().then(() => autoPlay._scheduleNext());
        },

        /** Переключить паузу (Play/Pause с наушников). */
        togglePause() {
            if (!_active) return;
            if (_paused) {
                _paused = false;
                const data = api.getCardData();
                _updateMediaSession('playing', data);
                api.onStateChange(true, false);
                api.playActiveCard().then(() => autoPlay._scheduleNext());
            } else {
                _paused = true;
                _clearSilenceTimer();
                _updateMediaSession('paused');
                api.onStateChange(true, true);
            }
        },

        /** Полностью остановить автоплеер. */
        stop() {
            if (!_active) return;
            _clearSilenceTimer();
            _active = false;
            _paused = false;
            _releaseWakeLock();
            _updateMediaSession('none');
            api.onStateChange(false, false);
        },

        /** Активен и не на паузе? */
        isPlaying() { return _active && !_paused; },
        /** На паузе? */
        isPaused() { return _active && _paused; },

        /**
         * Вызывается движком после каждой отрисовки карты.
         * Если автоплеер активен — запускает TTS + планирует следующую.
         */
        onCardRendered() {
            if (!_active || _paused) return;
            const data = api.getCardData();
            if (data) _updateMediaSession('playing', data);
            api.playActiveCard().then(() => autoPlay._scheduleNext());
        },

        /**
         * Отменить всё (при уничтожении движка).
         * Убирает visibility-обработчик.
         */
        destroy() {
            autoPlay.stop();
            document.removeEventListener('visibilitychange', _onVisibilityChange);
        },

        // ─── ВНУТРЕННЕЕ ───────────────────────────────────────────────────

        /** Запланировать переход к следующей карте через 3 секунды. */
        _scheduleNext() {
            if (!_active || _paused) return;
            _clearSilenceTimer();
            const deckLen = api.getDeckLength();
            if (!deckLen || api.getCurrentIndex() >= deckLen - 1) {
                autoPlay.stop();
                return;
            }
            _startSilenceTimer(3000, () => {
                if (!_active || _paused) return;
                api.goNextInternal();
            });
        }
    };

    return autoPlay;
}