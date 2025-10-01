import { useEffect, useMemo, useRef, useState } from 'react'
import './OutputPanel.css'
import { buildMusicUrl } from '../utils/music'
import { buildMapsUrl, getRandomLandCoords } from '../utils/geo'

export default function OutputPanel({
  direction,
  label,
  value,
  encoding = 'hex',
  busy = false,
  cipherBytes = null,
  ivHex,
  rounds,
  onChange,
}) {
  const [shareUrl, setShareUrl] = useState('')
  const [pending, setPending] = useState(false)
  const buildId = useRef(0)

  // Genera URL compartible SOLO en encrypt. En decrypt no hay URL.
  useEffect(() => {
    let canceled = false
    const id = ++buildId.current

    async function build() {
      if (direction !== 'encrypt') {
        setShareUrl('')
        setPending(false)
        return
      }

      // HEX → música
      if (encoding === 'hex' && cipherBytes && cipherBytes.length) {
        const url = buildMusicUrl({
          bytes: cipherBytes,
          bpm: 120, wave: 'square', dur: 0.28, gap: 0.05,
          ivHex, rounds,
        })
        if (!canceled && id === buildId.current) setShareUrl(url)
        return
      }

      // BASE64 → mapas
      if (encoding === 'base64' && value) {
        setPending(true)
        try {
          const { lat, lon } = await getRandomLandCoords({ timeoutMs: 1500 })
          const url = buildMapsUrl({ lat, lon, b64: value, zoom: 6, ivHex, rounds })
          if (!canceled && id === buildId.current) setShareUrl(url)
        } catch {
          if (!canceled && id === buildId.current) setShareUrl('')
        } finally {
          if (!canceled && id === buildId.current) setPending(false)
        }
        return
      }

      setShareUrl('')
    }

    build()
    return () => { canceled = true }
  }, [direction, encoding, value, cipherBytes, ivHex, rounds])

  // 🔧 AQUÍ EL CAMBIO: en decrypt mostramos el value (plaintext); en encrypt mostramos el URL
  const displayValue = direction === 'decrypt'
    ? (value || '')
    : (shareUrl || (pending ? '(generando link…)' : ''))

  const stats = useMemo(() => {
    const text = displayValue || ''
    const lines = (text.match(/\n/g) || []).length + (text ? 1 : 0)
    const chars = text.length
    const bytes =
      direction === 'encrypt' && encoding === 'hex' && cipherBytes
        ? cipherBytes.length
        : null
    return { lines, chars, bytes }
  }, [displayValue, direction, encoding, cipherBytes])

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(displayValue || '') } catch {}
  }

  const handleClear = () => {
    if (direction === 'encrypt') onChange?.({ ciphertext: '', cipherBytes: null })
    else onChange?.({ decrypted: '' })
  }

  const handleDownload = () => {
    const blob = new Blob([displayValue || ''], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${label.toLowerCase()}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function normalizePhone(input) {
    return (input || '').replace(/\D+/g, '')
  }
  const handleWhatsApp = () => {
    if (!shareUrl) return
    const num = prompt('Número (con lada país, solo dígitos). Ej: 5215512345678')
    const phone = normalizePhone(num)
    if (!phone) return
    const header =
      encoding === 'base64'
        ? 'Mira lo que me salió en GeoGuesser:'
        : 'Mira lo que compuse:'
    const msg = `${header}\n${shareUrl}`
    const link = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
    window.open(link, '_blank', 'noopener,noreferrer')
  }

  const canShare = Boolean(shareUrl) && !busy

  return (
    <section className="op-card">
      <header className="op-header">
        <div className="op-title">{label}</div>
        <div className="op-tools">
          {/* WhatsApp solo tiene sentido en encrypt (cuando hay URL) */}
          <button className="op-btn" onClick={handleWhatsApp} disabled={!canShare}>
            WhatsApp
          </button>
          <button className="op-btn" onClick={handleDownload} disabled={!displayValue || busy}>
            Export .txt
          </button>
          <button className="op-btn" onClick={handleCopy} disabled={!displayValue || busy}>
            Copy
          </button>
          <button className="op-btn warn" onClick={handleClear} disabled={busy || !displayValue}>
            Clear
          </button>
        </div>
      </header>

      <div className="op-body">
        <textarea
          className={`op-area ${direction === 'encrypt' ? 'mono' : ''}`}
          value={displayValue}
          readOnly
          placeholder={direction === 'encrypt'
            ? (pending ? '(generando link…)'
                       : 'El URL compartible aparecerá aquí…')
            : 'El texto descifrado aparecerá aquí…'}
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
        {pending && direction === 'encrypt' && (
          <>
            <span className="op-dot">•</span>
            <span className="op-hint">Preparando Maps…</span>
          </>
        )}
        {canShare && direction === 'encrypt' && (
          <>
            <span className="op-dot">•</span>
            <span className="op-hint">
              URL listo para compartir {encoding === 'base64' ? '🗺️' : '🎵'}
            </span>
          </>
        )}
      </footer>
    </section>
  )
}
