/**
 * autoPlay.js — On Air: режим автоматического листенинга.
 *
 * ─── ПРОБЛЕМА (Android Chrome, экран выключен) ───
 *
 * 1) Троттлинг setTimeout: при document.hidden Chrome замедляет JS-таймеры
 *    до ~1 вызова в минуту. Обычный setTimeout(3000) не работает.
 *
 * 2) Беззвучное аудио не защищает: Chrome даёт исключение из троттлинга
 *    только вкладкам с РЕАЛЬНЫМ звуком (выше порога громкости). WAV
 *    с нулевыми сэмплами + volume=0 НЕ считаются за «играющее аудио».
 *
 * 3) Wake Lock снимается при document.hidden: как только экран гаснет,
 *    document.hidden=true и лок автоматически освобождается.
 *
 * ─── РЕШЕНИЕ ───
 *
 * Вместо отдельных таймеров склеиваем ВСЁ в один непрерывный аудио-поток:
 *
 *   [TTS_ru] + [3s low-amp sine 30Hz] + [TTS_fr] + [3s low-amp sine 30Hz]
 *   └────── один WAV-файл, играется без разрывов ──────────────────────→
 *
 * - bgAudio.onended срабатывает один раз на весь шаг (карта + паузы).
 * - Low-amp sine (30Hz, амплитуда 0.01): Chrome считает audible.
 * - Media Session API держит «Сейчас играет» в шторке.
 * - Wake Lock — дополнительная защита (на устройствах где работает).
 */

// ─── ГЛОБАЛЬНЫЙ АУДИО-ЭЛЕМЕНТ ──────────────────────────────────────────

/** @type {HTMLAudioElement} */
export const bgAudio = new Audio();
bgAudio.preload = 'auto';
bgAudio.volume = 1.0;

// ─── УТИЛИТЫ ────────────────────────────────────────────────────────────

/**
 * Fetch TTS audio and return raw ArrayBuffer.
 * Caches responses in memory by language+phrase key.
 * @param {string} phrase
 * @param {string} languageCode — e.g. 'ru-RU', 'fr-FR'
 * @returns {Promise<ArrayBuffer>}
 */
const _ttsCache = {};

