# Reword France — Documentation

## 1. Что это за проект

Лёгкое SPA-приложение (без сборщика), которое:

- грузит колоды из Google Sheets;
- показывает список топиков;
- открывает **режим карточек** (study) на полном экране;
- открывает **режим Dictation** — отдельный полноценный экран с той же «оболочкой» колоды, но **другая сцена (`card-stage`) и другая фабрика карточек**;
- умеет TTS-проигрывание через backend;
- поддерживает auto-play и Gemini-режим (на основном экране колоды; Gemini-синхронизируется с экраном dictation).

Стек: `HTML + CSS + Vanilla JS (ES Modules)`.

## 2. Структура проекта

```text
index.html
styles/main.css
src/
  bootstrap.js                    # сборка приложения, два инстанса движка, биндинг UI
  api/sheetsApi.js
  config/runtime.js               # Gemini: несколько чекбоксов синхронизируются между экранами
  state/store.js                  # currentSession + dictationSession
  engine/cardsEngine.js           # один движок, параметры: очередь, DOM-scope, фабрика карты
  ui/views.js
  ui/deckShell.js                 # монтирование шаблона `#deck-shell-template` в любой `.view`
  ui/topics.js
  ui/components/topicCard.js      # топик + кнопка Dictation
  ui/components/studyCard.js
  ui/components/dictationCard.js # минимальный DOM для dictation (замени логику по месту)
```

## 3. Переиспользование экрана колоды (Deck shell)

Разметка **одного экрана колоды** определена **один раз** в `index.html`:

- `<template id="deck-shell-template">` — header, счётчик, shuffle, `#card-stage` (генерируемый класс `.deck-card-stage` + присвоенный `id`), footer, статус воспроизведения, тумблеры.

`mountDeckShell(viewRoot, options)` из `src/ui/deckShell.js` клонирует этот шаблон в два корня:

| Экран | `#view-*` root | Префикс `id` | Назначение |
|-------|----------------|----------------|-------------|
| Study | `#view-deck` | без префикса | `Engine`, очередь `store.currentSession` |
| Dictation | `#view-deck-dictation` | `dictation-*` | `DictationEngine`, очередь `store.dictationSession` |

На dictation-shell по умолчанию **скрыт** блок Auto-play (он не подключён к логике); Gemini остаётся и использует общий флаг через `initGeminiModeToggle([...inputs])`.

## 4. Маршруты экранов

`showView(id)` включает `#view-${id}`.

Активные имена:

- `loading`, `topics`, `deck`, `deck-dictation`

## 5. Topic list и кнопка Dictation

`createTopicCard` (`src/ui/components/topicCard.js`):

- слева: кнопка `.topic-card-main` — как раньше, открывает study (`Engine.initDeck`);
- справа: `.topic-dict-btn` («Dictation») — открывает dictation (`DictationEngine.initDeck`);
- `stopPropagation` на Dictation-кнопке, чтобы не срабатывал клик по всей строке.

## 6. Движок `createCardsEngine`

Один код, несколько конфигураций:

- **`sessionKey`**: ключ массива в `store` (`currentSession` | `dictationSession`);
- **`viewId`**: куда переходить при `updateCounter`/пустой очереди (после последней карточки — `topics`);
- **`dom`**: ссылки на **конкретный** `#card-stage` и элементы счётчика внутри своего экрана;
- **`buildCard`**: функция `data => HTMLElement` (`createStudyCard` или `createDictationCard`);

Внутри методы всегда ищут `.card-active` **внутри `dom.stage`**, а не во всём документе.

## 7. Что и где править дальше

| Задача | Файл |
|--------|------|
| Верстка/классы общего экрана колоды | `index.html` → `#deck-shell-template` и `styles/main.css` |
| Два экрана / префиксы id | `src/ui/deckShell.js`, `bootstrap.js` |
| Разметка карточки study | `src/ui/components/studyCard.js` |
| Разметка и поведение dictation | `src/ui/components/dictationCard.js` (+ при необходимости отдельный движок-обёртка) |
| Логика свайпа/TTS/shuffle для обоих | `src/engine/cardsEngine.js` |
| Состояние очередей | `src/state/store.js` |

## 8. Зависимости и запуск

- npm не нужен.
- Для данных: `Google Sheets API key` и `sheet id` в query (`?key=...&id=...`).
