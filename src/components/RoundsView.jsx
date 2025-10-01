// src/components/RoundsView.jsx
import { useEffect, useMemo, useState } from 'react'
import './RoundsView.css'

export default function RoundsView({
  rounds = [],
  sbox = [],
  pbox = [],
  blockBits = 64,
  active = 0,
  onSelect,
  collapsed = false,
}) {
  const [localActive, setLocalActive] = useState(active || 0)

  useEffect(() => {
    if (onSelect) return
    setLocalActive(active || 0)
  }, [active, onSelect])

  const current = useMemo(() => {
    const i = onSelect ? active : localActive
    return rounds[Math.max(0, Math.min(i, rounds.length - 1))] || null
  }, [rounds, active, localActive, onSelect])

  const SBoxGrid = useMemo(() => {
    const items = []
    for (let i = 0; i < 16; i++) {
      const out = sbox[i]
      items.push(
        <div key={i} className="rv-sbox-cell">
          <div className="rv-sbox-in">{i.toString(16)}</div>
          <div className="rv-sbox-arrow">→</div>
          <div className="rv-sbox-out">{(out ?? 0).toString(16)}</div>
        </div>
      )
    }
    return items
  }, [sbox])

  const PBoxList = useMemo(() => {
    const maxShow = Math.min(pbox.length, 24)
    const rows = []
    for (let i = 0; i < maxShow; i++) {
      rows.push(
        <div key={i} className="rv-pbox-row">
          <span className="rv-pbox-i">{i}</span>
          <span className="rv-pbox-map">→</span>
          <span className="rv-pbox-o">{pbox[i]}</span>
        </div>
      )
    }
    return rows
  }, [pbox])

  // Bytes a "xx xx xx ..." (una sola línea; el wrapper hará el salto visual)
  function oneLineHex(hex) {
    const s = (hex || '').replace(/\s+/g, '').toLowerCase()
    const bytes = s.match(/.{1,2}/g) || []
    return bytes.join(' ')
  }

  // Compatibilidad: la constante puede venir como constHex o afterConst
  const getConstHex = (r) => (r?.constHex ?? r?.afterConst ?? '')

  if (!rounds.length) return null

  return (
    <section className="rv-card">
      <header className="rv-header">
        <h3>Rounds Viewer</h3>
        <span className="rv-sub">Block: {blockBits} bits · Rounds: {rounds.length}</span>
      </header>

      <div className={`rv-layout ${collapsed ? 'rv-collapsed' : ''}`}>
        {/* Sidebar */}
        <aside className="rv-side">
          <div className="rv-rounds">
            {rounds.map((r, i) => (
              <button
                key={i}
                className={`rv-round ${ (onSelect ? active : localActive) === i ? 'active' : ''}`}
                onClick={() => (onSelect ? onSelect(i) : setLocalActive(i))}
                aria-label={`Round ${i+1}`}
                title={`Round ${i+1}`}
              >
                R{i+1}
              </button>
            ))}
          </div>

          <div className="rv-box rv-sbox">
            <div className="rv-box-title">S-Box (nibble)</div>
            <div className="rv-sbox-grid">{SBoxGrid}</div>
          </div>

          <div className="rv-box rv-pbox">
            <div className="rv-box-title">P-Box (bits)</div>
            <div className="rv-pbox-list">
              {PBoxList}
              {pbox.length > 24 && <div className="rv-pbox-more">+ {pbox.length - 24} more…</div>}
            </div>
          </div>
        </aside>

        {/* Panel central SONATA */}
        <div className="rv-main">
          <div className="rv-badge">Round #{(onSelect ? active : localActive) + 1}</div>

          {current ? (
            <div className="rv-lines">
              {/* S — Substitute */}
              <div className="rv-line">
                <div className="rv-tag">State In</div>
                <pre className="rv-block">{oneLineHex(current.stateIn)}</pre>
              </div>
              <div className="rv-line">
                <div className="rv-tag">Substitute (S)</div>
                <pre className="rv-block">{oneLineHex(current.afterSubBytes)}</pre>
              </div>

              {/* O — Offset (ShiftNibbles) */}
              {'afterShift' in current && (
                <div className="rv-line">
                  <div className="rv-tag">Offset (ShiftNibbles) (O)</div>
                  <pre className="rv-block">{oneLineHex(current.afterShift)}</pre>
                </div>
              )}

              {/* N — NibbleShuffle */}
              {'afterNibble' in current && (
                <div className="rv-line">
                  <div className="rv-tag">NibbleShuffle (N)</div>
                  <pre className="rv-block">{oneLineHex(current.afterNibble)}</pre>
                </div>
              )}

              {/* A — AddRoundKey (subkey usada para XOR) */}
              <div className="rv-line">
                <div className="rv-tag">AddRoundKey (A)</div>
                <pre className="rv-block">{oneLineHex(current.subkeyHex)}</pre>
              </div>

              {/* T — Transpose (P-Box) */}
              <div className="rv-line">
                <div className="rv-tag">Transpose (P-Box) (T)</div>
                <pre className="rv-block">{oneLineHex(current.afterPermute)}</pre>
              </div>

              {/* A — AddConst (constante de ronda) */}
              {getConstHex(current) && (
                <div className="rv-line">
                  <div className="rv-tag">AddConst (Rc) (A)</div>
                  <pre className="rv-block">{oneLineHex(getConstHex(current))}</pre>
                </div>
              )}

              <div className="rv-line">
                <div className="rv-tag">State Out</div>
                <pre className="rv-block">{oneLineHex(current.stateOut)}</pre>
              </div>
            </div>
          ) : (
            <div className="rv-empty">No round selected.</div>
          )}
        </div>
      </div>
    </section>
  )
}
