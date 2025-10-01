// src/lib/cipher.js
// Cifrador por rondas con S-Box (keyed), ShiftNibbles, P-Box (keyed) y XOR con subllave.
// Compatible con tu GUI: mantiene los exports encryptConfusionOnly/decryptConfusionOnly.

import {
  generateSBoxFromKey_simple,
  invertSBox,
  applySBox,
  applyInvSBox,
} from './sbox.js'
import { deriveSubkeys, bytesToHex as hexFromKS } from './keySchedule.js'
import { generatePBoxFromKey_simple, invertPBox, permuteBits64 } from './pbox.js'

// --- helpers locales ---
function bytesToHex(bytes) {
  return Array.from(bytes || []).map(b => b.toString(16).padStart(2, '0')).join('')
}
function xorBytes(a, b) {
  const len = Math.min(a.length, b.length)
  const out = new Uint8Array(len)
  for (let i = 0; i < len; i++) out[i] = a[i] ^ b[i]
  return out
}

// ---- ShiftNibbles (difusión #1) en vista 4x4 nibbles ----
// Estado (8 bytes = 16 nibbles). Organizamos como 4 filas × 4 columnas.
// Fila r se rota r posiciones a la izquierda.
function bytesToNibbles(bytes8) {
  const n = new Array(16)
  for (let i = 0; i < 8; i++) {
    const b = bytes8[i] & 0xff
    n[2 * i] = (b >>> 4) & 0x0f   // nibble alto
    n[2 * i + 1] = b & 0x0f       // nibble bajo
  }
  return n
}
function nibblesToBytes(nibs16) {
  const out = new Uint8Array(8)
  for (let i = 0; i < 8; i++) out[i] = ((nibs16[2 * i] & 0x0f) << 4) | (nibs16[2 * i + 1] & 0x0f)
  return out
}
function shiftNibblesLeft(bytes8) {
  const n = bytesToNibbles(bytes8)
  const r = new Array(16)
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const src = row * 4 + col
      const dst = row * 4 + ((col + row) % 4) // shift = row
      r[dst] = n[src]
    }
  }
  return nibblesToBytes(r)
}
function shiftNibblesRight(bytes8) {
  const n = bytesToNibbles(bytes8)
  const r = new Array(16)
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const src = row * 4 + col
      const dst = row * 4 + ((col - row + 4) % 4) // inversa
      r[dst] = n[src]
    }
  }
  return nibblesToBytes(r)
}

// --- ronda única (para trazas) ---
function encryptRound(state, S, P, Kr) {
  const trace = {}
  trace.stateIn = bytesToHex(state)

  // SubBytes (confusión)
  state = applySBox(state, S)
  trace.afterSubBytes = bytesToHex(state)

  // ShiftNibbles (difusión #1)
  state = shiftNibblesLeft(state)
  trace.afterShift = bytesToHex(state)

  // P-Box (difusión #2)
  state = permuteBits64(state, P)
  trace.afterPermute = bytesToHex(state)

  // XOR con subllave (confusión #2)
  state = xorBytes(state, Kr)
  trace.subkeyHex = bytesToHex(Kr)
  trace.stateOut = bytesToHex(state)

  return { state, trace }
}

function decryptRound(state, invS, invP, Kr) {
  // Orden inverso
  state = xorBytes(state, Kr)
  state = permuteBits64(state, invP)
  state = shiftNibblesRight(state)
  state = applyInvSBox(state, invS)
  return state
}

// ================== API llamadas por la GUI ==================

// Nota: mantenemos el nombre para no tocar Home.jsx
export function encryptConfusionOnly(plainBytes, rounds = 8, keyStr = '', blockBytes = 8) {
  const S = generateSBoxFromKey_simple(keyStr)
  const invS = invertSBox(S) // por si alguien lo requiere
  const subkeys = deriveSubkeys(keyStr, rounds, S) // [Uint8Array(8)]
  const P = generatePBoxFromKey_simple(keyStr)
  const invP = invertPBox(P)

  const blocks = []
  const roundTraces = [] // devolveremos trazas del PRIMER bloque (para RoundsView)

  for (let o = 0; o < plainBytes.length; o += blockBytes) {
    let state = plainBytes.slice(o, o + blockBytes)
    for (let r = 0; r < rounds; r++) {
      const { state: next, trace } = encryptRound(state, S, P, subkeys[r])
      if (o === 0) roundTraces.push({ idx: r, ...trace })
      state = next
    }
    blocks.push(state)
  }

  const out = new Uint8Array(plainBytes.length)
  let p = 0; blocks.forEach(b => { out.set(b, p); p += b.length })

  return {
    ciphertext: out,
    roundTraces,
    sbox: S,
    pbox: P,
    invSBox: invS,
    invPBox: invP,
  }
}

export function decryptConfusionOnly(cipherBytes, rounds = 8, keyStr = '', blockBytes = 8) {
  const S = generateSBoxFromKey_simple(keyStr)
  const invS = invertSBox(S)
  const subkeys = deriveSubkeys(keyStr, rounds, S)
  const P = generatePBoxFromKey_simple(keyStr)
  const invP = invertPBox(P)

  const blocks = []
  for (let o = 0; o < cipherBytes.length; o += blockBytes) {
    let state = cipherBytes.slice(o, o + blockBytes)
    for (let r = rounds - 1; r >= 0; r--) {
      state = decryptRound(state, invS, invP, subkeys[r])
    }
    blocks.push(state)
  }

  const out = new Uint8Array(cipherBytes.length)
  let p = 0; blocks.forEach(b => { out.set(b, p); p += b.length })
  return { plaintext: out }
}

// (Export opcional por si quieres usar en tests)
export const _internals = {
  shiftNibblesLeft,
  shiftNibblesRight,
  encryptRound,
  decryptRound,
  bytesToHex,
}
