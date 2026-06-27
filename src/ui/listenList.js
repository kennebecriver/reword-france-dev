/**
 * listenList.js — Vertical list of cards for Listen mode.
 *
 * Replaces the stacked card UI with a scrollable list. Allows selecting the active
 * card by tap and automatically scrolls to the active card during autoplay.
 */

import { createListenCard } from './components/listenCard.js';

/**
 * Render or update the list of cards.
 *
 * @param {HTMLElement} container - Container for the list (e.g. #card-stage)
 * @param {Array<{text1: string, text2: string, text3: string}>} deck - Array of cards
 * @param {number} activeIndex - Index of the currently active card
 * @param {(index: number) => void} onCardClick - Callback when a list item is clicked
 * @param {boolean} [autoScroll=false] - Whether to auto-scroll to the active card
 * @param {(rowIndex: number) => void} [onDeleteCard] - Callback when delete button is clicked
 */
export function renderListenList(container, deck, activeIndex, onCardClick, autoScroll = false, onDeleteCard = null) {
    // If container is empty or deck size changed, rebuild the list
    const needsRebuild = container.children.length === 0 || container.children.length !== deck.length;

    if (needsRebuild) {
        container.innerHTML = '';
        container.className = 'listen-list-container';

        deck.forEach((data, index) => {
            const listItem = document.createElement('div');
            listItem.className = 'listen-list-item';
            listItem.dataset.index = index;

            // Create the standard card element
            const card = createListenCard(data);
            // Remove stack animation classes since this is a list
            card.classList.remove('card-next', 'card-active', 'animating');
            card.classList.add('listen-card-inner');

            // Add a marker showing the card number
            const marker = document.createElement('div');
            marker.className = 'listen-card-marker';
            marker.textContent = `${index + 1}`;

            listItem.appendChild(marker);
            listItem.appendChild(card);

            // Add delete button if callback provided
            if (onDeleteCard && data.rowIndex) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'listen-card-delete-btn';
                deleteBtn.type = 'button';
                deleteBtn.textContent = '❌';
                deleteBtn.title = 'Mark as deleted';
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isMarked = listItem.classList.toggle('marked-deleted');
                    deleteBtn.textContent = isMarked ? '↩' : '❌';
                    onDeleteCard(data.rowIndex, isMarked);
                });
                listItem.appendChild(deleteBtn);
            }

            listItem.addEventListener('click', (e) => {
                // Ignore clicks on the eye reveal button or delete button to avoid selecting the card
                if (e.target.closest('.reveal-btn') || e.target.closest('.listen-card-delete-btn')) return;
                onCardClick(index);
            });

            container.appendChild(listItem);
        });
    }

    // Update active state and scrolling
    updateActiveState(container, activeIndex, autoScroll);
}

/**
 * Update visual active state and optionally scroll to the active item.
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
        // Smooth scroll to center the active card
        items[activeIndex].scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
}