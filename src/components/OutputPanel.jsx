import { useMemo } from 'react'
import './OutputPanel.css'

/**
 * Props:
 * - direction: 'encrypt' | 'decrypt'
 * - label: 'Ciphertext' | 'Decrypted'
 * - value: string
 * - encoding: 'hex' | 'base64'
 * - busy: boolean
 * - onChange: (patch) => void   // se usa para limpiar (Clear)
 */
export default function OutputPanel({
  direction,
  label,
  value,
  encoding = 'hex',
  busy = false,
  onChange,
}) {
  const pretty = useMemo(() => {
    if (!(direction === 'encrypt' && encoding === 'hex')) return value || ''
    const s = (value || '').replace(/\s+/g, '').toLowerCase()
    const bytes = s.match(/.{1,2}/g) || []
    return bytes
      .map((b, i) => ((i + 1) % 16 === 0 ? b + '\n' : b))
      .join(' ')
      .replace(/\s+\n/g, '\n')
      .trim()
  }, [value, direction, encoding])

  const stats = useMemo(() => {
    const chars = (value || '').length
    const lines = (value || '').split('\n').length
    const bytes = (direction === 'encrypt' && encoding === 'hex')
      ? Math.ceil(((value || '').replace(/\s+/g, '').length || 0) / 2)
      : null
    return { chars, lines, bytes }
  }, [value, direction, encoding])

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(value || '') } catch {}
  }

  const handleClear = () => {
    if (direction === 'encrypt') onChange?.({ ciphertext: '' })
    else onChange?.({ decrypted: '' })
  }

  const handleDownload = () => {
    const blob = new Blob([value || ''], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${label.toLowerCase()}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section className="op-card">
      <header className="op-header">
        {/* Etiqueta simple (sin caja extra) */}
        <div className="op-title">{label}</div>

        <div className="op-tools">
          <button className="op-btn" onClick={handleDownload} disabled={busy || !value}>Export .txt</button>
          <button className="op-btn" onClick={handleCopy} disabled={!value || busy}>Copy</button>
          <button className="op-btn warn" onClick={handleClear} disabled={busy || !value}>Clear</button>
        </div>
      </header>

      <div className="op-body">
        <textarea
          className={`op-area ${direction === 'encrypt' && encoding === 'hex' ? 'mono' : ''}`}
          value={direction === 'encrypt' && encoding === 'hex' ? pretty : (value || '')}
          readOnly
          placeholder={`${label} aparecerá aquí…`}
          rows={8}
          spellCheck={false}
          disabled={busy}
        />
      </div>

      <footer className="op-footer">
        <span className="op-stat">Lines: {stats.lines}</span>
        <span className="op-dot">•</span>
        <span className="op-stat">Chars: {stats.chars}</span>
        {stats.bytes != null && (
          <>
            <span className="op-dot">•</span>
            <span className="op-stat">Bytes: {stats.bytes}</span>
          </>
        )}
      </footer>
    </section>
  )
}
