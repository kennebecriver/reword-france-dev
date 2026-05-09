import { createTopicCard } from './components/topicCard.js';

// Topics/decks list rendering.
export function renderTopics(appData, onDeckClick) {
    const grid = document.getElementById('topics-grid');
    grid.innerHTML = '';

    Object.keys(appData).forEach((name) => {
        const card = createTopicCard({
            name,
            cardsCount: appData[name].length,
            onClick: () => onDeckClick(name)
        });
        grid.appendChild(card);
    });
}
