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

    const wrap = document.createElement('div');
    wrap.className = 'dictation-input-wrap';

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

    const hint = document.createElement('div');
    hint.className = 'dictation-done-hint';
    hint.setAttribute('aria-live', 'polite');
    const hintText = document.createElement('span');
    hintText.className = 'dictation-done-hint-text';
    hintText.textContent = 'Parfait !';
    hintText.setAttribute('aria-hidden', 'true');
    hint.appendChild(hintText);

    wrap.append(input, doneCheck);
    row.append(wrap, hint);

    let wasComplete = false;

    const syncFromInput = () => {
        const target = card.dataset.t1 ?? '';
        const value = input.value;

        input.classList.remove('dictation-input--match', 'dictation-input--error', 'dictation-input--complete');
        doneCheck.classList.remove('dictation-done-check--visible');
        hint.classList.remove('dictation-done-hint--visible');
        hintText.setAttribute('aria-hidden', 'true');

        const complete = value === target;

        if (complete) {
            input.classList.add('dictation-input--match', 'dictation-input--complete');
            doneCheck.classList.add('dictation-done-check--visible');
            hint.classList.add('dictation-done-hint--visible');
            hintText.setAttribute('aria-hidden', 'false');

            if (!wasComplete) {
                wasComplete = true;
                queueMicrotask(() => {
                    window.DictationEngine?.playActiveCard?.();
                });
            }
            return;
        }

        wasComplete = false;

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
