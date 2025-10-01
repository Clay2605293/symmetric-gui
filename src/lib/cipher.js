// src/lib/cipher.js
// Cifrador por rondas con S-Box (keyed), ShiftNibbles, NibbleShuffle,
// XOR con subllave, P-Box (keyed) y XOR con constante por ronda.
// Orden SONATA: S → O → N → A(subkey) → T → A(const)
// Mantiene exports/firmas para la GUI: encryptConfusionOnly / decryptConfusionOnly.

import {
  generateSBoxFromKey_simple,
  invertSBox,
  applySBox,
  applyInvSBox,
} from './sbox.js'
import { deriveSubkeys } from './keySchedule.js'
import { generatePBoxFromKey_simple, invertPBox, permuteBits64 } from './pbox.js'

// ---------- helpers ----------
function bytesToHex(bytes) {
  return Array.from(bytes || []).map(b => b.toString(16).padStart(2, '0')).join('')
}
function xorBytes(a, b) {
  const len = Math.min(a.length, b.length)
  const out = new Uint8Array(len)
  for (let i = 0; i < len; i++) out[i] = a[i] ^ b[i]
  return out
}

// ---------- ShiftNibbles (difusión) 4x4 nibbles ----------
function bytesToNibbles(bytes8) {
  const n = new Array(16)
  for (let i = 0; i < 8; i++) {
    const b = bytes8[i] & 0xff
    n[2 * i]     = (b >>> 4) & 0x0f   // nibble alto
    n[2 * i + 1] = b & 0x0f           // nibble bajo
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
      const dst = row * 4 + ((col + row) % 4)
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
      const dst = row * 4 + ((col - row + 4) % 4)
      r[dst] = n[src]
    }
  }
  return nibblesToBytes(r)
}

// ---------- NibbleShuffle (difusión extra) ----------
function swapHiLo(b) { return ((b << 4) & 0xf0) | ((b >>> 4) & 0x0f) }
function nibbleShuffle(bytes8, maskByte) {
  const out = new Uint8Array(8)
  for (let i = 0; i < 8; i++) {
    const doSwap = ((maskByte >>> (i & 7)) & 1) !== 0
    out[i] = doSwap ? swapHiLo(bytes8[i]) : (bytes8[i] & 0xff)
  }
  return out
}
const invNibbleShuffle = nibbleShuffle // su propia inversa

// ---------- Constantes de ronda (simple, determinístico por key) ----------
function seedFromKey(keyStr) {
  let s = 2166136261 >>> 0
  for (let i = 0; i < keyStr.length; i++) {
    s ^= keyStr.charCodeAt(i) & 0xff
    s = (s * 16777619) >>> 0 // FNV-1a like
  }
  return s >>> 0
}
function nextRand32(x) {
  x ^= x << 13; x >>>= 0
  x ^= x << 17; x >>>= 0
  x ^= x << 5;  x >>>= 0
  return x >>> 0
}
function deriveRoundConstsSimple(keyStr, rounds) {
  const out = []
  let s = seedFromKey(keyStr) ^ (0x9e3779b9 >>> 0)
  for (let r = 0; r < rounds; r++) {
    s = nextRand32(s ^ (r + 1))
    const block = new Uint8Array(8)
    let t = s
    for (let i = 0; i < 8; i++) {
      t = nextRand32(t ^ ((r + 1) * (i + 1)))
      block[i] = (t & 0xff)
    }
    out.push(block)
  }
  return out
}

