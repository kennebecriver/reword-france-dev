# Reword France — Documentation

## 1. Что это за проект

Лёгкое SPA-приложение (без сборщика), которое:

- грузит колоды из Google Sheets;
- показывает список топиков с быстрыми действиями (shuffle до входа в режим);
- открывает **Study** — колода со свайпами и карточкой «глаз / перевод»;
- открывает **Dictation** — отдельный полноэкранный экран с той же оболочкой колоды, но **другая сцена** (`card-stage`) и **другая фабрика карточек**;
- умеет TTS через backend;
- поддерживает **Auto-play** на обоих экранах колоды и **Gemini** (один флаг на два чекбокса).

Стек: `HTML + CSS + Vanilla JS (ES Modules)`.

## 2. Структура проекта

```text
index.html
styles/main.css
src/
  bootstrap.js                    # два инстанса движка, bindDeckChrome, auto-play, topics callbacks
  api/sheetsApi.js
  config/runtime.js               # URL-параметры; Gemini на нескольких input одновременно
  state/store.js                  # appData, currentSession, dictationSession
  engine/cardsEngine.js           # swipe / queue / TTS / shuffle текущей сессии
  engine/shuffleUtils.js          # Fisher-Yates + shuffle источника топика (appData)
  ui/views.js
  ui/deckShell.js                 # клон `#deck-shell-template` → view root
  ui/topics.js
  ui/components/topicCard.js      # топик: Study | shuffle | Dictation
  ui/components/studyCard.js
  ui/components/dictationCard.js # dictation UI + ввод + HINT + «Parfait !»
```

## 3. Переиспользование экрана колоды (Deck shell)

Разметка экрана колоды задаётся **один раз** в `index.html`:

- `<template id="deck-shell-template">` — header (назад, заголовок, счётчик, shuffle), область `.deck-card-stage` (после монтирования получает уникальный `id`), footer (Done / Play / Repeat), статус воспроизведения, тумблеры Auto-play и Gemini.

`mountDeckShell(viewRoot, options)` в `src/ui/deckShell.js` клонирует шаблон в переданный корень.

| Экран | `#view-*` | Суффикс `id` | Движок | Очередь в `store` |
|-------|-----------|--------------|--------|-------------------|
| Study | `#view-deck` | нет | `Engine` (`window.Engine`) | `currentSession` |
| Dictation | `#view-deck-dictation` | `dictation-` | `DictationEngine` (`window.DictationEngine`) | `dictationSession` |

Опция **`hideAutoPlay`** в `mountDeckShell` оставлена для особых случаев; сейчас на dictation-shell Auto-play **включён** так же, как на study (`bootstrap.js`: `initAutoPlayForDeck` для обоих).

**Gemini:** `initGeminiModeToggle([studyGeminiInput, dictationGeminiInput])` держит одно логическое состояние и синхронизирует оба чекбокса.

## 4. Маршруты экранов

`showView(id)` включает `#view-${id}` у элементов с классом `.view`.

Идентификаторы: `loading`, `topics`, `deck`, `deck-dictation`.

Глобально для совместимости с разметкой: `window.showView`, `window.Engine`, `window.DictationEngine`.

## 5. Список топиков (`topicCard` + shuffle источника)

`createTopicCard` (`src/ui/components/topicCard.js`):

- **`.topic-card-main`** — открывает Study: `Engine.initDeck(name)`;
- **`.topic-topic-shuffle-btn`** — иконка как у shuffle в шапке колоды (`shuffle-btn` + анимация `shuffling`): перемешивает **исходную колоду** `store.appData[name]` на месте (**до** выбора режима);
- **`.topic-dict-btn`** — Dictation: `DictationEngine.initDeck(name)`;
- у shuffle и Dictation — `stopPropagation` / `preventDefault`, чтобы не открывался Study.

Логика перемешивания источника: `shuffleTopicSourceDeck(store, deckName)` в `src/engine/shuffleUtils.js` (Fisher-Yates). При следующем заходе в Study или Dictation очередь берётся как `[...store.appData[name]]`, порядок уже новый. Текущая активная сессия на столе при этом не меняется, пока пользователь снова не откроет топик.

