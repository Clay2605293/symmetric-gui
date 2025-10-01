// src/utils/share.js
// Utilidades para empaquetar [IV||CT] en links "divertidos" y para detectar/extraerlos.

const ALPH = 'ABCDEFGHIJKLMNOP' // 16 símbolos (nibbles)

export function bytesToHex(bytes) {
  return Array.from(bytes || []).map(b => b.toString(16).padStart(2,'0')).join('')
}
export function hexToBytes(hex) {
  const s = (hex || '').replace(/\s+/g, '').toLowerCase()
  if (!/^[0-9a-f]+$/.test(s) || s.length % 2) return new Uint8Array()
  const out = new Uint8Array(s.length / 2)
  for (let i = 0; i < s.length; i += 2) out[i/2] = parseInt(s.slice(i, i+2), 16)
  return out
}

// ---- HEX <-> "melodía" (A..P) ----
export function hexToMelody(hex) {
  const s = (hex || '').replace(/\s+/g, '').toLowerCase()
  return s.split('').map(ch => {
    const v = parseInt(ch, 16)
    return Number.isFinite(v) ? ALPH[v] : ''
  }).join('')
}
export function melodyToHex(mel) {
  const clean = (mel || '').replace(/[^A-P]/g, '')
  return clean.split('').map(ch => ALPH.indexOf(ch).toString(16)).join('')
}

// ---- base64url helpers ----
function bytesToBase64(bytes) {
  let bin = ''; (bytes || []).forEach(b => bin += String.fromCharCode(b))
  return btoa(bin)
}
export function toBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
}
export function fromBase64Url(s) {
  let t = String(s || '').replace(/-/g,'+').replace(/_/g,'/')
  while (t.length % 4) t += '='
  const bin = atob(t)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// ---- Generadores de links ----
export function makeMusicLinkFromBytes(bytes, baseUrl = 'https://maiz.audio/play') {
  const hex = bytesToHex(bytes)
  const mel = hexToMelody(hex)
  return `${baseUrl}?mel=${mel}`
}

export function makeMapsLinkFromBytes(bytes) {
  const b64u = toBase64Url(bytes)
  const lat = (Math.random()*180 - 90).toFixed(5)
  const lon = (Math.random()*360 - 180).toFixed(5)
  return `https://maps.google.com/?q=${lat},${lon}&mz=${encodeURIComponent(b64u)}`
}

// ---- Detección y extracción desde un link o texto ----
export function detectAndExtract(text) {
  const s = String(text || '').trim()

  // 1) ¿URL?
  try {
    const url = new URL(s)
    const host = url.hostname.toLowerCase()

    // musical: ?mel= (A..P)
    const mel = url.searchParams.get('mel')
    if (mel && /[A-P]/.test(mel)) {
      const hex = melodyToHex(mel)
      return { kind: 'music-url', bytes: hexToBytes(hex) }
    }

    // maps: ?mz= (base64url)
    const mz = url.searchParams.get('mz')
    if (mz && host.includes('google')) {
      return { kind: 'maps-url', bytes: fromBase64Url(mz) }
    }
  } catch { /* no es URL */ }

  // 2) ¿HEX plano?
  const hexClean = s.replace(/\s+/g,'')
  if (/^[0-9a-fA-F]+$/.test(hexClean) && hexClean.length % 2 === 0) {
    return { kind: 'hex', bytes: hexToBytes(hexClean) }
  }

  // 3) ¿base64url?
  if (/^[A-Za-z0-9\-_]+=?=?$/.test(s)) {
    try { return { kind: 'base64url', bytes: fromBase64Url(s) } } catch {}
  }

  return { kind: 'unknown', bytes: new Uint8Array() }
}
