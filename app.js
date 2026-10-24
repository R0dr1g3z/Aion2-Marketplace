const DEFAULT_ITEM_NAME = 'Radiant Odyle';
const STORAGE_KEY = 'aion2_market_v1';
const MONTHS = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];

function fmtDate(raw) {
    const [, m, d] = raw.split('-');
    return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}
function formatKinah(num) { return new Intl.NumberFormat('en-US').format(num); }
function pad2(n) { return String(n).padStart(2, '0'); }
function localISO(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function getTodayString() { return localISO(new Date()); }
function getNowTime() { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }

const histKey = h => `${h.rawDate} ${h.time || '00:00'}`;
const entryTs = h => new Date(`${h.rawDate}T${h.time || '00:00'}`).getTime();
const sortHistory = arr => arr.sort((a, b) => histKey(a).localeCompare(histKey(b)));
const entryLabel = h => h.time ? `${h.date} ${h.time}` : h.date;

function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function seed(id, name, category, salesList, price, prev) {
    const today = getTodayString();
    const history = [];
    if (prev) history.push({ rawDate: '2026-10-20', date: fmtDate('2026-10-20'), price: prev });
    history.push({ rawDate: today, date: fmtDate(today), price });
    const lowestPrice = history.reduce((min, h) => h.price < min ? h.price : min, history[0].price);
    return { id, name, category, salesList, lowestPrice, fav: false, history };
}

function loadItems() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) { /* storage unavailable */ }
    return [
        seed(1, 'Radiant Odyle', 'Materiały', 151, 240000, 260000),
        seed(2, 'Radiant Orichalcum Ore', 'Materiały', 39, 69988, 75000),
        seed(3, 'Radiant Asvata Log', 'Materiały', 35, 555555, 580000),
        seed(4, 'Radiant Sapphire Gemstone', 'Kamienie', 65, 121000, 132000),
        seed(5, 'Radiant Diamond Gemstone', 'Kamienie', 93, 66996, 72000),
        seed(6, 'Radiant Ruby Gemstone', 'Kamienie', 19, 49999, 56000)
    ];
}
function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) { /* ignore */ }
}

const APP = window.APP_CONFIG || {};
const CLOUD = !!(APP.firebase && APP.firebase.apiKey && !String(APP.firebase.apiKey).startsWith('WKLEJ'));
let canEdit = !CLOUD;
let currentUser = null;
let items = CLOUD ? [] : loadItems();
let selectedItemId = items.length ? items[0].id : null;
let pendingDeleteId = null;
let currentSearchQuery = '';
let chartInstance = null;
let currentCategory = 'Wszystkie';
let currentSub = null;
let expandedCat = null;

document.addEventListener('DOMContentLoaded', () => {
    // wykres się zmniejsza po zjechaniu w dół (dwa progi, żeby nie "mrugał" na granicy)
    let chartCompact = false;
    window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const should = chartCompact ? y > 60 : y > 160;
    if (should === chartCompact) return;
    chartCompact = should;
    document.getElementById('chartCard').classList.toggle('compact', should);
}, { passive: true });
    lucide.createIcons();
    fillCategorySelects();
    initRangeInputs();
    refreshAll(true);
    initCloud();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        if (!document.getElementById('confirmDeleteModal').classList.contains('hidden')) closeConfirmDeleteModal();
        else if (!document.getElementById('itemModal').classList.contains('hidden')) closeModal();
    }
});

function refreshAll(init = false) {
    updateKPIs();
    populateChartSelector();
    renderTable();
    if (init) initMainChart(); else updateChartData();
}

/* ---------- Trend + mini wykres (tabela) ---------- */

function getTrend(item) {
    const h = tableHistory(item);
    if (h.length < 2) return { pct: null, cls: 'text-slate-500', arrow: '', text: '—' };
    const first = h[0].price, cur = h[h.length - 1].price;
    if (first === 0 || cur === first) return { pct: 0, cls: 'text-slate-400', arrow: '→', text: '0%' };
    const pct = ((cur - first) / first) * 100;
    const up = pct > 0;
    return {
        pct,
        cls: up ? 'text-rose-400' : 'text-emerald-400',
        arrow: up ? '▲' : '▼',
        text: `${up ? '+' : ''}${pct.toFixed(1)}%`
    };
}

