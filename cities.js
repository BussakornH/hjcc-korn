/* SENTINEL key cities. t1: fifteen cities that decided the Hundred Years' War [name, lat, lon, label side].
   t2: the five largest cities of every country in the First World War, first one is the capital or main city.
   bloc L = Allied Powers, R = Central Powers. Shared by the topic maps and the battle map. */
window.SENTINEL_CITIES = {
  t1: [
    ["London", 51.51, -0.13, "t"], ["Calais", 50.95, 1.86, "r"], ["Harfleur", 49.51, 0.20, "l"], ["Rouen", 49.44, 1.10, "t"], ["Caen", 49.18, -0.37, "l"],
    ["Paris", 48.86, 2.35, "r"], ["Reims", 49.26, 4.03, "r"], ["Troyes", 48.30, 4.08, "r"], ["Orléans", 47.90, 1.91, "l"], ["Tours", 47.39, 0.69, "l"],
    ["Poitiers", 46.58, 0.34, "l"], ["Bordeaux", 44.84, -0.58, "l"], ["Bourges", 47.08, 2.40, "r"], ["Dijon", 47.32, 5.04, "r"], ["Avignon", 43.95, 4.81, "r"],
    /* the rest of the board, on neutral and allied ground; shown on the battle map only (index 15 on) */
    ["Rennes", 48.11, -1.68, "l"], ["Nantes", 47.22, -1.55, "l"], ["Le Mans", 48.01, 0.20, "r"], ["Bruges", 51.21, 3.22, "r"], ["Brussels", 50.85, 4.35, "r"],
    ["Cologne", 50.94, 6.96, "r"], ["Strasbourg", 48.57, 7.75, "r"], ["Basel", 47.56, 7.59, "r"], ["Geneva", 46.20, 6.14, "r"], ["Lyon", 45.76, 4.84, "r"],
    ["Marseille", 43.30, 5.37, "r"], ["Genoa", 44.41, 8.93, "r"], ["Turin", 45.07, 7.69, "r"], ["Milan", 45.46, 9.19, "r"], ["Pamplona", 42.82, -1.64, "r"],
    ["Burgos", 42.34, -3.70, "r"], ["Santander", 43.46, -3.81, "r"], ["San Sebastián", 43.32, -1.98, "r"]
  ],
  t2: [
    { country: "United Kingdom", bloc: "L", cities: [["London", 51.51, -0.13], ["Birmingham", 52.48, -1.90], ["Manchester", 53.48, -2.24], ["Liverpool", 53.41, -2.98], ["Glasgow", 55.86, -4.25]] },
    { country: "France", bloc: "L", cities: [["Paris", 48.86, 2.35], ["Marseille", 43.30, 5.37], ["Lyon", 45.76, 4.84], ["Bordeaux", 44.84, -0.58], ["Lille", 50.63, 3.06]] },
    { country: "Russian Empire", bloc: "L", cities: [["Moscow", 55.76, 37.62], ["St Petersburg", 59.93, 30.34], ["Warsaw", 52.23, 21.01], ["Kiev", 50.45, 30.52], ["Odessa", 46.48, 30.73]] },
    { country: "Italy", bloc: "L", cities: [["Rome", 41.90, 12.50], ["Milan", 45.46, 9.19], ["Naples", 40.85, 14.27], ["Turin", 45.07, 7.69], ["Genoa", 44.41, 8.93]] },
    { country: "Belgium", bloc: "L", cities: [["Brussels", 50.85, 4.35], ["Antwerp", 51.22, 4.40], ["Ghent", 51.05, 3.72], ["Liège", 50.63, 5.57], ["Charleroi", 50.41, 4.44]] },
    { country: "Serbia", bloc: "L", cities: [["Belgrade", 44.79, 20.45], ["Niš", 43.32, 21.90], ["Kragujevac", 44.01, 20.91], ["Šabac", 44.75, 19.69], ["Valjevo", 44.27, 19.89]] },
    { country: "Romania", bloc: "L", cities: [["Bucharest", 44.43, 26.10], ["Iași", 47.16, 27.59], ["Galați", 45.44, 28.05], ["Brăila", 45.27, 27.97], ["Ploiești", 44.94, 26.03]] },
    { country: "Greece", bloc: "L", cities: [["Athens", 37.98, 23.73], ["Thessaloniki", 40.64, 22.94], ["Piraeus", 37.94, 23.65], ["Patras", 38.25, 21.73], ["Larissa", 39.64, 22.42]] },
    { country: "German Empire", bloc: "R", cities: [["Berlin", 52.52, 13.40], ["Hamburg", 53.55, 9.99], ["Munich", 48.14, 11.58], ["Cologne", 50.94, 6.96], ["Leipzig", 51.34, 12.37]] },
    { country: "Austria-Hungary", bloc: "R", cities: [["Vienna", 48.21, 16.37], ["Budapest", 47.50, 19.04], ["Prague", 50.08, 14.44], ["Trieste", 45.65, 13.78], ["Lemberg", 49.84, 24.03]] },
    { country: "Ottoman Empire", bloc: "R", cities: [["Constantinople", 41.01, 28.98], ["Smyrna", 38.42, 27.14], ["Baghdad", 33.31, 44.37], ["Damascus", 33.51, 36.29], ["Aleppo", 36.20, 37.16]] },
    { country: "Bulgaria", bloc: "R", cities: [["Sofia", 42.70, 23.32], ["Plovdiv", 42.15, 24.75], ["Varna", 43.21, 27.91], ["Ruse", 43.85, 25.97], ["Burgas", 42.50, 27.47]] },
    { country: "Montenegro", bloc: "L", cities: [["Cetinje", 42.39, 18.92], ["Podgorica", 42.44, 19.26], ["Nikšić", 42.77, 18.94], ["Bar", 42.09, 19.10], ["Kotor", 42.42, 18.77]] },
    /* neutral ground: the chairs can give any of these cities to a side */
    { country: "Netherlands", bloc: "N", cities: [["Amsterdam", 52.37, 4.90], ["Rotterdam", 51.92, 4.48], ["The Hague", 52.08, 4.31], ["Utrecht", 52.09, 5.12], ["Groningen", 53.22, 6.57]] },
    { country: "Spain", bloc: "N", cities: [["Madrid", 40.42, -3.70], ["Barcelona", 41.39, 2.17], ["Valencia", 39.47, -0.38], ["Seville", 37.39, -5.99], ["Zaragoza", 41.65, -0.89]] },
    { country: "Portugal", bloc: "N", cities: [["Lisbon", 38.72, -9.14], ["Porto", 41.15, -8.61], ["Braga", 41.55, -8.43], ["Coimbra", 40.21, -8.43], ["Setúbal", 38.52, -8.89]] },
    { country: "Switzerland", bloc: "N", cities: [["Zürich", 47.38, 8.54], ["Geneva", 46.20, 6.14], ["Basel", 47.56, 7.59], ["Bern", 46.95, 7.45], ["Lausanne", 46.52, 6.63]] },
    { country: "Luxembourg", bloc: "N", cities: [["Luxembourg", 49.61, 6.13], ["Esch-sur-Alzette", 49.50, 5.98], ["Differdange", 49.52, 5.89], ["Dudelange", 49.48, 6.09], ["Ettelbruck", 49.85, 6.10]] },
    { country: "Denmark", bloc: "N", cities: [["Copenhagen", 55.68, 12.57], ["Aarhus", 56.16, 10.20], ["Odense", 55.40, 10.39], ["Aalborg", 57.05, 9.92], ["Esbjerg", 55.48, 8.45]] },
    { country: "Norway", bloc: "N", cities: [["Kristiania", 59.91, 10.75], ["Bergen", 60.39, 5.32], ["Trondheim", 63.43, 10.40], ["Stavanger", 58.97, 5.73], ["Drammen", 59.74, 10.20]] },
    { country: "Sweden", bloc: "N", cities: [["Stockholm", 59.33, 18.07], ["Gothenburg", 57.71, 11.97], ["Malmö", 55.60, 13.00], ["Uppsala", 59.86, 17.64], ["Norrköping", 58.59, 16.19]] },
    { country: "Finland", bloc: "N", cities: [["Helsinki", 60.17, 24.94], ["Turku", 60.45, 22.27], ["Tampere", 61.50, 23.76], ["Vyborg", 60.71, 28.75], ["Oulu", 65.01, 25.47]] },
    { country: "Albania", bloc: "N", cities: [["Tirana", 41.33, 19.82], ["Shkodër", 42.07, 19.51], ["Durrës", 41.32, 19.45], ["Vlorë", 40.47, 19.49], ["Korçë", 40.62, 20.78]] },
    { country: "Morocco", bloc: "N", cities: [["Rabat", 34.02, -6.84], ["Casablanca", 33.57, -7.59], ["Fez", 34.03, -5.00], ["Marrakesh", 31.63, -8.00], ["Tangier", 35.77, -5.80]] },
    { country: "Algeria", bloc: "N", cities: [["Algiers", 36.75, 3.06], ["Oran", 35.70, -0.63], ["Constantine", 36.37, 6.61], ["Annaba", 36.90, 7.77], ["Tlemcen", 34.88, -1.32]] },
    { country: "Tunisia", bloc: "N", cities: [["Tunis", 36.81, 10.18], ["Sfax", 34.74, 10.76], ["Sousse", 35.83, 10.64], ["Kairouan", 35.68, 10.10], ["Bizerte", 37.27, 9.87]] },
    { country: "Libya", bloc: "N", cities: [["Tripoli", 32.89, 13.19], ["Benghazi", 32.12, 20.07], ["Misrata", 32.38, 15.09], ["Derna", 32.77, 22.64], ["Tobruk", 32.08, 23.98]] },
    { country: "Egypt", bloc: "N", cities: [["Cairo", 30.04, 31.24], ["Alexandria", 31.20, 29.92], ["Port Said", 31.26, 32.30], ["Tanta", 30.79, 31.00], ["Mansoura", 31.04, 31.38]] },
    { country: "Persia", bloc: "N", cities: [["Tehran", 35.69, 51.39], ["Tabriz", 38.08, 46.29], ["Isfahan", 32.65, 51.67], ["Hamadan", 34.80, 48.51], ["Qazvin", 36.27, 50.00]] }
  ]
};
