function refreshAll(init = false) {
    updateKPIs();
    populateChartSelector();
    renderTable();
    if (init) initMainChart(); else updateChartData();
}

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

document.addEventListener('DOMContentLoaded', () => {
    initChartCompact();
    lucide.createIcons();
    fillCategorySelects();
    initRangeInputs();
    refreshAll(true);
    initCloud();
});

document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = id => !document.getElementById(id).classList.contains('hidden');
    if (open('confirmDeleteModal')) closeConfirmDeleteModal();
    else if (open('itemModal')) closeModal();
    hideSearchResults();
    document.getElementById('userMenu')?.classList.add('hidden');
});

document.addEventListener('click', e => {
    if (!e.target.closest('.search-box')) hideSearchResults();
    const menu = document.getElementById('userMenu');
    if (menu && !menu.classList.contains('hidden') && !e.target.closest('#authWrap')) menu.classList.add('hidden');
});

window.addEventListener('scroll', () => {
    const btn = document.getElementById('toTopBtn');
    if (btn) btn.classList.toggle('show', window.scrollY > 300);
}, { passive: true });
