// View router for the three full-screen sections.
export function showView(id) {
    document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
    document.getElementById(`view-${id}`).classList.add('active');
}