export async function fetchTTS(phrase, languageCode) {
    const cacheKey = `tts-${languageCode}-${phrase}`;
    if (_ttsCache[cacheKey]) return _ttsCache[cacheKey].slice(0);

    const TTS_BASE_URL = 'https://reword-france-463001342259.northamerica-northeast2.run.app/get_voice';
    const params = new URLSearchParams({ phrase, language_code: languageCode });
    const url = `${TTS_BASE_URL}?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`TTS server returned ${response.status}`);

    const buffer = await response.arrayBuffer();
    _ttsCache[cacheKey] = buffer;
    return buffer.slice(0);
}

function audioBufferToWav(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const bitsPerSample = 16;
    const channelData = [];
    for (let c = 0; c < numChannels; c++) channelData.push(audioBuffer.getChannelData(c));
    const length = audioBuffer.length;
    const dataSize = length * numChannels * (bitsPerSample / 8);
    const buf = new ArrayBuffer(44 + dataSize);
    const dv = new DataView(buf);
    const w = (off, str) => { for (let i = 0; i < str.length; i++) dv.setUint8(off + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + dataSize, true);
    w(8, 'WAVE'); w(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
    dv.setUint16(22, numChannels, true); dv.setUint32(24, sampleRate, true);
    dv.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    dv.setUint16(32, numChannels * (bitsPerSample / 8), true);
    dv.setUint16(34, bitsPerSample, true);
    w(36, 'data'); dv.setUint32(40, dataSize, true);
    let offset = 44;
    for (let i = 0; i < length; i++) {
        for (let c = 0; c < numChannels; c++) {
            const s = Math.max(-1, Math.min(1, channelData[c][i]));
            dv.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            offset += 2;
        }
    }
    return new Blob([buf], { type: 'audio/wav' });
}

/**
 * Низкоамплитудный синус 30Hz, амплитуда 0.01.
 * Достаточно, чтобы Chrome считал вкладку «играющей аудио»,
 * но едва слышно для пользователя.
 */
function createLowTail(sampleRate, durationMs) {
    const len = Math.floor(sampleRate * durationMs / 1000);
    const data = new Float32Array(len);
    for (let i = 0; i < len; i++) {
        data[i] = Math.sin(2 * Math.PI * 30 * i / sampleRate) * 0.01;
    }
    return data;
}

// ─── createAutoPlay ──────────────────────────────────────────────────────

/**
 * @param {{
 *   getCardData: () => ({ text1: string, text2: string }|null),
 *   getDeckLength: () => number,
 *   getCurrentIndex: () => number,
 *   goNextInternal: () => void,
 *   goBackInternal: () => void,
 *   fetchTTS: (phrase: string, lang: string) => Promise<ArrayBuffer>,
 *   onStateChange: (active: boolean, paused: boolean) => void,
 *   onStepStart?: () => void
 * }} api
 */
export function createAutoPlay(api) {
    let _active = false;
    let _paused = false;
    let _gen = 0;
    let _wakeLock = null;

    // ─── Wake Lock ────────────────────────────────────────────────────

    const _requestWakeLock = async () => {
        try {
            if ('wakeLock' in navigator) {
                _wakeLock = await navigator.wakeLock.request('screen');
                _wakeLock.addEventListener('release', () => { _wakeLock = null; });
            }
        } catch (err) { console.warn('[autoPlay] Wake Lock:', err); }
    };
    const _releaseWakeLock = () => {
        if (_wakeLock) { _wakeLock.release().catch(() => {}); _wakeLock = null; }
    };

    // ─── Media Session ────────────────────────────────────────────────

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
                        { src: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 512 512\'%3E%3Crect width=\'512\' height=\'512\' fill=\'%231a1a2e\' rx=\'60\'/%3E%3Ctext x=\'256\' y=\'300\' text-anchor=\'middle\' fill=\'%23fff\' font-size=\'280\' font-family=\'sans-serif\'%3ER%3C/text%3E%3C/svg%3E',
                          sizes: '512x512', type: 'image/svg+xml' }
                    ]
                });
                if ('setPositionState' in navigator.mediaSession) {
                    navigator.mediaSession.setPositionState({ duration: 10, playbackRate: 1.0, position: 0 });
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

    const _registerHandlers = () => {
        if (!('mediaSession' in navigator)) return;
        try {
            navigator.mediaSession.setActionHandler('play', () => { if (_active && _paused) togglePause(); });
            navigator.mediaSession.setActionHandler('pause', () => { if (_active && !_paused) togglePause(); });
            navigator.mediaSession.setActionHandler('previoustrack', () => { api.goBackInternal(); });
            navigator.mediaSession.setActionHandler('nexttrack', () => { api.goNextInternal(); });
            navigator.mediaSession.setActionHandler('seekbackward', () => {});
            navigator.mediaSession.setActionHandler('seekforward', () => {});
        } catch (e) { console.warn('[autoPlay] Media Session:', e); }
    };

    const _onVisibilityChange = () => {
        if (!document.hidden && _active && !_paused) {
            _requestWakeLock();
            _registerHandlers();
        }
    };
    document.addEventListener('visibilitychange', _onVisibilityChange);

    // ─── ОСНОВНАЯ ЛОГИКА ─────────────────────────────────────────────

    /**
     * Собрать один WAV: [TTS_ru + 3s low-tail + TTS_fr + 3s low-tail].
     */
    async function _buildStepAudio(cardData) {
        const gen = _gen;

        const ruPhrase = (cardData.text2 || '').split('|')[0].trim();
        const frPhrase = (cardData.text1 || '').split('|')[0].trim();

        const [ruRaw, frRaw] = await Promise.all([
            ruPhrase ? api.fetchTTS(ruPhrase, 'ru-RU') : null,
            frPhrase ? api.fetchTTS(frPhrase, 'fr-FR') : null
        ]);
        if (gen !== _gen) return null;

        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const sr = ctx.sampleRate;

        let ruAudio = null, frAudio = null;
        try {
            if (ruRaw) ruAudio = await ctx.decodeAudioData(ruRaw.slice(0));
            if (frRaw) frAudio = await ctx.decodeAudioData(frRaw.slice(0));
        } catch (e) { ctx.close(); throw e; }
        if (gen !== _gen) { ctx.close(); return null; }

        const ruLen = ruAudio ? ruAudio.length : 0;
        const frLen = frAudio ? frAudio.length : 0;
        const tailLen = Math.floor(sr * 3);
        const totalLen = (ruLen || 1) + tailLen + (frLen || 1) + tailLen;

        const offline = new OfflineAudioContext(1, totalLen, sr);
        let offset = 0;

        if (ruAudio) {
            const s = offline.createBufferSource();
            s.buffer = ruAudio;
            s.connect(offline.destination);
            s.start(offset / sr);
            offset += ruLen;
        } else { offset += 1; }

        // tail #1
        {
            const arr = createLowTail(sr, 3000);
            const b = offline.createBuffer(1, tailLen, sr);
            b.getChannelData(0).set(arr);
            const s = offline.createBufferSource();
            s.buffer = b;
            s.connect(offline.destination);
            s.start(offset / sr);
            offset += tailLen;
        }

        if (frAudio) {
            const s = offline.createBufferSource();
            s.buffer = frAudio;
            s.connect(offline.destination);
            s.start(offset / sr);
            offset += frLen;
        }

        // tail #2
        {
            const arr = createLowTail(sr, 3000);
            const b = offline.createBuffer(1, tailLen, sr);
            b.getChannelData(0).set(arr);
            const s = offline.createBufferSource();
            s.buffer = b;
            s.connect(offline.destination);
            s.start(offset / sr);
        }

        const rendered = await offline.startRendering();
        ctx.close();
        if (gen !== _gen) return null;
        return audioBufferToWav(rendered);
    }

    function _playBlob(blob) {
        const url = URL.createObjectURL(blob);
        bgAudio.src = url;
        return new Promise((resolve) => {
            bgAudio.onended = () => { URL.revokeObjectURL(url); resolve(); };
            bgAudio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
            bgAudio.play().catch(() => resolve());
        });
    }

    async function _playStep() {
        if (!_active || _paused) return;
        const gen = ++_gen;

        const deckLen = api.getDeckLength();
        const isLast = !deckLen || api.getCurrentIndex() >= deckLen - 1;

        const cardData = api.getCardData();
        if (!cardData) { stop(); return; }

        _updateMediaSession('playing', cardData);
        if (typeof api.onStepStart === 'function') api.onStepStart();

        try {
            const blob = await _buildStepAudio(cardData);
            if (gen !== _gen || !_active || _paused) return;
            if (blob) await _playBlob(blob);
        } catch (e) {
            console.error('[autoPlay] step error:', e);
        }

        if (gen !== _gen || !_active || _paused) return;
        if (isLast) { stop(); return; }

        api.goNextInternal();
        // onCardRendered will call _playStep again
    }

    // ─── ПУБЛИЧНЫЙ API ───────────────────────────────────────────────

    const autoPlay = {
        start() {
            if (_active) return;
            _active = true; _paused = false; _gen++;
            bgAudio.pause(); bgAudio.src = '';
            _requestWakeLock();
            _registerHandlers();
            _updateMediaSession('paused');
            api.onStateChange(true, false);
            _playStep();
        },

        togglePause() {
            if (!_active) return;
            if (_paused) {
                _paused = false;
                api.onStateChange(true, false);
                // Resume: play the current blob or restart step
                if (bgAudio.src && bgAudio.paused) {
                    _updateMediaSession('playing', api.getCardData());
                    bgAudio.play().catch(() => _playStep());
                } else {
                    _playStep();
                }
            } else {
                _paused = true;
                bgAudio.pause();
                _updateMediaSession('paused');
                api.onStateChange(true, true);
            }
        },

        stop() {
            if (!_active) return;
            _active = false; _paused = false; _gen++;
            bgAudio.pause(); bgAudio.src = '';
            _releaseWakeLock();
            _updateMediaSession('none');
            api.onStateChange(false, false);
        },

        isPlaying() { return _active && !_paused; },
        isPaused() { return _active && _paused; },

        onCardRendered() {
            if (!_active || _paused) return;
            _playStep();
        },

        destroy() {
            autoPlay.stop();
            document.removeEventListener('visibilitychange', _onVisibilityChange);
        }
    };

    return autoPlay;
}