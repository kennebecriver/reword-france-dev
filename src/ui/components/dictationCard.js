// Dictation-mode card DOM: structure differs from study cards; swipe engine still reads dataset.t1 / t2.
export function createDictationCard(data) {
    const card = document.createElement('div');
    card.className = 'card dictation-card card-next';
    card.dataset.t1 = data.text1;
    card.dataset.t2 = data.text2;

    const body = document.createElement('div');
    body.className = 'card-body dictation-card-body';

    const label = document.createElement('div');
    label.className = 'dictation-card-label';
    label.textContent = 'Dictation';

    const cue = document.createElement('div');
    cue.className = 'dictation-card-cue';
    cue.textContent = data.text1;

    body.append(label, cue);
    card.appendChild(body);

    return card;
}