function sparkline(item, t) {
    // ta sama logika co wykres główny: 24h = surowe wpisy, dłużej = średnia dzienna
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

/* ---------- Okres ---------- */
let periodDays = 7; // 0 = cały okres
function isoDaysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return localISO(d); }
let periodRange = { from: isoDaysAgo(29), to: getTodayString() };

function periodHistory(item, days = periodDays, range = periodRange) {
    if (!item) return [];
    if (days === 'custom') return item.history.filter(h => h.rawDate >= range.from && h.rawDate <= range.to);
    if (!days) return item.history;
    let f;
    if (days === 1) {
        const from = Date.now() - 24 * 3600 * 1000; // ostatnie 24h
        f = item.history.filter(h => entryTs(h) >= from);
    } else {
        const fromStr = isoDaysAgo(days);
        f = item.history.filter(h => h.rawDate >= fromStr);
    }
    return f.length ? f : item.history.slice(-1);
}
function currentEntry(item) {
    return item.history[item.history.length - 1]; // historia posortowana, ostatni = najnowszy
}
function tableHistory(item) { return periodHistory(item); }
function periodLabel() {
    if (periodDays === 'custom') return `${fmtDate(periodRange.from)} – ${fmtDate(periodRange.to)}`;
    if (periodDays === 1) return 'ostatnie 24h';
    return periodDays ? `ostatnie ${periodDays} dni` : 'cały okres';
}


function toggleCustom(id, on) {
    const el = document.getElementById(id);
    el.classList.toggle('hidden', !on);
    el.classList.toggle('flex', on);
}
function setPeriod(v) {
    periodDays = v === 'custom' ? 'custom' : Number(v);
    toggleCustom('periodCustom', periodDays === 'custom');
    updateChartData();
    renderTable();
}
function setCustomRange() {
    const fromEl = document.getElementById('periodFrom'), toEl = document.getElementById('periodTo');
    let from = fromEl.value, to = toEl.value;
    if (!from || !to) return;
    if (from > to) { [from, to] = [to, from]; fromEl.value = from; toEl.value = to; }
    periodRange = { from, to };
    updateChartData();
    renderTable();
}
function initRangeInputs() {
    document.getElementById('periodFrom').value = periodRange.from;
    document.getElementById('periodTo').value = periodRange.to;
}

/* ---------- KPI (dla wybranego przedmiotu) ---------- */
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

/* ---------- Chart ---------- */
function populateChartSelector() {
    const select = document.getElementById('itemChartSelect');
    select.innerHTML = '';
    const list = getVisibleItems(false); // lista rozwijana: tylko kategoria, bez wyszukiwarki
    if (!list.length) {
        const opt = document.createElement('option');
        opt.textContent = 'Brak przedmiotów';
        opt.disabled = true;
        opt.selected = true;
        select.appendChild(opt);
        return;
    }
    list.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = item.name;
        opt.selected = item.id === selectedItemId;
        select.appendChild(opt);
    });
}

let chartPts = []; // punkty aktualnie widoczne na wykresie (używane też w tooltipie)

function buildChartPoints(hist, days = periodDays) {
    if (days === 1) {
        return hist.map(h => ({ label: entryLabel(h), avg: h.price, raw: true }));
    }
    const byDay = new Map();
    hist.forEach(h => {
        if (!byDay.has(h.rawDate)) byDay.set(h.rawDate, []);
        byDay.get(h.rawDate).push(h);
    });
    return [...byDay.values()].map(list => {
        const sum = list.reduce((s, h) => s + h.price, 0);
        const min = list.reduce((a, b) => b.price < a.price ? b : a);
        const max = list.reduce((a, b) => b.price > a.price ? b : a);
        return { label: list[0].date, avg: Math.round(sum / list.length), min, max, count: list.length };
    });
}

function applyChartData() {
    const item = items.find(i => i.id === selectedItemId);
    chartPts = buildChartPoints(item ? periodHistory(item) : []);
    chartInstance.data.labels = chartPts.map(p => p.label);
    chartInstance.data.datasets[0].data = chartPts.map(p => p.avg);
}

