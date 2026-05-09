export function createTopicCard({ name, cardsCount, onDeckClick, onDictationClick }) {
    const card = document.createElement('div');
    card.className = 'topic-card';

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'topic-card-main';

    const title = document.createElement('strong');
    title.textContent = name;

    const meta = document.createElement('div');
    meta.className = 'topic-card-meta';
    meta.textContent = `${cardsCount} cards`;

    main.append(title, meta);
    main.addEventListener('click', () => onDeckClick(name));

    const dictBtn = document.createElement('button');
    dictBtn.type = 'button';
    dictBtn.className = 'topic-dict-btn';
    dictBtn.textContent = 'Dictation';
    dictBtn.title = 'Open dictation mode';
    dictBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        onDictationClick(name);
    });

    card.append(main, dictBtn);

    return card;
}
