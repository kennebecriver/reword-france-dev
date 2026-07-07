// Clones shared deck-screen markup into a `.view` root. Keeps layout in one `<template>` in index.html.

function qs(root, selector) {
    const node = root.querySelector(selector);
    if (!node) throw new Error(`deckShell: missing ${selector}`);
    return node;
}

function qso(root, selector) {
    return root.querySelector(selector);
}

/**
 * @param {HTMLElement} viewRoot - e.g. #view-deck
 * @param {{ idSuffix?: string, hideAutoPlay?: boolean, hideOnAir?: boolean }} [options]
 */
/**
 * Clone the shared deck screen template, assign suffixed IDs and return a set of DOM handles
 * used by engines and bootstrap.
 */
export function mountDeckShell(viewRoot, options = {}) {
    const tpl = document.getElementById('deck-shell-template');
    if (!tpl) throw new Error('deckShell: #deck-shell-template not found');

    const idSuffix = options.idSuffix ?? '';
    const withId = (base) => (idSuffix ? `${idSuffix}${base}` : base);

    /** @type {DocumentFragment | HTMLElement} */
    const fragOrNode = tpl.content.cloneNode(true);
    const deckRoot = qs(fragOrNode, '.deck-shell');

    const deckTitleEl = qs(deckRoot, '.deck-shell-title');
    const stage = qs(deckRoot, '.deck-card-stage');
    const deckCounterEl = qs(deckRoot, '.deck-shell-counter');
    const onairBtnEl = qs(deckRoot, '.deck-onair-btn');
    const onairFrBtnEl = qs(deckRoot, '.deck-onair-fr-btn');
    const playStatusEl = qs(deckRoot, '.deck-play-status');
    const autoPlayToggle = qs(deckRoot, '.deck-auto-play-toggle');
    const geminiToggle = qs(deckRoot, '.deck-gemini-toggle');
    const revealTogglesGroup = qso(deckRoot, '.reveal-toggles-group');
    const revealToggleWrapper = qso(deckRoot, '.deck-reveal-toggle-wrapper');
    const revealToggle = qso(deckRoot, '.deck-reveal-toggle');
    const revealToggleLabel = qso(deckRoot, '.deck-reveal-toggle-label');
    const revealPrimaryToggleWrapper = qso(deckRoot, '.deck-reveal-primary-toggle-wrapper');
    const revealPrimaryToggle = qso(deckRoot, '.deck-reveal-primary-toggle');
    const revealPrimaryToggleLabel = qso(deckRoot, '.deck-reveal-primary-toggle-label');
    const backBtn = qs(deckRoot, '.deck-back-btn');
    const doneBtn = qs(deckRoot, '.deck-btn-done');
    const playBtn = qs(deckRoot, '.deck-btn-play');
    const repeatBtn = qs(deckRoot, '.deck-btn-repeat');

    deckTitleEl.id = withId('deck-title');
    stage.id = withId('card-stage');
    deckCounterEl.id = withId('deck-counter');
    onairBtnEl.id = withId('onair-btn');
    onairFrBtnEl.id = withId('onair-fr-btn');
    playStatusEl.id = withId('play-status');
    autoPlayToggle.id = withId('auto-play-toggle');
    geminiToggle.id = withId('gemini-mode-toggle');

    viewRoot.innerHTML = '';
    viewRoot.appendChild(deckRoot);

    if (options.hideAutoPlay) {
        const autoplayLabel = autoPlayToggle.closest('label');
        const autoplayCaption = autoplayLabel?.nextElementSibling;
        if (autoplayLabel) autoplayLabel.style.display = 'none';
        if (autoplayCaption?.classList?.contains('toggle-label')) autoplayCaption.style.display = 'none';
        autoPlayToggle.disabled = true;
    }

    if (options.showRevealToggle) {
        if (revealTogglesGroup) revealTogglesGroup.style.display = '';
    }

    if (options.hideOnAir) {
        onairBtnEl.style.display = 'none';
        onairBtnEl.disabled = true;
        onairFrBtnEl.style.display = 'none';
        onairFrBtnEl.disabled = true;
    }

    return {
        root: deckRoot,
        stage,
        deckTitleEl,
        deckCounterEl,
        onairBtnEl,
        onairFrBtnEl,
        playStatusEl,
        autoPlayToggle,
        geminiToggle,
        revealToggle,
        revealPrimaryToggle,
        backBtn,
        doneBtn,
        playBtn,
        repeatBtn
    };
}
