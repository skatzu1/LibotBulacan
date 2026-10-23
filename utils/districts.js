/*
 * Bulacan's legislative districts (Republic Act 11546, 2021) — the silver tier
 * of achievement: every town in one that has spots. The backend decides who has
 * finished one (LibotBackend utils/districts.js; keep the two the same); this
 * is for naming them.
 */
export const DISTRICTS = [
  { key: "1",    name: "District 1", towns: ["Bulakan", "Calumpit", "Hagonoy", "Malolos", "Paombong", "Pulilan"] },
  { key: "2",    name: "District 2", towns: ["Baliwag", "Bustos", "Plaridel"] },
  { key: "3",    name: "District 3", towns: ["Doña Remedios Trinidad", "San Ildefonso", "San Miguel", "San Rafael"] },
  { key: "4",    name: "District 4", towns: ["Marilao", "Meycauayan", "Obando"] },
  { key: "5",    name: "District 5", towns: ["Balagtas", "Bocaue", "Guiguinto", "Pandi"] },
  { key: "6",    name: "District 6", towns: ["Angat", "Norzagaray", "Santa Maria"] },
  { key: "sjdm", name: "San Jose del Monte District", towns: ["San Jose del Monte"] },
];

/** A district's name from its key ("1" to "6", "sjdm"), or null. */
export const districtName = (key) => DISTRICTS.find((d) => d.key === String(key))?.name ?? null;
