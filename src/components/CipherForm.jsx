import { useMemo, useRef, useState } from 'react'
import './CipherForm.css'

export default function CipherForm({
  direction = 'encrypt',
  value,
  errors = {},
  encoding = 'hex',
  busy = false,
  onChange,
  onEncodingChange,
  onAction,
  onClear,
  onSwap,
}) {
  const [showKey, setShowKey] = useState(false)
  const keyInputRef = useRef(null)

  const keyStrength = useMemo(() => {
    const k = value?.key || ''
    let score = 0
    if (k.length >= 8) score += 1
    if (k.length >= 12) score += 1
    if (/[A-Z]/.test(k)) score += 1
    if (/[a-z]/.test(k)) score += 1
    if (/[0-9]/.test(k)) score += 1
    if (/[^A-Za-z0-9]/.test(k)) score += 1
    return Math.min(score, 5)
  }, [value?.key])

  const strengthLabel = ['Muy débil', 'Débil', 'OK', 'Buena', 'Fuerte', 'Excelente'][keyStrength]

  // FIX: rounds a número; demás campos como string
  const handleChange = (field) => (e) => {
    const v = e.target.value
    if (field === 'rounds') {
      const n = Math.max(4, Math.min(12, parseInt(v, 10) || 8))
      onChange?.({ rounds: n })
    } else {
      onChange?.({ [field]: v })
    }
  }

  const toggleShowKey = () => {
    setShowKey(v => !v)
    setTimeout(() => keyInputRef.current?.focus(), 0)
  }

  const mainLabel = direction === 'encrypt' ? 'Plaintext' : 'Ciphertext'
  const mainValue = direction === 'encrypt' ? value.plaintext : value.ciphertext
  const mainField = direction === 'encrypt' ? 'plaintext' : 'ciphertext'
  const mainPlaceholder =
    direction === 'encrypt'
      ? 'Escribe o pega el texto a cifrar (≤ 100 chars)'
      : 'Pega el ciphertext (hex/base64) a descifrar'

  const mainError = direction === 'encrypt' ? errors.plaintext : errors.ciphertext
  const actionLabel = direction === 'encrypt' ? 'Encrypt' : 'Decrypt'

  return (
    <section className="cf-card">
      <header className="cf-header">
        <div className="cf-title">
          <h2>Symmetric Cipher</h2>
          <p>CBC por defecto. El IV se genera automáticamente.</p>
        </div>
        <div className="cf-actions">
          {onSwap && (
            <button type="button" className="cf-btn ghost" onClick={onSwap} disabled={busy} title="Swap">
              Swap
            </button>
          )}
          {onClear && (
            <button type="button" className="cf-btn ghost" onClick={onClear} disabled={busy} title="Clear">
              Clear
            </button>
          )}
        </div>
      </header>

      <div className="cf-grid">
        {/* Campo principal */}
        <div className={`cf-field ${mainError ? 'has-error' : ''}`}>
          <label className="cf-label" htmlFor="main">{mainLabel}</label>
          <textarea
            id="main"
            className="cf-textarea"
            placeholder={mainPlaceholder}
            value={mainValue}
            onChange={handleChange(mainField)}
            maxLength={direction === 'encrypt' ? 100 : undefined}
            rows={5}
            spellCheck={false}
            disabled={busy}
          />
          <div className="cf-hint">
            <span>
              {direction === 'encrypt'
                ? `${value.plaintext.length}/100`
                : `${(value.ciphertext || '').length} chars`}
            </span>
            {mainError && <span className="cf-error">{mainError}</span>}
          </div>
        </div>

        {/* Key */}
        <div className={`cf-field ${errors.key ? 'has-error' : ''}`}>
          <label className="cf-label" htmlFor="key">Key</label>
          <div className="cf-input-wrap">
            <input
              id="key"
              ref={keyInputRef}
              className="cf-input"
              placeholder="Llave (hasta 16 chars)"
              type={showKey ? 'text' : 'password'}
              value={value.key}
              onChange={handleChange('key')}
              maxLength={16}
              spellCheck={false}
              disabled={busy}
              autoComplete="off"
            />
            <button
              type="button"
              className="cf-toggle"
              onClick={toggleShowKey}
              aria-label={showKey ? 'Hide key' : 'Show key'}
              title={showKey ? 'Hide key' : 'Show key'}
              disabled={busy}
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className="cf-hint">
            <span className={`cf-strength s${keyStrength}`}>{strengthLabel}</span>
            {errors.key && <span className="cf-error">{errors.key}</span>}
          </div>
        </div>

        {/* Encoding (hex/base64) */}
        <div className="cf-field">
          <label className="cf-label" htmlFor="encoding">Encoding</label>
          <select
            id="encoding"
            className="cf-select"
            value={encoding}
            onChange={(e) => onEncodingChange?.(e.target.value)}
            disabled={busy}
          >
            <option value="hex">hex</option>
            <option value="base64">base64</option>
          </select>
          <div className="cf-hint">
            <span>Re-encodeamos el output automáticamente.</span>
          </div>
        </div>

        {/* IV (solo lectura) */}
        <div className={`cf-field ${errors.iv ? 'has-error' : ''}`}>
          <label className="cf-label" htmlFor="iv">IV (auto)</label>
          <input
            id="iv"
            className="cf-input"
            value={value.iv}
            readOnly
            spellCheck={false}
          />
          <div className="cf-hint">
            <span>64-bit IV generado automáticamente (hex).</span>
            {errors.iv && <span className="cf-error">{errors.iv}</span>}
          </div>
        </div>

        {/* Rounds */}
        <div className="cf-field">
          <label className="cf-label" htmlFor="rounds">Rounds</label>
          <div className="cf-slider-row">
            <input
              id="rounds"
              className="cf-slider"
              type="range"
              min={4}
              max={12}
              step={1}
              value={Number(value.rounds) || 8} 
              onChange={handleChange('rounds')}
              disabled={busy}
            />
            <span className="cf-badge">{Number(value.rounds) || 8}</span>
          </div>
          <div className="cf-hint"><span>Más rondas ⇒ más difusión.</span></div>
        </div>
      </div>

      {/* Botón único */}
      <footer className="cf-footer">
        <button
          type="button"
          className="cf-btn primary"
          onClick={onAction}
          disabled={busy}
        >
          {busy ? (direction === 'encrypt' ? 'Encrypting...' : 'Decrypting...') : actionLabel}
        </button>
      </footer>
    </section>
  )
}
