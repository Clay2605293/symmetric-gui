// src/lib/pbox.js
// P-Box de 64 bits dependiente de la key (shuffle 0..63 con LCG+Fisher-Yates)

function strToBytes(str = '') {
  const out = []
  for (let i = 0; i < str.length; i++) out.push(str.charCodeAt(i) & 0xff)
  return out
}

function hash32FromKey(keyStr) {
  const b = strToBytes(String(keyStr ?? ''))
  let h = 0 >>> 0
  for (let i = 0; i < b.length; i++) h = ((h * 31) + b[i]) >>> 0
  return h >>> 0
}

function makeLCG(seed) {
  let x = (seed >>> 0) || 1
  return function nextU32() {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0
    return x >>> 0
  }
}

export function generatePBoxFromKey_simple(keyStr) {
  const seed = hash32FromKey(keyStr)
  const nextU32 = makeLCG(seed ^ 0x6d2b79f5)
  const P = Array.from({ length: 64 }, (_, i) => i)
  // Fisher–Yates
  for (let i = P.length - 1; i > 0; i--) {
    const j = nextU32() % (i + 1)
    const tmp = P[i]; P[i] = P[j]; P[j] = tmp
  }
  // Definición: P[i] = índice de destino del bit origen i (source->dest)
  return P
}

export function invertPBox(P) {
  const inv = new Array(64)
  for (let i = 0; i < 64; i++) inv[P[i]] = i
  return inv
}

// --- utilidades de bits sobre 64 bits (8 bytes) ---
function getBit(bytes8, idx) {
  const byte = bytes8[idx >>> 3]
  const off = idx & 7
  return (byte >>> off) & 1
}
function setBit(bytes8, idx, bit) {
  const bi = idx >>> 3
  const off = idx & 7
  if (bit & 1) bytes8[bi] |= (1 << off)
  else bytes8[bi] &= ~(1 << off)
}

// Aplica P-Box: out[ P[i] ] = in[i]
export function permuteBits64(bytes8, P) {
  const src = bytes8
  const out = new Uint8Array(8)
  for (let i = 0; i < 64; i++) {
    const b = getBit(src, i)
    setBit(out, P[i], b)
  }
  return out
}