function initMainChart() {
    const ctx = document.getElementById('mainPriceChart').getContext('2d');
    const atTime = h => h.time ? ` (godz. ${h.time})` : '';
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Cena (Kinah)',
                data: [],
                borderColor: '#818cf8', borderWidth: 3,
                pointBackgroundColor: '#0f172a', pointBorderColor: '#fbbf24',
                pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6,
                fill: true, backgroundColor: 'rgba(99, 102, 241, 0.1)', tension: 0.35
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    displayColors: false,
                    callbacks: {
                        title: c => (chartPts[c[0].dataIndex] || {}).label || '',
                        label: c => {
                            const p = chartPts[c.dataIndex];
                            if (!p) return '';
                            if (p.raw) return `${formatKinah(p.avg)} Kinah`;
                            const lines = [
                            `Średnia: ${formatKinah(p.avg)} Kinah`,
                            `Min.: ${formatKinah(p.min.price)} Kinah${atTime(p.min)}`,
                            `Maks.: ${formatKinah(p.max.price)} Kinah${atTime(p.max)}`
                            ];
                            if (p.count > 1) lines.push(`Wpisów tego dnia: ${p.count}`);
                            return lines;
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.08)' } },
                y: { ticks: { color: '#94a3b8', callback: v => formatKinah(v) }, grid: { color: 'rgba(148,163,184,0.08)' } }
            }
        }
    });
    applyChartData();
    chartInstance.update();
}

function updateChartData() {
    if (!chartInstance) return;
    applyChartData();
    chartInstance.update();
    updateKPIs();
}
function selectItemForChart(id) {
    selectedItemId = id;
    document.getElementById('itemChartSelect').value = id;
    updateChartData();
    renderTable();
}

/* ---------- Sortowanie trend listy ---------- */
let sortKey = null;   // null = domyślne (waga → alfabetycznie)
let sortDir = 'desc'; // 'asc' | 'desc'

function sortValue(item, key) {
    const th = tableHistory(item);
    switch (key) {
        case 'current': return currentEntry(item).price;
        case 'low':     return th.length ? Math.min(...th.map(h => h.price)) : null;
        case 'high':    return th.length ? Math.max(...th.map(h => h.price)) : null;
        case 'trend':   return getTrend(item).pct; // null gdy brak danych
    }
}

// Kliknięcie: malejąco → rosnąco → powrót do domyślnego
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

function getVisibleItems(withSearch = true) {
    const q = withSearch ? currentSearchQuery.toLowerCase() : '';
    const useSort = withSearch && sortKey; // sortowanie kolumn tylko dla tabeli
    return items
        .filter(matchesFilter)
        .filter(i => i.name.toLowerCase().includes(q))
        .sort((a, b) => {
            // 1. Ulubione zawsze na górze
            if (b.fav !== a.fav) return b.fav - a.fav;

            // 2. Sortowanie po wybranej kolumnie
            if (useSort) {
                const va = sortValue(a, sortKey), vb = sortValue(b, sortKey);
                if (va === null && vb !== null) return 1;   // brak danych zawsze na końcu
                if (vb === null && va !== null) return -1;
                if (va !== vb) return sortDir === 'desc' ? vb - va : va - vb;
            }

            // 3. Domyślnie: waga, potem alfabetycznie
            const wA = a.weight !== undefined ? a.weight : 4;
            const wB = b.weight !== undefined ? b.weight : 4;
            if (wA !== wB) return wA - wB;
            return a.name.localeCompare(b.name);
        });
}

/* ---------- Table ---------- */
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
        const periodLowest = th.length ? th.reduce((min, h) => h.price < min ? h.price : min, th[0].price) : 0;
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

/* ---------- Delete ---------- */
function promptDeleteItem(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    pendingDeleteId = id;
    document.getElementById('confirmDeleteMessage').innerHTML =
        `Czy na pewno chcesz usunąć przedmiot <strong class="text-white">"${esc(item.name)}"</strong> z rynku?`;
    const modal = document.getElementById('confirmDeleteModal');
    const content = document.getElementById('confirmDeleteContent');
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);
}
function promptDeleteFromModal() {
    const id = Number(document.getElementById('formItemId').value);
    closeModal();
    if (id) setTimeout(() => promptDeleteItem(id), 220);
}
function closeConfirmDeleteModal() {
    const modal = document.getElementById('confirmDeleteModal');
    modal.classList.add('opacity-0');
    document.getElementById('confirmDeleteContent').classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); pendingDeleteId = null; }, 200);
}
function executeDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    const item = items.find(i => i.id === id);
    const name = item ? item.name : 'Przedmiot';
    items = items.filter(i => i.id !== id);
    if (selectedItemId === id) selectedItemId = items.length ? items[0].id : null;
    cloudDelete(id);
    closeConfirmDeleteModal();
    refreshAll();
    showToast('Usunięto z rynku', `Usunięto "${name}".`);
}

