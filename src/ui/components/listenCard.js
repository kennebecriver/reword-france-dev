// Listen card: shows text2 upfront; text1 hidden under the eye (inverse of studyCard).
// dataset.t1/t2 match study/dictation so listenEngine TTS still reads phrase from t1.

/**
 * Create a Listen-mode card: shows the visible phrase and an eye button to reveal the hidden text (text1).
 */
export function createListenCard(data) {
    const card = document.createElement('div');
    card.className = 'card card-next';
    card.dataset.t1 = data.text1;
    card.dataset.t2 = data.text2;
    card.dataset.t3 = data.text3 ?? '';
    card.dataset.rowIndex = data.rowIndex ?? '';

    const body = document.createElement('div');
    body.className = 'card-body';

    const primaryEyeZone = document.createElement('div');
    primaryEyeZone.className = 'card-eye-zone card-eye-zone-primary';
    primaryEyeZone.style.display = 'none';

    const primaryRevealBtn = document.createElement('button');
    primaryRevealBtn.className = 'reveal-btn';
    primaryRevealBtn.type = 'button';
    primaryRevealBtn.textContent = '👁';
    primaryEyeZone.appendChild(primaryRevealBtn);

    const primaryText = document.createElement('div');
    primaryText.className = 'card-text-primary';
    primaryText.textContent = data.text2;

    const eyeZone = document.createElement('div');
    eyeZone.className = 'card-eye-zone';

    const revealBtn = document.createElement('button');
    revealBtn.className = 'reveal-btn';
    revealBtn.type = 'button';
    revealBtn.textContent = '👁';

    const secondaryText = document.createElement('div');
    secondaryText.className = 'card-text-secondary';
    secondaryText.textContent = data.text1;

    const extraText = document.createElement('div');
    extraText.className = 'card-text-extra';
    extraText.textContent = data.text3 ?? '';
    
    eyeZone.appendChild(revealBtn);
    body.append(primaryEyeZone, primaryText, eyeZone, secondaryText, extraText);
    card.appendChild(body);

    primaryRevealBtn.onpointerdown = (event) => event.stopPropagation();
    primaryRevealBtn.onclick = () => {
        primaryEyeZone.style.display = 'none';
        primaryText.style.display = 'block';
    };

    revealBtn.onpointerdown = (event) => event.stopPropagation();
    revealBtn.onclick = () => revealHiddenPhrase(card);

    return card;
}

export function revealHiddenPhrase(card) {
    const eyeZones = card.querySelectorAll('.card-eye-zone:not(.card-eye-zone-primary)');
    const secondaryText = card.querySelector('.card-text-secondary');
    const extraText = card.querySelector('.card-text-extra');

    eyeZones.forEach(ez => { if (ez) ez.style.display = 'none'; });
    if (secondaryText) secondaryText.style.display = 'block';
    if (extraText) extraText.style.display = 'block';
}
