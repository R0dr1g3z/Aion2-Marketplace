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
let periodDays = 7; // 0 = cały okres
let periodRange = { from: isoDaysAgo(29), to: getTodayString() };
let sortKey = null;   // null = domyślne (waga → alfabetycznie)
let sortDir = 'desc';

/* kategorie */
function itemCategory(i) { return CATEGORIES.some(c => c.key === i.category) ? i.category : 'Inne'; }
function itemSub(i) { return i.subCategory || 'Miscellaneous'; }
function matchesFilter(i) {
    if (currentCategory === 'Wszystkie') return true;
    if (itemCategory(i) !== currentCategory) return false;
    return !currentSub || itemSub(i) === currentSub;
}

/* historia / okres */
function periodHistory(item, days = periodDays, range = periodRange) {
    if (!item) return [];
    if (days === 'custom') return item.history.filter(h => h.rawDate >= range.from && h.rawDate <= range.to);
    if (!days) return item.history;
    let f;
    if (days === 1) {
        const from = Date.now() - 24 * 3600 * 1000;
        f = item.history.filter(h => entryTs(h) >= from);
    } else {
        const fromStr = isoDaysAgo(days);
        f = item.history.filter(h => h.rawDate >= fromStr);
    }
    return f.length ? f : item.history.slice(-1);
}
function currentEntry(item) { return item.history[item.history.length - 1]; }
function tableHistory(item) { return periodHistory(item); }
function periodLabel() {
    if (periodDays === 'custom') return `${fmtDate(periodRange.from)} – ${fmtDate(periodRange.to)}`;
    if (periodDays === 1) return 'ostatnie 24h';
    return periodDays ? `ostatnie ${periodDays} dni` : 'cały okres';
}

function getTrend(item) {
    const h = tableHistory(item);
    if (h.length < 2) return { pct: null, cls: 'text-slate-400', arrow: '', text: '—' };
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

// 24h = surowe wpisy, dłużej = średnia dzienna
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

/* sortowanie / lista */
function sortValue(item, key) {
    const th = tableHistory(item);
    switch (key) {
        case 'current': return currentEntry(item).price;
        case 'low':     return th.length ? Math.min(...th.map(h => h.price)) : null;
        case 'high':    return th.length ? Math.max(...th.map(h => h.price)) : null;
        case 'trend':   return getTrend(item).pct;
    }
}

function getVisibleItems(withSearch = true) {
    const q = withSearch ? currentSearchQuery.toLowerCase() : '';
    const useSort = withSearch && sortKey;
    return items
        .filter(matchesFilter)
        .filter(i => i.name.toLowerCase().includes(q))
        .sort((a, b) => {
            if (b.fav !== a.fav) return b.fav - a.fav;
            if (useSort) {
                const va = sortValue(a, sortKey), vb = sortValue(b, sortKey);
                if (va === null && vb !== null) return 1;
                if (vb === null && va !== null) return -1;
                if (va !== vb) return sortDir === 'desc' ? vb - va : va - vb;
            }
            return sortByWeight(a, b);
        });
}

/* import */
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
        const cat = CATEGORIES.some(c => c.key === it.category) ? it.category : 'Inne';
        const subs = CATEGORIES.find(c => c.key === cat).subs;
        return {
            id,
            name: it.name.trim() || 'Bez nazwy',
            category: cat,
            subCategory: subs.includes(it.subCategory) ? it.subCategory : (subs.includes('Miscellaneous') ? 'Miscellaneous' : subs[0]),
            weight: parseInt(it.weight, 10) || 4,
            salesList: Math.max(0, parseInt(it.salesList, 10) || 0),
            lowestPrice: calcLowest(history),
            fav: !!it.fav,
            history
        };
    });
}

function mergeImported(imported) {
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
            existing.lowestPrice = calcLowest(existing.history);
            cloudSave(existing);
        } else {
            items.push(newItem);
            cloudSave(newItem);
        }
    });
    selectedItemId = items.length ? items[0].id : null;
}
