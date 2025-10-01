// === Helpers muy simples ===
function strToBytes(str = '') {
  const out = []
  for (let i = 0; i < str.length; i++) out.push(str.charCodeAt(i) & 0xff)
  return out
}

// Hashcito baratísimo (para obtener una semilla de 32 bits a partir de la llave).
// No es criptográfico; sólo nos da un número reproducible.
function hash32FromKey(keyStr) {
  const b = strToBytes(String(keyStr ?? ''))
  let h = 0 >>> 0
  for (let i = 0; i < b.length; i++) {
    h = ((h * 31) + b[i]) >>> 0  // multiplicador 31 clásico (simple y fácil de explicar)
  }
  return h >>> 0
}

// PRNG sencillito: LCG (Linear Congruential Generator).
// Determinístico y suficiente para barajar 16 elementos de forma estable por llave.
function makeLCG(seed) {
  let x = (seed >>> 0) || 1
  return function nextU32() {
    // Constantes típicas de LCG (Numerical Recipes)
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0
    return x
  }
}

// Fisher–Yates para barajar [0..15] usando nuestro PRNG.
function shuffle16(nextU32) {
  const arr = Array.from({ length: 16 }, (_, i) => i)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = nextU32() % (i + 1)
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp
  }
  return arr
}

// ==== LO QUE PEDISTE ====
// Genera UNA sola S-Box (4→4) "random" pero dependiente de la llave del usuario.
export function generateSBoxFromKey_simple(keyStr) {
  const seed = hash32FromKey(keyStr)
  const nextU32 = makeLCG(seed)
  return shuffle16(nextU32) // Devuelve una permutación de 0..15
}

// Inversa: inv[S[x]] = x  (ya la tenías, la dejo por si quieres centralizar)
export function invertSBox(S) {
  if (!Array.isArray(S) || S.length !== 16) throw new Error('S-Box inválida')
  const inv = new Array(16)
  const seen = new Set()
  for (let x = 0; x < 16; x++) {
    const y = S[x] | 0
    if (y < 0 || y > 15 || seen.has(y)) throw new Error('S-Box no es permutación')
    seen.add(y)
    inv[y] = x
  }
  return inv
}

// Aplicadores (por si no los tienes a mano)
export function subBytesByte(byte, S) {
  const hi = (byte >>> 4) & 0x0f
  const lo = byte & 0x0f
  return ((S[hi] & 0x0f) << 4) | (S[lo] & 0x0f)
}
export function applySBox(bytes, S) {
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) out[i] = subBytesByte(bytes[i], S)
  return out
}
export function applyInvSBox(bytes, inv) {
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] & 0xff
    const hi = (b >>> 4) & 0x0f
    const lo = b & 0x0f
    out[i] = ((inv[hi] & 0x0f) << 4) | (inv[lo] & 0x0f)
  }
  return out
}
