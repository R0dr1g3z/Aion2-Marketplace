const DEFAULT_ITEM_NAME = 'Radiant Odyle';
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
