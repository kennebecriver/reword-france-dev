# Audio subsystem (brief)

This document describes the key concepts of the application's audio logic.

- Core elements:
  - `bgAudio` (`src/engine/autoPlay.js`) — a single `HTMLAudioElement` used for TTS and combined WAV playback.
  - `fetchTTS(phrase, lang)` — returns an `ArrayBuffer` of audio and is cached in memory.
  - `createAutoPlay()` / `createAutoPlayFr()` — build a single WAV from multiple segments (TTS + low-amplitude tail)
    using `OfflineAudioContext` and `audioBufferToWav`.

- Why we stitch segments into one WAV:
  - Mobile browsers aggressively throttle timers and may pause intervals/timeouts when `document.hidden`.
  - A continuous audio stream with a minimal audible tail is more likely to be treated as active audio, reducing
    the chance of playback being suspended.

- Caching and resources:
  - `fetchTTS` caches in-memory by `lang+phrase`.
  - Autoplay renders to a Blob WAV and plays it via `bgAudio` using a Blob URL; remember to `URL.revokeObjectURL()` to free memory.

- Cancellation and concurrency:
  - `createAutoPlay` uses a `gen`/_gen counter to cancel stale tasks.
  - `listenEngine` uses `playGeneration` to control concurrent playback.

- Warnings:
  - The WAV encoder (`audioBufferToWav`) assumes 16-bit PCM; changing AudioBuffer characteristics may break it.
  - Wake Lock and MediaSession are not universally supported; the code already degrades gracefully.
