// 16 notas fijas (0..15) — reversible por nibble
export const NOTESET = [
  "C4","C#4","D4","D#4","E4","F4","F#4","G4",
  "G#4","A4","A#4","B4","C5","C#5","D5","D#5"
];

// Uint8Array -> ["C4","D#4",...]
export function bytesToNotes(u8 = new Uint8Array()) {
  const notes = [];
  for (let i = 0; i < u8.length; i++) {
    const b = u8[i] & 0xff;
    notes.push(NOTESET[(b >> 4) & 0xf], NOTESET[b & 0xf]);
  }
  return notes;
}

// "85 7f d2 ..." (hex con o sin espacios) -> ["..."]
export function hexToNotes(hexStr = "") {
  const clean = (hexStr || "").replace(/\s+/g, "").toLowerCase();
  const notes = [];
  for (let i = 0; i < clean.length; i += 2) {
    const byte = parseInt(clean.slice(i, i + 2) || "00", 16);
    notes.push(NOTESET[(byte >> 4) & 0xf], NOTESET[byte & 0xf]);
  }
  return notes;
}

// CSV seguro en query (?notes=) — codifica '#' como %23
export function notesToQueryParam(notes = []) {
  const csv = notes.join(",");
  return encodeURI(csv).replace(/#/g, "%23");
}

// Construye el URL para tu player en Vercel
// … (tu NOTESET, bytesToNotes, hexToNotes, notesToQueryParam, etc.) …

export function buildMusicUrl({
  bytes,
  hex,
  base = "https://music-player-one-swart.vercel.app",
  bpm = 120,
  wave = "square",
  dur = 0.28,
  gap = 0.05,
  ivHex,             // <-- NUEVO: IV en hex (64 bits = 16 hex chars)
  rounds,            // <-- NUEVO: número de rondas
} = {}) {
  const notes = bytes ? bytesToNotes(bytes) : hexToNotes(hex || "");
  const notesParam = notesToQueryParam(notes);
  let url = `${base}?notes=${notesParam}&bpm=${bpm}&wave=${wave}&dur=${dur}&gap=${gap}`;
  if (ivHex) url += `&iv=${encodeURIComponent(ivHex.replace(/\s+/g, ''))}`;
  if (Number.isFinite(rounds)) url += `&r=${rounds}`;
  return url;
}


// (Opcional) Notas -> HEX (reversible)
const NOTE_INDEX = Object.fromEntries(NOTESET.map((n,i)=>[n,i]));
export function notesToHex(notesCsv = "") {
  const tokens = notesCsv.split(/[,\s]+/).filter(Boolean);
  if (tokens.length % 2 !== 0) throw new Error("Deben ser 2 notas por byte.");
  const out = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const hi = NOTE_INDEX[tokens[i]];
    const lo = NOTE_INDEX[tokens[i+1]];
    if (hi == null || lo == null) throw new Error("Nota fuera del set permitido.");
    out.push(((hi << 4) | lo).toString(16).padStart(2, "0"));
  }
  return out.join(" ");
}
