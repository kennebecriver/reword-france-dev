/**
 * Create a Study card DOM: displays `text1` and a button to reveal `text2`.
 */
export function createStudyCard(data) {
    const card = document.createElement('div');
    card.className = 'card card-next';
    card.dataset.t1 = data.text1;
    card.dataset.t2 = data.text2;
    card.dataset.t3 = data.text3 ?? '';

    const body = document.createElement('div');
    body.className = 'card-body';

    const primaryText = document.createElement('div');
    primaryText.className = 'card-text-primary';
    primaryText.textContent = data.text1;

    const eyeZone = document.createElement('div');
    eyeZone.className = 'card-eye-zone';

    const revealBtn = document.createElement('button');
    revealBtn.className = 'reveal-btn';
    revealBtn.type = 'button';
    revealBtn.textContent = '👁';

    const secondaryText = document.createElement('div');
    secondaryText.className = 'card-text-secondary';
    secondaryText.textContent = data.text2;

    eyeZone.appendChild(revealBtn);
    body.append(primaryText, eyeZone, secondaryText);
    card.appendChild(body);

    revealBtn.onpointerdown = (event) => event.stopPropagation();
    revealBtn.onclick = () => revealSecondaryText(card);

    return card;
}

function revealSecondaryText(card) {
    const eyeZone = card.querySelector('.card-eye-zone');
    const secondaryText = card.querySelector('.card-text-secondary');

    if (eyeZone) eyeZone.style.display = 'none';
    if (secondaryText) secondaryText.style.display = 'block';
}
