// Listen card: shows text2 upfront; text1 hidden under the eye (inverse of studyCard).
// dataset.t1/t2 match study/dictation so listenEngine TTS still reads phrase from t1.

export function createListenCard(data) {
    const card = document.createElement('div');
    card.className = 'card card-next';
    card.dataset.t1 = data.text1;
    card.dataset.t2 = data.text2;

    const body = document.createElement('div');
    body.className = 'card-body';

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

    eyeZone.appendChild(revealBtn);
    body.append(primaryText, eyeZone, secondaryText);
    card.appendChild(body);

    revealBtn.onpointerdown = (event) => event.stopPropagation();
    revealBtn.onclick = () => revealHiddenPhrase(card);

    return card;
}

function revealHiddenPhrase(card) {
    const eyeZone = card.querySelector('.card-eye-zone');
    const secondaryText = card.querySelector('.card-text-secondary');

    if (eyeZone) eyeZone.style.display = 'none';
    if (secondaryText) secondaryText.style.display = 'block';
}
