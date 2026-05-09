# Reword France — Documentation

## 1. Что это за проект
Лёгкое SPA-приложение (без сборщика), которое:
- грузит колоды из Google Sheets;
- показывает список топиков;
- запускает режим карточек со свайпами;
- умеет проигрывать фразу через TTS backend;
- поддерживает авто-проигрывание и Gemini-режим.

Технологический стек: `HTML + CSS + Vanilla JS (ES Modules)`.

## 2. Структура проекта
```text
index.html
styles/main.css
src/
  bootstrap.js              # точка входа приложения
  api/sheetsApi.js          # загрузка данных из Google Sheets
  config/runtime.js         # чтение URL-параметров и Gemini toggle
  state/store.js            # централизованное состояние
  engine/cardsEngine.js     # логика карточек (drag/swipe/play/shuffle)
  ui/views.js               # переключение экранов
  ui/topics.js              # рендер списка топиков
  ui/components/topicCard.js# DOM-компонент карточки топика
  ui/components/studyCard.js# DOM-компонент учебной карточки
```

## 3. Принципы декомпозиции (актуально)
В проекте разделены:
- **бизнес-логика** (`engine`, `api`, `config`);
- **состояние** (`state/store.js`);
- **UI-компоненты** (`ui/components/*`);
- **UI-оркестрация** (`ui/topics.js`, `ui/views.js`, `bootstrap.js`).

Ключевое правило: разметка DOM создаётся через отдельные компонентные фабрики, а не через `innerHTML` в движке.

Это сделано для:
- более безопасного рендера (`textContent` вместо строкового HTML);
- удобного редактирования верстки в одном месте;
- уменьшения связности между логикой и представлением.

## 4. Жизненный цикл приложения
1. В `bootstrap.js` читается runtime-конфиг (URL параметры `key`, `id`) и инициализируется Gemini toggle.
2. Создаётся API-слой `createSheetsApi`.
3. Создаётся движок `createCardsEngine`.
4. На `window.onload`:
   - загружаются колоды из Sheets;
   - рендерится список топиков;
   - открывается экран `topics`.
5. При клике на топик: `Engine.initDeck(name)` запускает карточки.

## 5. UI-компоненты
### `createTopicCard` (`src/ui/components/topicCard.js`)
Создаёт узел `.topic-card` для списка колод:
- заголовок (название топика);
- мета-строка (`N cards`);
- обработчик клика для открытия колоды.

### `createStudyCard` (`src/ui/components/studyCard.js`)
Создаёт узел `.card`:
- primary текст (`text1`);
- кнопку reveal (иконка глаза);
- secondary текст (`text2`, скрыт до reveal);
- dataset-поля (`t1`, `t2`) для логики `Engine`.

## 6. Движок карточек (`createCardsEngine`)
Основные методы:
- `initDeck(name)` — готовит сессию и показывает экран колоды.
- `spawn()` — поддерживает две карточки на сцене (`active` + `next`).
- `createCardEl(data)` — делегирует рендер в `createStudyCard`.
- `bindEvents(el)` — drag/swipe управление активной карточкой.
- `swipe(el, dir)` — анимация и обновление очереди.
- `playActiveCard()` — TTS загрузка/кеш/проигрывание.
- `shuffleDeck()` — перемешивание очереди + обновление next-card.

## 7. Styling
Все стили находятся в `styles/main.css`.

Новый UI элемент:
- `.topic-card-meta` — стиль подписи с количеством карточек в топике.

## 8. Что и где менять
- Изменить верстку топика: `src/ui/components/topicCard.js`.
- Изменить верстку учебной карточки: `src/ui/components/studyCard.js`.
- Изменить поведение свайпа: `src/engine/cardsEngine.js`.
- Изменить источник данных / парсинг таблицы: `src/api/sheetsApi.js`.
- Изменить роутинг экранов: `src/ui/views.js`.
- Изменить тему/цвета/размеры: `styles/main.css`.

## 9. Конвенции для будущих изменений
- Не добавлять новую HTML-разметку карточек через `innerHTML` в engine-слой.
- Для новых визуальных блоков сначала создавать функцию-компонент в `ui/components`.
- В логике отображения ошибок использовать `textContent`, а не HTML-строки.
- Сохранять текущее разделение: `engine` не должен содержать CSS/версточные детали.

## 10. Зависимости и запуск
- Сборщик не нужен, npm-зависимостей нет.
- Нужен только современный браузер.
- Для данных нужен валидный `Google Sheets API key` и `sheet id` в URL.