// ================= Rondas (orden SONATA) =================
function encryptRound(state, S, P, Kr, Rc, maskByte) {
  const trace = {}
  trace.stateIn = bytesToHex(state)

  // S — SubBytes
  state = applySBox(state, S)
  trace.afterSubBytes = bytesToHex(state)

  // O — ShiftNibbles
  state = shiftNibblesLeft(state)
  trace.afterShift = bytesToHex(state)

  // N — NibbleShuffle
  state = nibbleShuffle(state, maskByte)
  trace.afterNibble = bytesToHex(state)

  // A — XOR con subllave
  state = xorBytes(state, Kr)
  trace.subkeyHex = bytesToHex(Kr)

  // T — P-Box
  state = permuteBits64(state, P)
  trace.afterPermute = bytesToHex(state)

  // A — XOR con constante por ronda
  state = xorBytes(state, Rc)
  trace.constHex   = bytesToHex(Rc)
  trace.afterConst = trace.constHex // alias por compatibilidad

  trace.stateOut = bytesToHex(state)
  return { state, trace }
}

function decryptRound(state, invS, invP, Kr, Rc, maskByte) {
  // Inversa exacta de SONATA:
  // A(const)^-1 → T^-1 → A(subkey)^-1 → N^-1 → O^-1 → S^-1
  state = xorBytes(state, Rc)               // A(const) inversa
  state = permuteBits64(state, invP)        // T^-1
  state = xorBytes(state, Kr)               // A(subkey) inversa
  state = invNibbleShuffle(state, maskByte) // N^-1
  state = shiftNibblesRight(state)          // O^-1
  state = applyInvSBox(state, invS)         // S^-1
  return state
}

// ================== API llamadas por la GUI ==================
export function encryptConfusionOnly(plainBytes, rounds = 8, keyStr = '', blockBytes = 8) {
  const S = generateSBoxFromKey_simple(keyStr)
  const invS = invertSBox(S)
  const subkeys = deriveSubkeys(keyStr, rounds, S)         // Array<Uint8Array(8)>
  const P = generatePBoxFromKey_simple(keyStr)
  const invP = invertPBox(P)

  const rconsts = deriveRoundConstsSimple(keyStr, rounds)  // 8 bytes/ronda
  const rMasks  = rconsts.map(rc => (rc[0] ^ rc[7] ^ 0xa5) & 0xff) // 1 byte/ronda

  const blocks = []
  const roundTraces = [] // trazas del PRIMER bloque para el viewer

  for (let o = 0; o < plainBytes.length; o += blockBytes) {
    let state = plainBytes.slice(o, o + blockBytes)
    for (let r = 0; r < rounds; r++) {
      const { state: next, trace } =
        encryptRound(state, S, P, subkeys[r], rconsts[r], rMasks[r])
      if (o === 0) roundTraces.push({ idx: r, ...trace })
      state = next
    }
    blocks.push(state)
  }

  const out = new Uint8Array(plainBytes.length)
  let p = 0; blocks.forEach(b => { out.set(b, p); p += b.length })

  return { ciphertext: out, roundTraces, sbox: S, pbox: P, invSBox: invS, invPBox: invP }
}

export function decryptConfusionOnly(cipherBytes, rounds = 8, keyStr = '', blockBytes = 8) {
  const S = generateSBoxFromKey_simple(keyStr)
  const invS = invertSBox(S)
  const subkeys = deriveSubkeys(keyStr, rounds, S)
  const P = generatePBoxFromKey_simple(keyStr)
  const invP = invertPBox(P)

  const rconsts = deriveRoundConstsSimple(keyStr, rounds)
  const rMasks  = rconsts.map(rc => (rc[0] ^ rc[7] ^ 0xa5) & 0xff)

  const blocks = []
  for (let o = 0; o < cipherBytes.length; o += blockBytes) {
    let state = cipherBytes.slice(o, o + blockBytes)
    for (let r = rounds - 1; r >= 0; r--) {
      state = decryptRound(state, invS, invP, subkeys[r], rconsts[r], rMasks[r])
    }
    blocks.push(state)
  }

  const out = new Uint8Array(cipherBytes.length)
  let p = 0; blocks.forEach(b => { out.set(b, p); p += b.length })
  return { plaintext: out }
}

// (opcionales para tests)
export const _internals = {
  shiftNibblesLeft,
  shiftNibblesRight,
  nibbleShuffle,
  invNibbleShuffle,
  bytesToHex,
  encryptRound,
  decryptRound,
}
