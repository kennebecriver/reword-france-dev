/**
 * Create a topic card with main button to open the deck and action buttons: shuffle, dictation, and optionally listen.
 */
export function createTopicCard({ name, cardsCount, onDeckClick, onDictationClick, onListenClick, onShuffleDeck, onResetHistory }) {
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

    const actionButtons = [];

    if (name.startsWith('🎧')) {
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
        actionButtons.push(listenBtn);

        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'shuffle-btn topic-reset-btn';
        resetBtn.textContent = '↺';
        resetBtn.title = 'Reset listen history';
        resetBtn.setAttribute('aria-label', 'Reset listen history');
        resetBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
            if (onResetHistory) {
                onResetHistory(name);
                resetBtn.classList.add('shuffling');
                setTimeout(() => resetBtn.classList.remove('shuffling'), 200);
            }
        });
        actionButtons.push(resetBtn);
    }

    actionButtons.push(shuffleBtn, dictBtn);
    actions.append(...actionButtons);
    card.append(main, actions);

    return card;
}
