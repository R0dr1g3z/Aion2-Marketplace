function handleSearch(val, inputEl) {
    currentSearchQuery = '';
    renderSearchResults(val, inputEl);
    const clr = inputEl && inputEl.closest('.search-box').querySelector('.search-clear');
    if (clr) clr.classList.toggle('hidden', !val);
}

function clearSearch(btn) {
    const input = btn.closest('.search-box').querySelector('input');
    input.value = '';
    handleSearch('', input);
    input.focus();
}

function hideSearchResults() {
    document.querySelectorAll('.search-results').forEach(b => b.classList.add('hidden'));
}

function renderSearchResults(val, inputEl) {
    hideSearchResults();
    if (!inputEl) return;
    const box = inputEl.closest('.search-box').querySelector('.search-results');
    const q = val.trim().toLowerCase();
    if (!q) { box.innerHTML = ''; return; }

    const matches = items.filter(i => i.name.toLowerCase().includes(q)).sort(sortByWeight);

    if (!matches.length) {
        box.innerHTML = '<p class="px-3 py-3 text-sm text-slate-400">Brak wyników</p>';
    } else {
        box.innerHTML = matches.map(i => {
            const cur = currentEntry(i);
            return `<button type="button" onclick="pickSearchResult(${i.id})" class="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left hover:bg-slate-800/70 transition-colors">
                <span class="min-w-0">
                    <span class="block text-sm font-semibold text-slate-100 truncate">${esc(i.name)}</span>
                    <span class="block text-xs text-slate-400 truncate">${esc(i.subCategory || 'Miscellaneous')}</span>
                </span>
                <span class="text-xs font-semibold text-amber-400 whitespace-nowrap">${formatKinah(cur.price)} Kinah</span>
            </button>`;
        }).join('');
    }
    box.classList.remove('hidden');
}

function pickSearchResult(id) {
    if (!getVisibleItems(false).some(i => i.id === id)) { currentCategory = 'Wszystkie'; currentSub = null; expandedCat = null; }
    selectedItemId = id;
    populateChartSelector();
    updateChartData();
    renderTable();
    hideSearchResults();
    const row = document.querySelector('#itemTableBody tr.row-selected');
    if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function renderCategories() {
    const list = document.getElementById('categoryList');
    if (!list) return;
    const btnCls = a => a ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent';
    const badgeCls = a => a ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-400';

    const mainRow = (onclick, icon, label, count, active) => `
        <button onclick="${onclick}" class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${btnCls(active)}">
            <i data-lucide="${icon}" class="w-4 h-4 flex-shrink-0 ${active ? 'text-indigo-400' : ''}"></i>
            <span class="truncate">${label}</span>
            <span class="ml-auto text-xs px-1.5 py-0.5 rounded-md ${badgeCls(active)}">${count}</span>
        </button>`;

    let html = mainRow("selectCategory('Wszystkie')", 'layout-grid', 'Wszystkie', items.length, currentCategory === 'Wszystkie');

    CATEGORIES.forEach(c => {
        const count = items.filter(i => itemCategory(i) === c.key).length;
        const active = currentCategory === c.key && !currentSub;
        html += `<div class="space-y-1 flex-shrink-0">` + mainRow(`selectCategory('${c.key}')`, c.icon, c.label, count, active);
        if (expandedCat === c.key) {
            html += `<div class="ml-3 pl-2 border-l border-slate-800 space-y-1 mt-1">` +
                c.subs.map(sub => {
                    const n = items.filter(i => itemCategory(i) === c.key && itemSub(i) === sub).length;
                    const a = currentCategory === c.key && currentSub === sub;
                    return `<button onclick="filterCategory('${c.key}', '${sub}')" class="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${a ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'}">
                        <span class="truncate">${sub}</span>
                        <span class="ml-auto text-xs px-1.5 rounded ${badgeCls(a)}">${n}</span>
                    </button>`;
                }).join('') + `</div>`;
        }
        html += `</div>`;
    });

    list.innerHTML = html;
    lucide.createIcons();
}

function selectCategory(cat) {
    if (cat === 'Wszystkie') expandedCat = null;
    else expandedCat = (expandedCat === cat && currentCategory === cat && !currentSub) ? null : cat;
    filterCategory(cat);
}

function filterCategory(cat, sub = null) {
    currentCategory = cat;
    currentSub = sub;
    const list = getVisibleItems(false);
    if (!list.some(i => i.id === selectedItemId)) {
        selectedItemId = list.length ? list[0].id : null;
    }
    populateChartSelector();
    updateChartData();
    renderTable();
}
