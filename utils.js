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
function isoDaysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return localISO(d); }

const histKey = h => `${h.rawDate} ${h.time || '00:00'}`;
const entryTs = h => new Date(`${h.rawDate}T${h.time || '00:00'}`).getTime();
const sortHistory = arr => arr.sort((a, b) => histKey(a).localeCompare(histKey(b)));
const entryLabel = h => h.time ? `${h.date} ${h.time}` : h.date;

function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function calcLowest(history) {
    return history.reduce((min, h) => h.price < min ? h.price : min, history[0].price);
}
function sortByWeight(a, b) {
    const wA = a.weight !== undefined ? a.weight : 4;
    const wB = b.weight !== undefined ? b.weight : 4;
    if (wA !== wB) return wA - wB;
    return a.name.localeCompare(b.name);
}
