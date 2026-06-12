/**
 * listenList.js — Вертикальный список карточек для режима Listen.
 *
 * Заменяет стек карточек на прокручиваемую ленту.
 * Позволяет выбрать активную карточку тапом и автоматически
 * прокручивает ленту к активной карточке при автоплее.
 */

import { createListenCard } from './components/listenCard.js';

/**
 * Рендерит или обновляет список карточек.
 *
 * @param {HTMLElement} container - Контейнер для списка (например, #card-stage)
 * @param {Array<{text1: string, text2: string, text3: string}>} deck - Массив карточек
 * @param {number} activeIndex - Индекс текущей активной карточки
 * @param {(index: number) => void} onCardClick - Колбэк при клике на карточку
 * @param {boolean} [autoScroll=false] - Прокручивать ли к активной карточке
 */
export function renderListenList(container, deck, activeIndex, onCardClick, autoScroll = false) {
    // Если контейнер пуст или изменился размер колоды, пересоздаем список
    const needsRebuild = container.children.length === 0 || container.children.length !== deck.length;

    if (needsRebuild) {
        container.innerHTML = '';
        container.className = 'listen-list-container';

        deck.forEach((data, index) => {
            const listItem = document.createElement('div');
            listItem.className = 'listen-list-item';
            listItem.dataset.index = index;

            // Создаем стандартную карточку
            const card = createListenCard(data);
            // Убираем классы анимации стека, так как это список
            card.classList.remove('card-next', 'card-active', 'animating');
            card.classList.add('listen-card-inner');

            // Добавляем маркер номера карточки
            const marker = document.createElement('div');
            marker.className = 'listen-card-marker';
            marker.textContent = `${index + 1}`;

            listItem.appendChild(marker);
            listItem.appendChild(card);

            listItem.addEventListener('click', (e) => {
                // Игнорируем клики по кнопке "глаз", чтобы не триггерить выбор карточки
                if (e.target.closest('.reveal-btn')) return;
                onCardClick(index);
            });

            container.appendChild(listItem);
        });
    }

    // Обновляем активное состояние и прокрутку
    updateActiveState(container, activeIndex, autoScroll);
}

/**
 * Обновляет визуальное состояние активной карточки и прокручивает к ней.
 *
 * @param {HTMLElement} container
 * @param {number} activeIndex
 * @param {boolean} autoScroll
 */
export function updateActiveState(container, activeIndex, autoScroll = false) {
    const items = container.querySelectorAll('.listen-list-item');
    
    items.forEach((item, index) => {
        const card = item.querySelector('.listen-card-inner');
        if (index === activeIndex) {
            item.classList.add('active');
            card.classList.add('active');
        } else {
            item.classList.remove('active');
            card.classList.remove('active');
        }
    });

    if (autoScroll && items[activeIndex]) {
        // Плавная прокрутка к центру активной карточки
        items[activeIndex].scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
}