function seed(id, name, category, salesList, price, prev) {
    const today = getTodayString();
    const history = [];
    if (prev) history.push({ rawDate: '2026-10-20', date: fmtDate('2026-10-20'), price: prev });
    history.push({ rawDate: today, date: fmtDate(today), price });
    return { id, name, category, salesList, lowestPrice: calcLowest(history), fav: false, history };
}

function seedItems() {
    return [
        seed(1, 'Radiant Odyle', 'Materiały', 151, 240000, 260000),
        seed(2, 'Radiant Orichalcum Ore', 'Materiały', 39, 69988, 75000),
        seed(3, 'Radiant Asvata Log', 'Materiały', 35, 555555, 580000),
        seed(4, 'Radiant Sapphire Gemstone', 'Kamienie', 65, 121000, 132000),
        seed(5, 'Radiant Diamond Gemstone', 'Kamienie', 93, 66996, 72000),
        seed(6, 'Radiant Ruby Gemstone', 'Kamienie', 19, 49999, 56000)
    ];
}
