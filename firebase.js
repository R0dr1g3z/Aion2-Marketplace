import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs }
    from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const cfg = (window.APP_CONFIG || {}).firebase;
if (cfg && cfg.apiKey && !String(cfg.apiKey).startsWith('WKLEJ')) {
    const app = initializeApp(cfg);
    const db = getFirestore(app);
    const auth = getAuth(app);
    const col = collection(db, 'items');
    const strip = ({ fav, ...data }) => data;
    window.cloud = {
        onItems: (cb, onErr) => onSnapshot(col, snap => cb(snap.docs.map(d => d.data())), onErr),
        saveItem: item => setDoc(doc(db, 'items', String(item.id)), strip(item)),
        deleteItem: id => deleteDoc(doc(db, 'items', String(id))),
        async replaceAll(list) {
            const existing = await getDocs(col);
            const keep = new Set(list.map(i => String(i.id)));
            const batch = writeBatch(db);
            existing.forEach(d => { if (!keep.has(d.id)) batch.delete(d.ref); });
            list.forEach(i => batch.set(doc(db, 'items', String(i.id)), strip(i)));
            return batch.commit();
        },
        onAuth: cb => onAuthStateChanged(auth, cb),
        signIn: () => signInWithPopup(auth, new GoogleAuthProvider()),
        signOut: () => signOut(auth)
    };
}
