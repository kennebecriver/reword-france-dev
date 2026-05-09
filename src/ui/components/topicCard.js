export function createTopicCard({ name, cardsCount, onClick }) {
    const card = document.createElement('div');
    card.className = 'topic-card';

    const title = document.createElement('strong');
    title.textContent = name;

    const meta = document.createElement('div');
    meta.className = 'topic-card-meta';
    meta.textContent = `${cardsCount} cards`;

    card.append(title, meta);
    card.onclick = onClick;

    return card;
}
