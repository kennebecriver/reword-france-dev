/**
 * Fisher–Yates in-place array shuffle.
 * Returns the same array; no-op for length < 2.
 */
export function shuffleArrayInPlace(arr) {
    if (!arr || arr.length < 2) return arr;
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Shuffle the source deck in `store.appData[deckName]` in-place.
 * This mutates the global appData; used by the topic-level shuffle action.
 */
export function shuffleTopicSourceDeck(store, deckName) {
    const deck = store.appData?.[deckName];
    if (!deck || deck.length < 2) return;
    shuffleArrayInPlace(deck);
}
