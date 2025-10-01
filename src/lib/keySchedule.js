// src/lib/keySchedule.js
// Genera subllaves de 64 bits (8 bytes) por ronda a partir de la key del usuario.
// Idea (simple y didáctica):
//   1) Normalizar key a 16 bytes (128 bits)
//   2) Para cada ronda r:
//      - Rotar 128 bits a la izquierda (rot = 7*r + 3)
//      - Pasar cada nibble por la S-Box (confusión en la key)
//      - XOR con una constante de ronda RC_r (diferencia rondas)
//      - Extraer 8 bytes (pares) => K_r (64 bits)
//      - El resultado de la mezcla queda como estado para la siguiente ronda

import { generateSBoxFromKey_simple, subBytesByte } from './sbox.js'

// -------- Utilidades básicas --------

// Convierte string a UTF-8 bytes
function strToBytes(str = '') {
  return new TextEncoder().encode(str ?? '')
}

// Normaliza la key a EXACTAMENTE 16 bytes (128 bits):
// Si es más corta, repite; si es más larga, recorta.
export function normalizeKey128(keyStr) {
  const raw = strToBytes(String(keyStr ?? ''))
  const out = new Uint8Array(16)
  if (raw.length === 0) return out // 16 bytes en 0x00
  let p = 0
  while (p < 16) {
    const n = Math.min(16 - p, raw.length)
    out.set(raw.subarray(0, n), p)
    p += n
  }
  return out
}

// Rotación circular a la izquierda en un vector de 128 bits.
// Implementación: rotamos por bytes y luego por bits con "arrastre" (carry).
export function rotl128(bytes16, rotBits = 0) {
  const src = new Uint8Array(bytes16) // copia
  const n = 16
  const r = ((rotBits % 128) + 128) % 128
  if (r === 0) return src

  const byteShift = (r >>> 3)        // rotación en bytes completos
  const bitShift  = (r & 7)          // rotación de 0..7 bits

  // 1) Rotación circular por bytes
  const tmp = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    tmp[i] = src[(i + byteShift) % n]
  }

  if (bitShift === 0) return tmp

  // 2) Ajuste de bits con carry entre bytes (también circular)
  const out = new Uint8Array(n)
  const back = (i) => (i - 1 + n) % n
  for (let i = 0; i < n; i++) {
    const hi = (tmp[i] << bitShift) & 0xff
    const lo = (tmp[back(i)] >>> (8 - bitShift)) & 0xff
    out[i] = (hi | lo) & 0xff
  }
  return out
}

// Aplica S-Box a CADA BYTE de la key (nibble alto y bajo)
export function subBytesKey(keyBytes, sbox) {
  const out = new Uint8Array(keyBytes.length)
  for (let i = 0; i < keyBytes.length; i++) out[i] = subBytesByte(keyBytes[i], sbox)
  return out
}

// Constante de ronda de 16 bytes (determinística, simple).
// Usamos un LCG con semilla basada en r; suficiente para diferenciar rondas.
export function roundConst16(r) {
  let x = (0x9e3779b9 ^ (r >>> 0)) >>> 0
  const out = new Uint8Array(16)
  for (let i = 0; i < 16; i++) {
    // LCG clásico (Numerical Recipes)
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0
    out[i] = (x ^ (r * 29 + i * 17)) & 0xff
  }
  return out
}

// XOR in-place: a ^= b (longitud = min(a,b))
export function xorInPlace(a, b) {
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) a[i] ^= b[i]
  return a
}

// Toma los bytes de índice PAR: [0,2,4,6,8,10,12,14] -> 8 bytes
export function extract64_evenBytes(bytes16) {
  const out = new Uint8Array(8)
  let p = 0
  for (let i = 0; i < 16; i += 2) out[p++] = bytes16[i]
  return out
}

// -------- API principal: deriveSubkeys --------

/**
 * Genera subllaves de 64 bits por ronda.
 * @param {string} keyStr - llave del usuario (≤ 16 chars recomendado)
 * @param {number} rounds - número de rondas (p.ej., 8)
 * @param {number[]} [sbox] - S-Box 4->4 a usar sobre la key; si se omite, se genera desde la propia key
 * @returns {Uint8Array[]} Array de 'rounds' elementos, cada uno Uint8Array(8)
 */
export function deriveSubkeys(keyStr, rounds, sbox) {
  if (!Number.isInteger(rounds) || rounds <= 0) throw new Error('rounds debe ser > 0')

  // S-Box para la key: si no viene una, la generamos con la misma key del usuario
  const S = Array.isArray(sbox) && sbox.length === 16 ? sbox : generateSBoxFromKey_simple(keyStr)

  // Estado del schedule: 16 bytes
  let state = normalizeKey128(keyStr)
  const out = []

  for (let r = 0; r < rounds; r++) {
    // 1) Rotar 128 bits
    const rot = (7 * r + 3) % 128
    state = rotl128(state, rot)

    // 2) S-Box nibble a nibble sobre la key
    state = subBytesKey(state, S)

    // 3) XOR con constante de ronda
    const rc = roundConst16(r)
    state = xorInPlace(state, rc)

    // 4) Extraer 64 bits (8 bytes pares)
    const Kr = extract64_evenBytes(state)
    out.push(Kr)
    // 'state' ya queda listo para la siguiente iteración
  }

  return out
}

// -------- (Opcional) helpers de depuración --------
export function bytesToHex(bytes) {
  return Array.from(bytes || []).map(b => b.toString(16).padStart(2, '0')).join('')
}
