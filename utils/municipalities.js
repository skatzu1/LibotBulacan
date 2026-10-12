// The 24 local government units of Bulacan, for the home-municipality choice
// (the system specification's Registration Module). The traveler picks it on
// the second welcome screen (Screens/WelcomePage2.js); sign-up sends it with
// the new account, and asks again only when nothing was saved on the phone.
// The backend keeps the same list in LibotBackend utils/municipalities.js and
// stores only a name from it; keep the two the same.
export const BULACAN_MUNICIPALITIES = [
  "Angat", "Balagtas", "Baliwag", "Bocaue", "Bulakan", "Bustos", "Calumpit",
  "Doña Remedios Trinidad", "Guiguinto", "Hagonoy", "Malolos", "Marilao",
  "Meycauayan", "Norzagaray", "Obando", "Pandi", "Paombong", "Plaridel",
  "Pulilan", "San Ildefonso", "San Jose del Monte", "San Miguel", "San Rafael",
  "Santa Maria",
];

// Spellings saved by earlier builds' welcome screen ("Baliuag",
// "Meycauayan City", "San Jose del Monte City").
const ALIASES = { baliuag: "Baliwag", "sta. maria": "Santa Maria", drt: "Doña Remedios Trinidad" };

/** The list's spelling of `value`, or "" when it isn't a Bulacan municipality. */
export function normalizeMunicipality(value) {
  if (typeof value !== "string") return "";
  const key = value.trim().toLowerCase().replace(/^city of\s+/, "").replace(/\s+city$/, "");
  return BULACAN_MUNICIPALITIES.find((m) => m.toLowerCase() === key) || ALIASES[key] || "";
}

export const municipalityError = (value) =>
  BULACAN_MUNICIPALITIES.includes(value) ? null : "Choose the municipality you live in.";
