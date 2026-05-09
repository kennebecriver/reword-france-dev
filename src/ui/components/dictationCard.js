// Dictation card: cue + typed answer vs dataset.t1 (same phrase as TTS / swipe).
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
    cue.textContent = data.text2;

    const row = document.createElement('div');
    row.className = 'dictation-input-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'dictation-input';
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.enterKeyHint = 'done';
    input.setAttribute('aria-label', 'Type the phrase');

    const doneCheck = document.createElement('span');
    doneCheck.className = 'dictation-done-check';
    doneCheck.textContent = '✓';
    doneCheck.setAttribute('aria-hidden', 'true');

    row.append(input, doneCheck);

    const syncFromInput = () => {
        const target = card.dataset.t1 ?? '';
        const value = input.value;

        input.classList.remove('dictation-input--match', 'dictation-input--error');
        doneCheck.classList.remove('dictation-done-check--visible');

        if (value === target) {
            input.classList.add('dictation-input--match');
            doneCheck.classList.add('dictation-done-check--visible');
            return;
        }

        if (target.startsWith(value)) {
            input.classList.add('dictation-input--match');
        } else {
            input.classList.add('dictation-input--error');
        }
    };

    input.addEventListener('input', syncFromInput);
    input.addEventListener('pointerdown', (e) => e.stopPropagation());

    body.append(label, cue, row);
    card.appendChild(body);

    syncFromInput();

    return card;
}
