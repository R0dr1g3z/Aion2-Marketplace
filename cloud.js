const STORAGE_KEY = 'aion2_market_v1';
const APP = window.APP_CONFIG || {};
const CLOUD = !!(APP.firebase && APP.firebase.apiKey && !String(APP.firebase.apiKey).startsWith('WKLEJ'));

function loadItems() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) { /* storage unavailable */ }
    return seedItems();
}
function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) { /* ignore */ }
}
function loadFavs() {
    try { return JSON.parse(localStorage.getItem('aion2_favs') || '[]'); } catch (e) { return []; }
}
function saveFavs() {
    try { localStorage.setItem('aion2_favs', JSON.stringify(items.filter(i => i.fav).map(i => i.id))); } catch (e) { /* ignore */ }
}
function cloudSave(item) { return CLOUD ? window.cloud.saveItem(item).catch(cloudFail) : persist(); }
function cloudDelete(id) { return CLOUD ? window.cloud.deleteItem(id).catch(cloudFail) : persist(); }