/* ---------- Add / Edit modal ---------- */
function showModal() {
    const modal = document.getElementById('itemModal');
    const content = document.getElementById('modalContent');
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);
}
function openAddModal() {
    document.getElementById('itemForm').reset();
    document.getElementById('formCategory').value = currentCategory !== 'Wszystkie' ? currentCategory : 'Inne';
    updateSubOptions(currentSub);
    document.getElementById('formItemId').value = '';
    document.getElementById('formDate').value = getTodayString();
    document.getElementById('formTime').value = getNowTime();
    document.getElementById('modalTitle').textContent = 'Dodaj nowy przedmiot';
    document.getElementById('modalDeleteBtn').classList.add('hidden');
    showModal();
}
function openEditModal(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    document.getElementById('formItemId').value = item.id;
    document.getElementById('formName').value = item.name;
    document.getElementById('formCategory').value = itemCategory(item);
    updateSubOptions(item.subCategory);
    document.getElementById('formSales').value = item.salesList;
    document.getElementById('formPrice').value = currentEntry(item).price;
    document.getElementById('formDate').value = getTodayString();
    document.getElementById('formTime').value = getNowTime();
    document.getElementById('formWeight').value = item.weight || 4;
    document.getElementById('modalTitle').textContent = 'Edytuj / zaktualizuj cenę';
    document.getElementById('modalDeleteBtn').classList.remove('hidden');
    showModal();
}

function saveItem(e) {
    e.preventDefault();
    const idVal = document.getElementById('formItemId').value;
    const name = document.getElementById('formName').value.trim();
    const category = document.getElementById('formCategory').value;
    const subCategory = document.getElementById('formSubCategory').value;
    const salesList = parseInt(document.getElementById('formSales').value, 10);
    const price = parseFloat(document.getElementById('formPrice').value);
    const rawDate = document.getElementById('formDate').value || getTodayString();
    const time = document.getElementById('formTime').value || getNowTime();
    const weight = parseInt(document.getElementById('formWeight').value, 10) || 4;

    if (!name || isNaN(salesList) || isNaN(price) || price < 0 || salesList < 0) {
        showToast('Błąd', 'Uzupełnij poprawnie wszystkie pola.');
        return;
    }

    let savedItem = null;
    if (idVal) {
        const item = items.find(i => i.id === Number(idVal));
        if (!item) return;
        item.name = name;
        item.category = category;
        item.subCategory = subCategory;
        item.salesList = salesList;
        item.weight = weight;
        const existing = item.history.find(h => h.rawDate === rawDate && (h.time || '') === time);
        if (existing) existing.price = price;
        else item.history.push({ rawDate, time, date: fmtDate(rawDate), price });
        sortHistory(item.history);
        item.lowestPrice = item.history.reduce((min, h) => h.price < min ? h.price : min, item.history[0].price);
        selectedItemId = item.id;
        savedItem = item;
        showToast('Zapisano zmiany', `Zaktualizowano ${name}.`);
    } else {
        const newItem = {
            id: Date.now(), name, category, subCategory, weight, salesList, lowestPrice: price, fav: false,
            history: [{ rawDate, time, date: fmtDate(rawDate), price }]
        };
        items.unshift(newItem);
        selectedItemId = newItem.id;
        savedItem = newItem;
        showToast('Dodano przedmiot', `Pomyślnie dodano ${name}.`);
    }
    cloudSave(savedItem);
    refreshAll();
    closeModal();
}

function closeModal() {
    const modal = document.getElementById('itemModal');
    modal.classList.add('opacity-0');
    document.getElementById('modalContent').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 200);
}

/* ---------- Toast / filters ---------- */
let toastTimer = null;
function showToast(title, message) {
    const toast = document.getElementById('toast');
    document.getElementById('toastTitle').textContent = title;
    document.getElementById('toastMessage').textContent = message;
    toast.classList.remove('translate-y-20', 'opacity-0');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3000);
}

function handleSearch(val, inputEl) {
    currentSearchQuery = val;
    renderTable();
    renderSearchResults(val, inputEl);
}

