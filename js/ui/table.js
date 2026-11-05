function sparkline(item, t) {
    const prices = buildChartPoints(tableHistory(item), periodDays).map(p => p.avg);
    if (!prices.length) return '<span class="block text-center text-[11px] text-slate-600">brak danych</span>';
    const w = 110, h = 32, pad = 3;
    const min = Math.min(...prices), max = Math.max(...prices), range = max - min || 1;
    const pts = prices.map((p, i) => {
        const x = prices.length === 1 ? w / 2 : pad + i * (w - 2 * pad) / (prices.length - 1);
        const y = h - pad - ((p - min) / range) * (h - 2 * pad);
        return [x.toFixed(1), y.toFixed(1)];
    });
    const color = (t.pct === null || t.pct === 0) ? '#64748b' : (t.pct > 0 ? '#fb7185' : '#34d399');
    const last = pts[pts.length - 1];
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="mx-auto block" aria-hidden="true">
        <polyline points="${pts.map(q => q.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>
        <circle cx="${last[0]}" cy="${last[1]}" r="2.5" fill="${color}"/></svg>`;
}

function updateKPIs() {
    const set = (id, t) => document.getElementById(id).textContent = t;
    const item = items.find(i => i.id === selectedItemId);
    if (!item) {
        ['kpiCurrentPrice', 'kpiLowPrice', 'kpiHighPrice'].forEach(id => set(id, '—'));
        set('kpiSales', '0');
        ['kpiCurrentName', 'kpiLowName', 'kpiHighName', 'kpiSalesName'].forEach(id => set(id, 'Brak wybranego przedmiotu'));
        return;
    }
    const cur = currentEntry(item);
    set('kpiCurrentPrice', `${formatKinah(cur.price)} Kinah`);
    set('kpiCurrentName', cur.rawDate === getTodayString()
        ? `${item.name} · dziś${cur.time ? ' ' + cur.time : ''}`
        : `${item.name} · ostatni wpis ${entryLabel(cur)}`);

    const hist = periodHistory(item);
    if (hist.length) {
        const lo = hist.reduce((a, b) => b.price < a.price ? b : a);
        const hi = hist.reduce((a, b) => b.price > a.price ? b : a);
        set('kpiLowPrice', `${formatKinah(lo.price)} Kinah`);
        set('kpiLowName', `${entryLabel(lo)} · ${periodLabel()}`);
        set('kpiHighPrice', `${formatKinah(hi.price)} Kinah`);
        set('kpiHighName', `${entryLabel(hi)} · ${periodLabel()}`);
    } else {
        set('kpiLowPrice', '—'); set('kpiHighPrice', '—');
        set('kpiLowName', `Brak danych · ${periodLabel()}`);
        set('kpiHighName', `Brak danych · ${periodLabel()}`);
    }

    set('kpiSales', formatKinah(item.salesList));
    set('kpiSalesName', `${item.name} · ofert na rynku`);
}

// klik: malejąco → rosnąco → domyślne
function setSort(key) {
    if (sortKey !== key) { sortKey = key; sortDir = 'desc'; }
    else if (sortDir === 'desc') { sortDir = 'asc'; }
    else { sortKey = null; sortDir = 'desc'; }
    renderTable();
}

function updateSortIndicators() {
    document.querySelectorAll('.sort-btn').forEach(btn => {
        const active = btn.dataset.sort === sortKey;
        btn.classList.toggle('text-indigo-300', active);
        btn.querySelector('.sort-ind').textContent = active ? (sortDir === 'desc' ? '▼' : '▲') : '↕';
    });
}

function renderTable() {
    renderCategories();
    const tbody = document.getElementById('itemTableBody');
    tbody.innerHTML = '';
    const filtered = getVisibleItems(true);

    document.getElementById('emptyState').classList.toggle('hidden', filtered.length > 0);

    filtered.forEach(item => {
        const t = getTrend(item);
        const th = tableHistory(item);
        const highest = th.length ? th.reduce((a, b) => b.price > a.price ? b : a) : null;
        const periodLowest = th.length ? calcLowest(th) : 0;
        const tr = document.createElement('tr');
        tr.className = `hover:bg-slate-800/40 transition-colors cursor-pointer group ${item.id === selectedItemId ? 'bg-indigo-500/10 border-l-4 border-indigo-500' : ''}`;
        tr.onclick = () => selectItemForChart(item.id);
        tr.innerHTML = `
            <td class="py-3.5 px-4 text-center" onclick="event.stopPropagation(); toggleFav(${item.id})">
                <i data-lucide="star" class="w-4 h-4 mx-auto ${item.fav ? 'text-amber-400 fill-current' : 'text-slate-600 hover:text-amber-400'}"></i>
            </td>
            <td class="py-3.5 px-4 font-semibold text-slate-100">${esc(item.name)}</td>
            <td class="py-3.5 px-4 text-right font-semibold text-amber-400">${formatKinah(currentEntry(item).price)} Kinah</td>
            <td class="py-3.5 px-4 text-right font-semibold text-emerald-400">${formatKinah(periodLowest)} Kinah</td>
            <td class="py-3.5 px-4 text-right font-semibold text-rose-400">${highest ? formatKinah(highest.price) + ' Kinah' : '—'}</td>
            <td class="py-3.5 px-4 text-center text-xs font-semibold ${t.cls}">${t.arrow} ${t.text}</td>
            <td class="py-2 px-4">${sparkline(item, t)}</td>
            <td class="admin-only py-3.5 px-4 text-right whitespace-nowrap" onclick="event.stopPropagation()">
            <button onclick="openEditModal(${item.id})" title="Edytuj / zaktualizuj cenę" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10">
                <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
            <button onclick="promptDeleteItem(${item.id})" title="Usuń z rynku" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
            </td>`;
        tbody.appendChild(tr);
    });
    updateSortIndicators();
    lucide.createIcons();
}

function toggleFav(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    item.fav = !item.fav;
    if (CLOUD) saveFavs(); else persist();
    renderTable();
}
