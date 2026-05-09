// Fisher-Yates in place; safe on empty / single-element arrays.
export function shuffleArrayInPlace(arr) {
    if (!arr || arr.length < 2) return arr;
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/** Shuffles source deck for a topic before Study/Dictation — both modes copy from appData. */
export function shuffleTopicSourceDeck(store, deckName) {
    const deck = store.appData?.[deckName];
    if (!deck || deck.length < 2) return;
    shuffleArrayInPlace(deck);
}
