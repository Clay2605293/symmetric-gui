// src/utils/share.js
import { notesToHex } from './music'

// Formatea "a1b2c3" -> "a1 b2 c3"
function formatHex(hex = "") {
  const s = hex.replace(/\s+/g, '').toLowerCase()
  return (s.match(/.{1,2}/g) || []).join(' ')
}

/**
 * Parsea un URL compartido:
 *  - Music (HEX)  : …?notes=CSV&iv=HEX&r=ROUNDS
 *  - Maps (BASE64): https://maps…?q=lat,lon&cipher=BASE64&iv=HEX&r=ROUNDS
 *
 * Devuelve null si no reconoce formato.
 */
export function parseSharedUrl(raw = "") {
  let u
  try { u = new URL(raw.trim()) } catch { return null }

  const get = (k) => u.searchParams.get(k)

  // 1) Music: param "notes"
  const notesParam = get('notes')
  if (notesParam) {
    const csv = decodeURIComponent(notesParam)      // recupera C#4, etc.
    const hex = notesToHex(csv)                     // ← reversible
    const ivHex = (get('iv') || '').toLowerCase().replace(/[^0-9a-f]/g,'')
    const r = parseInt(get('r') || '', 10)

    return {
      kind: 'music',
      encoding: 'hex',
      ciphertext: formatHex(hex),
      ivHex: ivHex || undefined,
      rounds: Number.isFinite(r) ? r : undefined,
    }
  }

  // 2) Maps: param "cipher"
  const cipherB64 = get('cipher')
  if (cipherB64) {
    const b64 = decodeURIComponent(cipherB64)
    const ivHex = (get('iv') || '').toLowerCase().replace(/[^0-9a-f]/g,'')
    const r = parseInt(get('r') || '', 10)

    return {
      kind: 'maps',
      encoding: 'base64',
      ciphertext: b64,
      ivHex: ivHex || undefined,
      rounds: Number.isFinite(r) ? r : undefined,
    }
  }

  return null
}
