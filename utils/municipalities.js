// The 24 local government units of Bulacan, for the home-municipality choice
// at sign-up (the system specification's Registration Module). The backend
// keeps the same list in LibotBackend utils/municipalities.js and stores only
// a name from it; keep the two the same.
export const BULACAN_MUNICIPALITIES = [
  "Angat", "Balagtas", "Baliwag", "Bocaue", "Bulakan", "Bustos", "Calumpit",
  "Doña Remedios Trinidad", "Guiguinto", "Hagonoy", "Malolos", "Marilao",
  "Meycauayan", "Norzagaray", "Obando", "Pandi", "Paombong", "Plaridel",
  "Pulilan", "San Ildefonso", "San Jose del Monte", "San Miguel", "San Rafael",
  "Santa Maria",
];

export const municipalityError = (value) =>
  BULACAN_MUNICIPALITIES.includes(value) ? null : "Choose the municipality you live in.";