function renderSearchResults(val, inputEl) {
    // zamknij wszystkie listy, otwórz tylko tę przy aktywnym polu
    document.querySelectorAll('.search-results').forEach(b => b.classList.add('hidden'));
    if (!inputEl) return;
    const box = inputEl.closest('.search-box').querySelector('.search-results');
    const q = val.trim().toLowerCase();
    if (!q) { box.innerHTML = ''; return; }

    const matches = items
        .filter(i => i.name.toLowerCase().includes(q))
        .sort((a, b) => {
            const wA = a.weight !== undefined ? a.weight : 4;
            const wB = b.weight !== undefined ? b.weight : 4;
            if (wA !== wB) return wA - wB;
            return a.name.localeCompare(b.name);
        });

    if (!matches.length) {
        box.innerHTML = '<p class="px-3 py-3 text-sm text-slate-500">Brak wyników</p>';
    } else {
        box.innerHTML = matches.map(i => {
            const cur = currentEntry(i);
            return `<button type="button" onclick="pickSearchResult(${i.id})" class="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left hover:bg-slate-800/70 transition-colors">
                <span class="min-w-0">
                    <span class="block text-sm font-semibold text-slate-100 truncate">${esc(i.name)}</span>
                    <span class="block text-[11px] text-slate-500 truncate">${esc(i.subCategory || 'Miscellaneous')}</span>
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
    document.querySelectorAll('.search-results').forEach(b => b.classList.add('hidden'));
}

// zamykanie listy: klik poza wyszukiwarką i Escape
document.addEventListener('click', e => {
    if (!e.target.closest('.search-box'))
        document.querySelectorAll('.search-results').forEach(b => b.classList.add('hidden'));
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape')
        document.querySelectorAll('.search-results').forEach(b => b.classList.add('hidden'));
});

const CATEGORIES = [
    { key: 'Inne', label: 'Inne', icon: 'folder', subs: ['Gathering Material', 'Crafting Material', 'Substance Morphing', 'Special Materials', 'Miscellaneous'] },
    { key: 'Bronie', label: 'Bronie', icon: 'swords', subs: ['Longsword', 'Greatsword', 'Dagger', 'Bow', 'Spellbook', 'Orb', 'Mace', 'Staff', 'Guard'] },
    { key: 'Zbroje', label: 'Zbroje', icon: 'shield', subs: ['Helm', 'Pauldrons', 'Top', 'Legs', 'Gloves', 'Shoes', 'Cloak'] },
    { key: 'Akcesoria', label: 'Akcesoria', icon: 'gem', subs: ['Necklace', 'Earrings', 'Ring', 'Bracelet'] },
    { key: 'Consumables', label: 'Consumables', icon: 'flask-conical', subs: ['Potions', 'Food', 'Scroll', 'Candy', 'Manastone/Soulstone', 'Theostone', 'Wings', 'Pantheon', 'Duration Ticket', 'Chest', 'Miscellaneous'] },
    { key: 'Skiny', label: 'Skiny', icon: 'shirt', subs: ['Armor', 'Decoration'] }
];

// stare przedmioty z nieznaną kategorią (np. "Materiały") trafiają do "Inne"
function itemCategory(i) { return CATEGORIES.some(c => c.key === i.category) ? i.category : 'Inne'; }
function itemSub(i) { return i.subCategory || 'Miscellaneous'; }
function matchesFilter(i) {
    if (currentCategory === 'Wszystkie') return true;
    if (itemCategory(i) !== currentCategory) return false;
    return !currentSub || itemSub(i) === currentSub;
}

function updateSubOptions(selected) {
    const cat = CATEGORIES.find(c => c.key === document.getElementById('formCategory').value) || CATEGORIES[0];
    const sel = document.getElementById('formSubCategory');
    sel.innerHTML = cat.subs.map(s => `<option value="${s}">${s}</option>`).join('');
    if (selected && cat.subs.includes(selected)) sel.value = selected;
}
function fillCategorySelects() {
    document.getElementById('formCategory').innerHTML =
        CATEGORIES.map(c => `<option value="${c.key}">${c.label}</option>`).join('');
    updateSubOptions();
}

function renderCategories() {
    const list = document.getElementById('categoryList');
    if (!list) return;
    const btnCls = a => a ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent';
    const badgeCls = a => a ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500';

    const mainRow = (onclick, icon, label, count, active) => `
        <button onclick="${onclick}" class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${btnCls(active)}">
            <i data-lucide="${icon}" class="w-4 h-4 flex-shrink-0 ${active ? 'text-indigo-400' : ''}"></i>
            <span class="truncate">${label}</span>
            <span class="ml-auto text-[11px] px-1.5 py-0.5 rounded-md ${badgeCls(active)}">${count}</span>
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
                        <span class="ml-auto text-[10px] px-1.5 rounded ${badgeCls(a)}">${n}</span>
                    </button>`;
                }).join('') + `</div>`;
        }
        html += `</div>`;
    });

    list.innerHTML = html;
    lucide.createIcons();
}

// klik w kategorię: filtruje całą kategorię i rozwija/zwija podkategorie
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

/* ---------- Eksport / Import ---------- */
function exportData() {
    const payload = { app: 'aion2-market', version: 1, exportedAt: new Date().toISOString(), items };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aion2-market-${getTodayString()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Wyeksportowano', `Zapisano ${items.length} przedmiotów do pliku JSON.`);
}

function normalizeImported(raw) {
    const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.items) ? raw.items : null);
    if (!list) throw new Error('Nieprawidłowy format pliku.');
    const usedIds = new Set();
    return list.map((it, idx) => {
        if (!it || typeof it.name !== 'string' || !Array.isArray(it.history) || !it.history.length)
            throw new Error(`Błędny wpis nr ${idx + 1}.`);
        const history = sortHistory(it.history.map(h => {
            const price = Number(h.price);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(h.rawDate || '') || !isFinite(price))
                throw new Error(`Błędna historia ceny w "${it.name}".`);
            const time = /^\d{2}:\d{2}$/.test(h.time || '') ? h.time : '';
            return { rawDate: h.rawDate, time, date: fmtDate(h.rawDate), price };
        }));
        let id = Number(it.id);
        if (!isFinite(id) || usedIds.has(id)) id = Date.now() + idx;
        usedIds.add(id);
        const lowestPrice = history.reduce((min, h) => h.price < min ? h.price : min, history[0].price);
        const cat = CATEGORIES.some(c => c.key === it.category) ? it.category : 'Inne';
        const subs = CATEGORIES.find(c => c.key === cat).subs;
        return {
            id,
            name: it.name.trim() || 'Bez nazwy',
            category: cat,
            subCategory: subs.includes(it.subCategory) ? it.subCategory : (subs.includes('Miscellaneous') ? 'Miscellaneous' : subs[0]),
            weight: parseInt(it.weight, 10) || 4,
            salesList: Math.max(0, parseInt(it.salesList, 10) || 0),
            lowestPrice,
            fav: !!it.fav,
            history
        };
    });
}

function importData(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const imported = normalizeImported(JSON.parse(reader.result));
            if (!confirm(`Aktualizować i dodać ${imported.length} przedmiotów z pliku?\nIstniejące przedmioty zostaną zaktualizowane, a reszta pozostanie bez zmian.`)) return;

            const itemMap = new Map(items.map(i => [i.name.toLowerCase(), i]));

            imported.forEach(newItem => {
                const key = newItem.name.toLowerCase();
                if (itemMap.has(key)) {
                    const existing = itemMap.get(key);
                    existing.salesList = newItem.salesList;
                    newItem.history.forEach(newH => {
                        const hIdx = existing.history.findIndex(h => h.rawDate === newH.rawDate && (h.time || '') === (newH.time || ''));
                        if (hIdx >= 0) existing.history[hIdx].price = newH.price;
                        else existing.history.push(newH);
                    });
                    sortHistory(existing.history);
                    existing.lowestPrice = existing.history.reduce((min, h) => h.price < min ? h.price : min, existing.history[0].price);
                    cloudSave(existing);
                } else {
                    items.push(newItem);
                    cloudSave(newItem);
                }
            });

            selectedItemId = items.length ? items[0].id : null;
            refreshAll();
            showToast('Zaimportowano', 'Zaktualizowano rynek na podstawie pliku.');
        } catch (err) {
            showToast('Błąd importu', err.message || 'Nie udało się odczytać pliku.');
        }
    };
    reader.onerror = () => showToast('Błąd importu', 'Nie udało się odczytać pliku.');
    reader.readAsText(file);
}
/* ---------- Wspólna baza (Firebase Firestore) ---------- */
function loadFavs() {
    try { return JSON.parse(localStorage.getItem('aion2_favs') || '[]'); } catch (e) { return []; }
}
function saveFavs() {
    try { localStorage.setItem('aion2_favs', JSON.stringify(items.filter(i => i.fav).map(i => i.id))); } catch (e) { /* ignore */ }
}
function cloudFail(e) {
    console.error(e);
    showToast('Błąd zapisu', 'Brak uprawnień lub połączenia z bazą.');
}
function cloudSave(item) { return CLOUD ? window.cloud.saveItem(item).catch(cloudFail) : persist(); }
function cloudDelete(id) { return CLOUD ? window.cloud.deleteItem(id).catch(cloudFail) : persist(); }
function cloudReplaceAll(list) { return CLOUD ? window.cloud.replaceAll(list).catch(cloudFail) : persist(); }

const AUTH_BTN_GUEST = 'flex items-center gap-2 px-3 h-9 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-all';
const AUTH_BTN_USER = 'flex items-center gap-2 pl-1 pr-3 h-9 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-all';

function updateAuthButton() {
    const b = document.getElementById('authBtn');
    if (!b) return;
    document.getElementById('userMenu').classList.add('hidden');
    if (currentUser) {
        const name = currentUser.displayName || currentUser.email || 'Użytkownik';
        const initial = esc(name.trim().charAt(0).toUpperCase());
        const avatar = currentUser.photoURL
            ? `<img src="${esc(currentUser.photoURL)}" alt="" referrerpolicy="no-referrer" class="w-7 h-7 rounded-full object-cover border border-slate-600">`
            : `<span class="w-7 h-7 rounded-full bg-indigo-500/30 text-indigo-200 flex items-center justify-center text-xs font-bold">${initial}</span>`;
        b.className = AUTH_BTN_USER;
        b.innerHTML = `${avatar}<span class="hidden sm:inline max-w-[140px] truncate">${esc(name)}</span>`;
        b.title = 'Menu użytkownika';
        document.getElementById('userMenuInfo').textContent =
            `${currentUser.email || ''} — ${canEdit ? 'edycja włączona' : 'tylko odczyt'}`;
    } else {
        b.className = AUTH_BTN_GUEST;
        b.innerHTML = '<i data-lucide="log-in" class="w-4 h-4"></i><span class="hidden sm:inline">Zaloguj</span>';
        b.title = 'Zaloguj się, aby edytować';
    }
    lucide.createIcons();
}
function toggleAuth() {
    if (!window.cloud) return;
    if (currentUser) { document.getElementById('userMenu').classList.toggle('hidden'); return; }
    window.cloud.signIn().catch(() => showToast('Logowanie', 'Nie udało się zalogować.'));
}
function logout() {
    document.getElementById('userMenu').classList.add('hidden');
    if (window.cloud) window.cloud.signOut();
}
document.addEventListener('click', e => {
    const menu = document.getElementById('userMenu');
    if (menu && !menu.classList.contains('hidden') && !e.target.closest('#authWrap')) menu.classList.add('hidden');
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.getElementById('userMenu')?.classList.add('hidden');
});

function initCloud() {
    const btn = document.getElementById('authBtn');
    if (!CLOUD) { btn.classList.add('hidden'); return; }
    document.body.classList.add('read-only');
    if (!window.cloud) { showToast('Błąd', 'Nie udało się połączyć z Firebase.'); return; }
    window.cloud.onAuth(user => {
        currentUser = user;
        canEdit = !!(user && user.email && user.email.toLowerCase() === String(APP.ownerEmail || '').toLowerCase());
        document.body.classList.toggle('read-only', !canEdit);
        updateAuthButton();
    });
    window.cloud.onItems(list => {
        const favs = new Set(loadFavs());
        items = list.map(i => ({ ...i, fav: favs.has(i.id) })).sort((a, b) => a.name.localeCompare(b.name));
        if (!items.some(i => i.id === selectedItemId)) {
        const def = items.find(i => i.name.toLowerCase() === DEFAULT_ITEM_NAME.toLowerCase());
        selectedItemId = def ? def.id : ((getVisibleItems(false)[0] || {}).id ?? null);
        }
        refreshAll();
    }, () => showToast('Błąd bazy', 'Brak dostępu do danych (sprawdź reguły Firestore).'));
}
/* ---------- Przycisk "w górę" ---------- */
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.addEventListener('scroll', () => {
    const btn = document.getElementById('toTopBtn');
    if (btn) btn.classList.toggle('show', window.scrollY > 300);
}, { passive: true });