# Architektura
Statyczna apka (HTML + Tailwind CDN). Skrypty klasyczne, wspólny scope globalny, bez bundlera. Kolejność ładowania = kolejność tagów `<script>` w `index.html`.

## Moduły (zależności w nawiasie)
- `config.js` – klucze Firebase, `ownerEmail`.
- `data/categories.js` – `CATEGORIES`.
- `data/seed.js` – dane startowe offline (utils).
- `js/core/utils.js` – daty, formatowanie, `esc`, `calcLowest`, `sortByWeight`.
- `js/core/cloud.js` – localStorage/Firestore: `APP`, `CLOUD`, `cloudSave/Delete`, ulubione (seed, `window.cloud`).
- `js/core/model.js` – stan globalny, historia, okres, trend, filtry, sortowanie, normalizacja i merge importu (utils, categories, cloud).
- `js/ui/sidebar.js` – kategorie i wyszukiwarka (model).
- `js/ui/table.js` – KPI, tabela, sparkline, sortowanie kolumn, ulubione (model).
- `js/ui/chart.js` – wykres Chart.js, wybór okresu (model).
- `js/ui/modals.js` – toast, formularz dodaj/edytuj, usuwanie (model, cloud).
- `js/ui/io.js` – eksport/import JSON (model, modals).
- `js/ui/auth.js` – logowanie Google, `initCloud` (cloud, model).
- `js/main.js` – `refreshAll`, init, globalne Escape/klik poza, przycisk „w górę” (ui/*).
- `firebase.js` – moduł ES, tworzy `window.cloud` (Firestore + Auth).
- `css/base.css`, `css/chart.css` – style.

## Zasady
- `data/` i `js/core/` bez DOM/GUI (wyjątek: `cloudFail` wołany z cloud.js jest w `ui/modals.js`).
- Jeden moduł na zmianę; otwieraj tylko plik, którego dotyczy zadanie.
- Nie otwieraj `data/*` ani `config.js`, chyba że zadanie dotyczy ich treści.
- Funkcje z `onclick` w HTML muszą pozostać globalne; nazwy publiczne bez zmian.
- Nowy plik JS = nowy tag w `index.html` + podbicie `?v=`.