Внутри колоды shuffle по-прежнему обрабатывает только **`currentSession`** / **`dictationSession`** через `Engine.shuffleDeck()` / `DictationEngine.shuffleDeck()` (`cardsEngine.js` использует общий `shuffleArrayInPlace` из `shuffleUtils.js`).

## 6. Движок `createCardsEngine`

Один модуль, две конфигурации в `bootstrap.js`:

| Параметр | Назначение |
|----------|------------|
| `sessionKey` | `currentSession` или `dictationSession` |
| `viewId` | `deck` или `deck-dictation` (куда `showView` при работе колоды / при нуле карт) |
| `dom` | `{ stage, deckTitleEl, deckCounterEl, playStatusEl, shuffleBtnEl }` — всё привязано к **своему** экрану |
| `buildCard` | `createStudyCard` или `createDictationCard` |

Активная карточка и свайп ищутся **только внутри `dom.stage`**.

**Исключения для свайпа:** в `bindEvents` игнорируется `pointerdown`, если цель внутри `button`, `input`, `textarea`, `select` — чтобы не тянуть карту при вводе и кнопках.

Основные методы: `initDeck`, `spawn`, `bindEvents`, `manualSwipe`, `swipe`, `playActiveCard`, `shuffleDeck`, `updateCounter`.

## 7. Карточка Dictation (`dictationCard.js`)

- Лейбл **«Dictation»** — отдельной строкой по центру (как раньше). Чип **HINT** стоит **под полем ввода**, справа; при наведении / `focus-within` всплывашка показывается **над** чипом (не ломает блок **«Parfait !»** снизу). Текст подсказки — **`data.text1`** (`textContent`, без HTML). У **`.dictation-card`** **`overflow: visible`**, чтобы подсказка не обрезалась.
- **Cue** (`.dictation-card-cue`): показывает **`data.text2`** (подсказка по смыслу).
- **Ввод:** поле под cue; сравнение идёт с **`dataset.t1`** / эталоном **`text1`**:
  - префикс совпадает с началом эталона → зелёная подсветка поля;
  - любое расхождение по префиксу → красная подсветка;
  - полное совпадение строки → усиленное «успешное» оформление поля, галочка **внутри** поля (absolute справа), строка **«Parfait !»** под полем (текст всегда в DOM, видимость только через **`opacity`**, чтобы не было скачка вёрстки).
- При **первом** переходе в состояние полного совпадения вызывается **`window.DictationEngine.playActiveCard()`** (эквивалент нажатия Play на экране dictation).

## 8. Карточка Study (`studyCard.js`)

Классическая карточка: `text1`, зона с кнопкой «глаз», скрытый `text2`, `dataset.t1` / `t2` для движка и TTS.

## 9. Что и где править

| Задача | Файл |
|--------|------|
| Общая разметка экрана колоды | `index.html` → `#deck-shell-template`, стили в `styles/main.css` |
| Монтирование shell / id | `src/ui/deckShell.js`, `src/bootstrap.js` |
| Топики и shuffle до режима | `topicCard.js`, `topics.js`, `shuffleUtils.js`, `bootstrap.js` |
| Study-карта | `src/ui/components/studyCard.js` |
| Dictation UI и правила ввода | `src/ui/components/dictationCard.js` |
| Свайп / TTS / shuffle сессии | `src/engine/cardsEngine.js` |
| Данные Sheets | `src/api/sheetsApi.js` |
| Состояние | `src/state/store.js` |
| Переключение экранов | `src/ui/views.js` |

## 10. Конвенции

- Новую разметку карточек собирать через DOM API / маленькие компоненты, без склеивания HTML в движке для пользовательских строк.
- Общие алгоритмы (shuffle) — в `shuffleUtils.js`, чтобы не дублировать Fisher-Yates.

## 11. Зависимости и запуск

- Сборка и npm не требуются.
- Нужен браузер с поддержкой ES modules.
- Для данных: в URL параметры **`key`** (Google Sheets API key) и **`id`** (spreadsheet id).
