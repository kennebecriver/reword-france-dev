// Dictation card: cue + typed answer vs dataset.t1 (same phrase as TTS / swipe).

/** Lowercase + uppercase pairs for keyboards without French layout. */
const FRENCH_INSERT_CHARS = [
    'é', 'É', 'è', 'È', 'ê', 'Ê', 'à', 'À', 'â', 'Â', 'ç', 'Ç', 'î', 'Î',
    'ô', 'Ô', 'û', 'Û', 'ë', 'Ë', 'ï', 'Ï', 'ü', 'Ü', 'œ', 'Œ',
];

export function createDictationCard(data) {
    const card = document.createElement('div');
    card.className = 'card dictation-card card-next';
    card.dataset.t1 = data.text1;
    card.dataset.t2 = data.text2;
    card.dataset.t3 = data.text3 ?? '';

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

    const peekRow = document.createElement('div');
    peekRow.className = 'dictation-peek-row';

    const peekActions = document.createElement('div');
    peekActions.className = 'dictation-peek-actions';

    const peekWrap = document.createElement('div');
    peekWrap.className = 'dictation-peek-wrap';

    const peekBtn = document.createElement('button');
    peekBtn.type = 'button';
    peekBtn.className = 'dictation-peek-chip';
    peekBtn.textContent = 'HINT';
    peekBtn.title = 'Hover to peek at the expected phrase';
    peekBtn.addEventListener('pointerdown', (e) => e.stopPropagation());

    const peekBubble = document.createElement('div');
    peekBubble.className = 'dictation-peek-bubble';
    peekBubble.id = `dictation-peek-${Math.random().toString(36).slice(2, 9)}`;
    peekBubble.setAttribute('role', 'tooltip');
    peekBubble.textContent = data.text1;
    peekBtn.setAttribute('aria-describedby', peekBubble.id);

    peekWrap.append(peekBtn, peekBubble);

    const charsWrap = document.createElement('div');
    charsWrap.className = 'dictation-chars-wrap';

    const charsBtn = document.createElement('button');
    charsBtn.type = 'button';
    charsBtn.className = 'dictation-peek-chip dictation-chars-toggle';
    charsBtn.textContent = 'FR';
    charsBtn.title = 'French letters — click to insert at cursor';
    charsBtn.setAttribute('aria-haspopup', 'dialog');
    charsBtn.setAttribute('aria-expanded', 'false');
    charsBtn.addEventListener('pointerdown', (e) => e.stopPropagation());

    const charsPanel = document.createElement('div');
    charsPanel.className = 'dictation-chars-panel';
    charsPanel.setAttribute('role', 'dialog');
    charsPanel.setAttribute('aria-label', 'French characters');
    charsPanel.hidden = true;

    const charsGrid = document.createElement('div');
    charsGrid.className = 'dictation-chars-grid';

    for (const ch of FRENCH_INSERT_CHARS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'dictation-chars-cell';
        b.textContent = ch;
        b.title = `Insert ${ch}`;
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            input.focus();
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? start;
            if (typeof input.setRangeText === 'function') {
                input.setRangeText(ch, start, end, 'end');
            } else {
                input.value = input.value.slice(0, start) + ch + input.value.slice(end);
            }
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        charsGrid.appendChild(b);
    }

    charsPanel.appendChild(charsGrid);
    charsWrap.append(charsBtn, charsPanel);
    peekActions.append(peekWrap, charsWrap);
    peekRow.appendChild(peekActions);

    let charsOpen = false;

    const closeCharsPanel = () => {
        if (!charsOpen) return;
        charsOpen = false;
        charsPanel.classList.remove('dictation-chars-panel--open');
        charsPanel.hidden = true;
        charsBtn.setAttribute('aria-expanded', 'false');
        document.removeEventListener('click', onDocClickToCloseChars, true);
        document.removeEventListener('keydown', onDocKeydownChars, true);
    };

    const onDocClickToCloseChars = (e) => {
        const t = e.target;
        if (!(t instanceof Node)) return;
        if (charsWrap.contains(t) || charsPanel.contains(t)) return;
        const clickEl = t instanceof Element ? t : t.parentElement;
        if (clickEl?.closest?.('.toggle-wrapper')) return;
        closeCharsPanel();
    };

    const onDocKeydownChars = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeCharsPanel();
        }
    };

    charsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (charsOpen) {
            closeCharsPanel();
            return;
        }
        charsOpen = true;
        charsPanel.hidden = false;
        charsPanel.classList.add('dictation-chars-panel--open');
        charsBtn.setAttribute('aria-expanded', 'true');
        document.addEventListener('click', onDocClickToCloseChars, true);
        document.addEventListener('keydown', onDocKeydownChars, true);
    });

    const hint = document.createElement('div');
    hint.className = 'dictation-done-hint';
    hint.setAttribute('aria-live', 'polite');
    const hintText = document.createElement('span');
    hintText.className = 'dictation-done-hint-text';
    hintText.textContent = 'Parfait !';
    hintText.setAttribute('aria-hidden', 'true');
    hint.appendChild(hintText);

    wrap.append(input, doneCheck);
    row.append(wrap, peekRow, hint);

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
