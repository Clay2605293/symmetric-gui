import { useEffect, useMemo, useState } from 'react'
import './AvalancheDemo.css'

/**
 * Props esperadas:
 * - blockBits: number             // p.ej., 64
 * - keyBits: number               // p.ej., 128
 * - defaultKeyHex: string         // key en hex para demo
 * - encryptFn: (opts) => {        // función de cifrado a inyectar
 *     // Debe aceptar:
 *     // plaintextHex: string (tamaño bloque en hex)
 *     // keyHex: string
 *     // mode: 'ECB'|'CBC'
 *     // ivHex?: string
 *     // rounds: number
 *     // y devolver { ciphertextHex: string }
 *   }
 *
 * - cipherOptions: {
 *     mode: 'ECB'|'CBC',
 *     ivHex?: string,
 *     rounds: number
 *   }
 */
export default function AvalancheDemo({
  blockBits = 64,
  keyBits = 128,
  defaultKeyHex = '',
  encryptFn,
  cipherOptions,
}) {
  const blockBytes = Math.ceil(blockBits / 8)
  const keyBytes = Math.ceil(keyBits / 8)

  // Estado de demo
  const [plaintextHex, setPlaintextHex] = useState(() => '0000000000000000'.slice(0, blockBytes * 2))
  const [keyHex, setKeyHex] = useState(() =>
    defaultKeyHex && defaultKeyHex.length >= keyBytes * 2
      ? defaultKeyHex.slice(0, keyBytes * 2)
      : '00000000000000000000000000000000'.slice(0, keyBytes * 2)
  )
  const [flipTarget, setFlipTarget] = useState('plaintext') // 'plaintext' | 'key'
  const [bitIndex, setBitIndex] = useState(0)               // 0..blockBits-1 o 0..keyBits-1
  const [busy, setBusy] = useState(false)

  const clampBitIndex = (idx) => {
    const max = flipTarget === 'plaintext' ? blockBits - 1 : keyBits - 1
    return Math.max(0, Math.min(idx, max))
  }

  useEffect(() => {
    setBitIndex((i) => clampBitIndex(i))
  }, [flipTarget, blockBits, keyBits])

  // Helpers
  const hexToBytes = (hex) => {
    const s = (hex || '').replace(/\s+/g, '')
    const out = []
    for (let i = 0; i < s.length; i += 2) {
      const byte = parseInt(s.slice(i, i + 2) || '00', 16)
      out.push(byte)
    }
    return new Uint8Array(out)
  }

  const bytesToHex = (bytes) => {
    return Array.from(bytes || []).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const flipOneBit = (hex, totalBits, idx) => {
    const bytes = hexToBytes(hex)
    const maxIdx = totalBits - 1
    const i = Math.max(0, Math.min(idx, maxIdx))
    const bytePos = Math.floor(i / 8)
    const bitPos = 7 - (i % 8) // MSB primero
    const mask = 1 << bitPos
    if (bytePos < bytes.length) {
      bytes[bytePos] = bytes[bytePos] ^ mask
    }
    return bytesToHex(bytes)
  }

  const diffBits = (aHex, bHex) => {
    const a = hexToBytes(aHex)
    const b = hexToBytes(bHex)
    const len = Math.min(a.length, b.length)
    let diff = 0
    for (let i = 0; i < len; i++) {
      const x = a[i] ^ b[i]
      diff += popcnt8(x)
    }
    const total = len * 8
    const pct = total ? (diff / total) * 100 : 0
    return { diffBits: diff, totalBits: total, pct }
  }

  const popcnt8 = (x) => {
    // Brian Kernighan
    let c = 0
    let v = x & 0xff
    while (v) {
      v &= v - 1
      c++
    }
    return c
  }

  // Cálculo principal
  const result = useMemo(() => {
    if (!encryptFn) return null
    try {
      const { mode, ivHex, rounds } = cipherOptions || {}
      const base = encryptFn({
        plaintextHex,
        keyHex,
        mode: mode || 'ECB',
        ivHex,
        rounds: rounds || 8,
      })
      const flipHex = flipTarget === 'plaintext'
        ? flipOneBit(plaintextHex, blockBits, bitIndex)
        : flipOneBit(keyHex, keyBits, bitIndex)
      const alt = encryptFn({
        plaintextHex: flipTarget === 'plaintext' ? flipHex : plaintextHex,
        keyHex: flipTarget === 'key' ? flipHex : keyHex,
        mode: mode || 'ECB',
        ivHex,
        rounds: rounds || 8,
      })
      const baseC = (base?.ciphertextHex || '').slice(0, blockBytes * 2)
      const altC  = (alt?.ciphertextHex  || '').slice(0, blockBytes * 2)
      const stats = diffBits(baseC, altC)
      return { baseC, altC, stats }
    } catch {
      return null
    }
  }, [encryptFn, plaintextHex, keyHex, flipTarget, bitIndex, cipherOptions, blockBits, keyBits, blockBytes])

  // Gráfico por byte: pinta intensidad según bits distintos por byte
  const byteDiffs = useMemo(() => {
    if (!result) return []
    const a = hexToBytes(result.baseC)
    const b = hexToBytes(result.altC)
    const len = Math.min(a.length, b.length)
    const arr = []
    for (let i = 0; i < len; i++) {
      const d = popcnt8(a[i] ^ b[i])
      arr.push(d) // 0..8
    }
    return arr
  }, [result])

  const handleRandomize = () => {
    // Datos aleatorios válidos para el tamaño
    const randHex = (nBytes) =>
      Array.from(crypto.getRandomValues(new Uint8Array(nBytes)))
        .map(b => b.toString(16).padStart(2, '0')).join('')
    setPlaintextHex(randHex(blockBytes))
    setKeyHex(randHex(keyBytes))
  }

  const handleFlipChange = (e) => setFlipTarget(e.target.value)
  const handleBitIndex = (e) => setBitIndex(clampBitIndex(Number(e.target.value)))

  const activeBits = flipTarget === 'plaintext' ? blockBits : keyBits

  return (
    <section className="av-card">
      <header className="av-header">
        <h3>Avalanche Demo</h3>
        <div className="av-sub">
          <span>Block: {blockBits} bits</span>
          <span>Key: {keyBits} bits</span>
        </div>
      </header>

      <div className="av-grid">
        <div className="av-box">
          <div className="av-row">
            <label className="av-label">Plaintext (hex)</label>
            <input
              className="av-input mono"
              value={plaintextHex}
              onChange={(e) => setPlaintextHex(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, blockBytes * 2))}
              placeholder="hex"
              spellCheck={false}
            />
          </div>
          <div className="av-row">
            <label className="av-label">Key (hex)</label>
            <input
              className="av-input mono"
              value={keyHex}
              onChange={(e) => setKeyHex(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, keyBytes * 2))}
              placeholder="hex"
              spellCheck={false}
            />
          </div>

          <div className="av-controls">
            <div className="av-toggle">
              <label>Flip target</label>
              <select value={flipTarget} onChange={handleFlipChange}>
                <option value="plaintext">Plaintext</option>
                <option value="key">Key</option>
              </select>
            </div>

            <div className="av-slider-group">
              <label htmlFor="bitindex">Bit index</label>
              <div className="av-slider-row">
                <input
                  id="bitindex"
                  type="range"
                  min={0}
                  max={activeBits - 1}
                  step={1}
                  value={bitIndex}
                  onChange={handleBitIndex}
                />
                <span className="av-badge">{bitIndex}</span>
              </div>
              <div className="av-hint">0 es el bit más significativo del primer byte.</div>
            </div>

            <div className="av-actions">
              <button className="av-btn" onClick={handleRandomize} disabled={busy}>Randomize</button>
            </div>
          </div>
        </div>

        <div className="av-box">
          <div className="av-row">
            <label className="av-label">Ciphertext (base)</label>
            <pre className="av-code">{result?.baseC || ''}</pre>
          </div>
          <div className="av-row">
            <label className="av-label">Ciphertext (flipped)</label>
            <pre className="av-code">{result?.altC || ''}</pre>
          </div>

          <div className="av-stats">
            <div className="av-stat">
              <span className="av-stat-title">% bits changed</span>
              <span className="av-stat-value">{result ? result.stats.pct.toFixed(2) : '0.00'}%</span>
            </div>
            <div className="av-stat">
              <span className="av-stat-title">Changed / Total</span>
              <span className="av-stat-value">
                {result ? `${result.stats.diffBits} / ${result.stats.totalBits}` : `0 / ${blockBits}`}
              </span>
            </div>
          </div>

          <div className="av-bargrid" aria-label="Bit differences by byte">
            {byteDiffs.map((d, i) => {
              const pct = (d / 8) * 100 // 0..100
              return (
                <div key={i} className="av-barcol">
                  <div className="av-bar" style={{ height: `${pct}%` }} />
                  <div className="av-barlabel">{i}</div>
                </div>
              )
            })}
            {byteDiffs.length === 0 && <div className="av-empty">Ciphertexts pending…</div>}
          </div>
        </div>
      </div>
    </section>
  )
}
