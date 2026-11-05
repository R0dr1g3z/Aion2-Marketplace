let toastTimer = null;
function showToast(title, message) {
    const toast = document.getElementById('toast');
    document.getElementById('toastTitle').textContent = title;
    document.getElementById('toastMessage').textContent = message;
    toast.classList.remove('translate-y-20', 'opacity-0');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3000);
}

function cloudFail(e) {
    console.error(e);
    showToast('Błąd zapisu', 'Brak uprawnień lub połączenia z bazą.');
}

/* usuwanie */
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

/* formularz dodaj / edytuj */
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

function showModal() {
    const modal = document.getElementById('itemModal');
    const content = document.getElementById('modalContent');
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);
}
function closeModal() {
    const modal = document.getElementById('itemModal');
    modal.classList.add('opacity-0');
    document.getElementById('modalContent').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 200);
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
        item.lowestPrice = calcLowest(item.history);
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
