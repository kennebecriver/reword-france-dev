// Topics/decks list rendering.
export function renderTopics(appData, onDeckClick) {
    const grid = document.getElementById('topics-grid');
    grid.innerHTML = '';

    Object.keys(appData).forEach((name) => {
        const div = document.createElement('div');
        div.className = 'topic-card';
        div.innerHTML = `<strong>${name}</strong><div style="color:var(--text-muted); font-size:0.8rem; margin-top:5px">${appData[name].length} cards</div>`;
        div.onclick = () => onDeckClick(name);
        grid.appendChild(div);
    });
}
