// View router for the three full-screen sections.
/**
 * Toggle visibility of SPA sections: remove `.active` from all `.view` elements and
 * set `.active` on `#view-${id}`.
 */
export function showView(id) {
    document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
    document.getElementById(`view-${id}`).classList.add('active');
}
