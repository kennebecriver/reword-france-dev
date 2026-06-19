/**
 * hash.js — Простая хеш-функция djb2.
 *
 * Берёт строку, возвращает 32-битный unsigned int в hex.
 * Быстро, компактно, без зависимостей.
 *
 * @param {string} str
 * @returns {string} hex-строка (8 символов)
 */
export function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xFFFFFFFF;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}