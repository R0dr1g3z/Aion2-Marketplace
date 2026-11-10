let chartPts = []; // punkty widoczne na wykresie (używane w tooltipie)

function populateChartSelector() {
    const select = document.getElementById('itemChartSelect');
    select.innerHTML = '';
    const list = getVisibleItems(false);
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

function applyChartData() {
    const item = items.find(i => i.id === selectedItemId);
    const cv = document.getElementById('mainPriceChart');
    if (cv) cv.setAttribute('aria-label', item ? `Wykres cen: ${item.name}, ${periodLabel()}` : 'Wykres cen');
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

// wykres się zmniejsza po zjechaniu w dół (dwa progi, bez "mrugania")
function initChartCompact() {
    let compact = false;
    window.addEventListener('scroll', () => {
        const y = window.scrollY;
        const should = compact ? y > 60 : y > 160;
        if (should === compact) return;
        compact = should;
        document.getElementById('chartCard').classList.toggle('compact', should);
    }, { passive: true });
}
