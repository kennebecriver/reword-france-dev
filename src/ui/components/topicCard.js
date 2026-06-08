export function createTopicCard({ name, cardsCount, onDeckClick, onDictationClick, onListenClick, onShuffleDeck }) {
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

    const actions = document.createElement('div');
    actions.className = 'topic-card-actions';

    const shuffleBtn = document.createElement('button');
    shuffleBtn.type = 'button';
    shuffleBtn.className = 'shuffle-btn topic-topic-shuffle-btn';
    shuffleBtn.title = 'Shuffle deck';
    shuffleBtn.setAttribute('aria-label', 'Shuffle deck');
    shuffleBtn.textContent = '☠';
    shuffleBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        onShuffleDeck(name);
        shuffleBtn.classList.add('shuffling');
        setTimeout(() => shuffleBtn.classList.remove('shuffling'), 200);
    });

    const listenBtn = document.createElement('button');
    listenBtn.type = 'button';
    listenBtn.className = 'shuffle-btn topic-listen-btn';
    listenBtn.textContent = '🎧';
    listenBtn.title = 'Open listen mode';
    listenBtn.setAttribute('aria-label', 'Open listen mode');
    listenBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        onListenClick(name);
    });

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

    actions.append(shuffleBtn, listenBtn, dictBtn);
    card.append(main, actions);

    return card;
}
