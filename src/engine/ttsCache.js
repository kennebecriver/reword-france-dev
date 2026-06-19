/**
 * ttsCache.js — Unified browser cache layer for TTS audio.
 *
 * Единый модуль для работы с кешем озвучки (CacheStorage + in-memory).
 * Все ключи формируются по единому паттерну: tts:{lang}:{model}:{hash}
 *
 * Фраза хешируется через djb2, чтобы ключ
 * гарантированно был URL-safe и не превышал разумной длины.
 *
 * Примеры ключей:
 *   tts:fr-FR:gemini:a1b2c3d4...
 *   tts:ru-RU:default:e5f6g7h8...
 *
 * Два уровня кеша:
 *   1. In-memory (Map) — быстрый доступ в рамках сессии
 *   2. CacheStorage — сохраняется между перезагрузками
 */

const CACHE_NAME = 'tts-audio-cache';

/** In-memory cache: Response-объекты для getCachedResponse/setCachedResponse */
const _responseCache = new Map();

/** In-memory cache: ArrayBuffer для fetchTTS (быстрый повторный доступ) */
const _bufferCache = new Map();

const TTS_BASE_URL = 'https://reword-france-463001342259.northamerica-northeast2.run.app/get_voice';

import { djb2 } from './hash.js';

// ─── Ключи ──────────────────────────────────────────────────────────────

/**
 * Сформировать единый ключ кеша: tts:{lang}:{model}:{hash(phrase)}
 * @param {string} lang  — код языка ('fr-FR', 'ru-RU', или '')
 * @param {string} model — модель ('gemini' или 'default')
 * @param {string} phrase — текст фразы (будет захеширована)
 * @returns {string}
 */
export function buildCacheKey(lang, model, phrase) {
  return `/tts/${lang || 'none'}/${model || 'default'}/${djb2(phrase)}`;
}

/**
 * Определить модель по языку.
 * Французский — Gemini, остальные — default.
 * @param {string} lang
 * @returns {string}
 */
export function resolveModel(lang) {
  return lang === 'fr-FR' ? 'gemini' : 'default';
}

// ─── Response-кеш (для cardsEngine и общего использования) ─────────────

/**
 * Достать Response из кеша: сначала in-memory, потом CacheStorage.
 * @param {string} cacheKey
 * @returns {Promise<Response|null>}
 */
export async function getCachedResponse(cacheKey) {
  // Быстрый путь: in-memory
  if (_responseCache.has(cacheKey)) {
    return _responseCache.get(cacheKey).clone();
  }

  // CacheStorage
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(cacheKey);
    if (response) {
      _responseCache.set(cacheKey, response.clone());
      return response;
    }
  } catch (e) {
    console.warn('[ttsCache] CacheStorage read error:', e);
  }

  return null;
}

/**
 * Сохранить Response в оба уровня кеша (memory + CacheStorage).
 * @param {string} cacheKey
 * @param {Response} response
 * @returns {Promise<void>}
 */
export async function setCachedResponse(cacheKey, response) {
  _responseCache.set(cacheKey, response.clone());

  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(cacheKey, response.clone());
  } catch (e) {
    console.warn('[ttsCache] CacheStorage write error:', e);
  }
}

// ─── fetchTTS (для autoPlay / listenEngine) ───────────────────────────

/**
 * Запросить TTS-аудио, вернуть ArrayBuffer.
 * Проверяет: in-memory → CacheStorage → сеть.
 * При ответе от сервера сохраняет во все уровни кеша.
 *
 * @param {string} phrase
 * @param {string} lang — код языка ('fr-FR', 'ru-RU')
 * @param {object} [options]
 * @param {string} [options.model] — принудительная модель (если не указана, определяется по языку)
 * @param {(msg: string) => void} [options.onStatus] — колбэк для статусных сообщений
 * @returns {Promise<ArrayBuffer>}
 */
export async function fetchTTS(phrase, lang, options = {}) {
  const { onStatus } = options;
  const model = options.model || resolveModel(lang);
  const cacheKey = buildCacheKey(lang, model, phrase);

  // 1. Быстрейший путь: уже закешированный ArrayBuffer
  if (_bufferCache.has(cacheKey)) {
    if (onStatus) onStatus('From cache');
    return _bufferCache.get(cacheKey).slice(0);
  }

  // 2. Response-кеш (memory + CacheStorage)
  try {
    const cachedResp = await getCachedResponse(cacheKey);
    if (cachedResp) {
      if (onStatus) onStatus('From cache');
      const buffer = await cachedResp.arrayBuffer();
      _bufferCache.set(cacheKey, buffer);
      return buffer.slice(0);
    }
  } catch (e) {
    // fall through к сети
  }

  // 3. Сеть
  if (onStatus) onStatus('Generating audio...');
  const params = new URLSearchParams({ phrase, language_code: lang });
  if (model === 'gemini') params.set('model', 'gemini');
  const url = `${TTS_BASE_URL}?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`TTS server returned ${response.status}`);

  // 4. Сохранить Response в оба уровня
  await setCachedResponse(cacheKey, response.clone());

  // 5. Вернуть ArrayBuffer + сохранить в bufferCache
  const buffer = await response.arrayBuffer();
  _bufferCache.set(cacheKey, buffer);
  return buffer.slice(0);
}