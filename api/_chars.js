"use strict";
/* The allocation sheet: 20 characters per topic. side: "me" = the blue side, "foe" = the red side, null = no force (neutral / church). */
const F = {
  fr: { label: "French royals", side: "me" }, en: { label: "English royals", side: "foe" }, ne: { label: "Neutrals", side: null }, ch: { label: "Church", side: null },
  al: { label: "Allied powers", side: "me" }, ce: { label: "Central powers", side: "foe" }, nu: { label: "Neutral", side: null }
};
const T1 = [
  ["Arnoul d'Audrehem", "fr"], ["Arthur de Richemont", "fr"], ["Benedict XII (Pope)", "ch"], ["Bertrand du Guesclin", "fr"], ["Charles of Blois", "fr"],
  ["Charles the Bad", "ne"], ["Duke of Normandy", "fr"], ["Fr. John Ball", "ch"], ["Francois Prelati", "ne"], ["Humphrey, Duke of Gloucester", "en"],
  ["John of Gaunt", "en"], ["King Charles VI", "fr"], ["King Edward III", "en"], ["King Philips VI", "fr"], ["Philip the Good", "en"],
  ["Robin Hood", "ne"], ["Saint Catherine of Siena", "ch"], ["Sir John Chandos", "en"], ["Saint Roch", "ch"], ["William de la Pole", "en"]
];
const T2 = [
  ["Woodrow Wilson (USA)", "nu"], ["Raymond Poincare (France)", "al"], ["Queen Wilhema (Netherlands)", "nu"], ["Nicholas II (Russia)", "al"], ["King Gustav V (Sweden)", "nu"],
  ["King George V (Britain)", "al"], ["King Alfonso XIII (Spain)", "nu"], ["Kamio Mitsuomi (Japan)", "nu"], ["Kaiser Wilhem II (German Empire)", "ce"], ["Joseph Joffre (France)", "al"],
  ["Emperor Franz Joseph I (Austria-Hungary)", "ce"], ["Enver Pasha (Ottoman Empire)", "ce"], ["Field Marshal Paul Von Hindenburg (German Empire)", "ce"], ["H.H. Asquith (Britain)", "al"], ["Istvan Tisza (Austria-Hungary)", "ce"],
  ["Ivan Goremykin (Russia)", "al"], ["Antonin de Selliers de Moranville (Belgium)", "nu"], ["John Jellicoe (Britain)", "al"], ["Ataturk (Ottoman Empire)", "ce"], ["Alfred Von Tirpitz (German Empire)", "ce"]
];
const mk = (topic, rows) => rows.map(([name, f], i) => ({ id: topic + "-" + String(i + 1).padStart(2, "0"), topic, name, faction: f, factionLabel: F[f].label, side: F[f].side }));
const CHARS = mk("t1", T1).concat(mk("t2", T2));
/* names of the blue ("me") and red ("foe") side in each topic; everyone else is Neutral */
const SIDE_NAMES = { t1: { me: "French royals", foe: "English royals", ne: "Neutral" }, t2: { me: "Allied powers", foe: "Central powers", ne: "Neutral" } };
module.exports = CHARS; module.exports.SIDE_NAMES = SIDE_NAMES;
