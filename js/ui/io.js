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

function importData(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const imported = normalizeImported(JSON.parse(reader.result));
            if (!confirm(`Aktualizować i dodać ${imported.length} przedmiotów z pliku?\nIstniejące przedmioty zostaną zaktualizowane, a reszta pozostanie bez zmian.`)) return;
            mergeImported(imported);
            refreshAll();
            showToast('Zaimportowano', 'Zaktualizowano rynek na podstawie pliku.');
        } catch (err) {
            showToast('Błąd importu', err.message || 'Nie udało się odczytać pliku.');
        }
    };
    reader.onerror = () => showToast('Błąd importu', 'Nie udało się odczytać pliku.');
    reader.readAsText(file);
}
