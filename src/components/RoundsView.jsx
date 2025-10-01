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

  // === NUEVO: una sola línea (bytes separados por espacio, sin saltos)
  function oneLineHex(hex) {
    const s = (hex || '').replace(/\s+/g, '').toLowerCase()
    const bytes = s.match(/.{1,2}/g) || []
    return bytes.join(' ')
  }

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

        {/* Panel central simple */}
        <div className="rv-main">
          <div className="rv-badge">Round #{(onSelect ? active : localActive) + 1}</div>

          {current ? (
            <div className="rv-lines">
              <div className="rv-line">
                <div className="rv-tag">State In</div>
                <pre className="rv-block">{oneLineHex(current.stateIn)}</pre>
              </div>

              <div className="rv-line">
                <div className="rv-tag">S-Box → After SubBytes</div>
                <pre className="rv-block">{oneLineHex(current.afterSubBytes)}</pre>
              </div>

              {'afterShift' in current && (
                <div className="rv-line">
                  <div className="rv-tag">ShiftNibbles → After Shift</div>
                  <pre className="rv-block">{oneLineHex(current.afterShift)}</pre>
                </div>
              )}

              <div className="rv-line">
                <div className="rv-tag">P-Box → After PermuteBits</div>
                <pre className="rv-block">{oneLineHex(current.afterPermute)}</pre>
              </div>

              <div className="rv-line">
                <div className="rv-tag">XOR Subkey → Subkey</div>
                <pre className="rv-block">{oneLineHex(current.subkeyHex)}</pre>
              </div>

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
