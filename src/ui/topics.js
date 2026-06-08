import { createTopicCard } from './components/topicCard.js';

/**
 * @param {Record<string, Array<{text1: string, text2: string}>>} appData
 * @param {{ onDeckClick: (name: string) => void, onDictationClick: (name: string) => void, onListenClick: (name: string) => void, onShuffleDeck: (name: string) => void }} callbacks
 */
export function renderTopics(appData, callbacks) {
    const grid = document.getElementById('topics-grid');
    grid.innerHTML = '';

    Object.keys(appData).forEach((name) => {
        const card = createTopicCard({
            name,
            cardsCount: appData[name].length,
            onDeckClick: callbacks.onDeckClick,
            onDictationClick: callbacks.onDictationClick,
            onListenClick: callbacks.onListenClick,
            onShuffleDeck: callbacks.onShuffleDeck
        });
        grid.appendChild(card);
    });
}
