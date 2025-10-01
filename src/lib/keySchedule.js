// src/lib/keySchedule.js
// Genera subllaves de 64 bits (8 bytes) por ronda a partir de la key del usuario.
// Además provee constantes de ronda (8 bytes) y máscaras de NibbleShuffle (1 byte) por ronda,
// todo determinístico a partir de la misma key (útil para mantener SONATA coherente en encrypt/decrypt).

import { generateSBoxFromKey_simple, subBytesByte } from './sbox.js'

/* ===================== Utilidades básicas ===================== */

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

/* ===================== Key schedule principal ===================== */

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

/* ===================== Constantes/máscaras por ronda (SONATA) ===================== */

// Hash FNV-1a sobre la key (32 bits) —determinista, simple.
function seedFromKey(keyStr) {
  let s = 2166136261 >>> 0
  for (let i = 0; i < keyStr.length; i++) {
    s ^= keyStr.charCodeAt(i) & 0xff
    s = (Math.imul(s, 16777619)) >>> 0
  }
  return s >>> 0
}
// xorshift32 simple
function nextRand32(x) {
  x ^= (x << 13); x >>>= 0
  x ^= (x << 17); x >>>= 0
  x ^= (x << 5);  x >>>= 0
  return x >>> 0
}

/**
 * Constantes de ronda de 8 bytes (para A(const)) determinísticas por key.
 * @returns {Uint8Array[]} Array de longitud 'rounds', cada elemento Uint8Array(8)
 */
export function deriveRoundConsts8(keyStr, rounds) {
  if (!Number.isInteger(rounds) || rounds <= 0) throw new Error('rounds debe ser > 0')
  const out = []
  let s = (seedFromKey(keyStr) ^ 0x9e3779b9) >>> 0
  for (let r = 0; r < rounds; r++) {
    s = nextRand32((s ^ (r + 1)) >>> 0)
    const block = new Uint8Array(8)
    let t = s
    for (let i = 0; i < 8; i++) {
      t = nextRand32((t ^ ((r + 1) * (i + 1))) >>> 0)
      block[i] = t & 0xff
    }
    out.push(block)
  }
  return out
}

/**
 * Máscara de 1 byte por ronda para NibbleShuffle (bit i decide si intercambia hi/lo del byte i).
 * Por compatibilidad con lo que planteamos en cipher.js: mask = const[0] ^ const[7] ^ 0xA5
 * @returns {number[]} Array de longitud 'rounds' con valores 0..255
 */
export function deriveRoundMasks(keyStr, rounds) {
  const consts = deriveRoundConsts8(keyStr, rounds)
  return consts.map(rc => ((rc[0] ^ rc[7] ^ 0xa5) & 0xff))
}

/* ===================== Helpers debug ===================== */
export function bytesToHex(bytes) {
  return Array.from(bytes || []).map(b => b.toString(16).padStart(2, '0')).join('')
}
