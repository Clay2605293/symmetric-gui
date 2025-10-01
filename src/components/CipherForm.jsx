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

  const handleChange = (field) => (e) => onChange?.({ [field]: e.target.value })
  const handleRoundsChange = (e) => onChange?.({ rounds: +e.target.value }) // importante: número

  const toggleShowKey = () => { setShowKey(v => !v); setTimeout(() => keyInputRef.current?.focus(), 0) }

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
          <h2>The Sound of Safety</h2>
          <p>Substitute • Offset • NibbleShuffle • AddRoundKey • Transpose • AddConst</p>
        </div>

        {/* Toggle Encrypt/Decrypt */}
        <div className="cf-mode">
          <button
            type="button"
            className={`cf-switch ${direction}`}
            onClick={() => !busy && onSwap?.()}
            disabled={busy}
            aria-label="Switch Encrypt / Decrypt"
          >
            <span className="cf-switch-opt left">Encrypt</span>
            <span className="cf-switch-opt right">Decrypt</span>
            <span className="cf-switch-knob" />
          </button>

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

        {/* Encoding */}
        <div className="cf-field">
          <label className="cf-label" htmlFor="encoding">Encoding</label>
          {direction === 'decrypt' ? (
            <>
              {/* Igual que IV: input solo lectura */}
              <input
                id="encoding"
                className="cf-input ro"
                value={encoding}
                readOnly
                spellCheck={false}
              />
              <div className="cf-hint">
                <span>Detectado automáticamente (link/entrada).</span>
              </div>
            </>
          ) : (
            <>
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
              <div className="cf-hint"><span>Re-encodeamos el output automáticamente.</span></div>
            </>
          )}
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

        {/* Rounds: sólo en ENCRYPT */}
        {direction === 'encrypt' && (
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
                value={value.rounds}
                onChange={handleRoundsChange}
                disabled={busy}
              />
              <span className="cf-badge">{value.rounds}</span>
            </div>
            <div className="cf-hint"><span>Más rondas ⇒ más difusión.</span></div>
          </div>
        )}
      </div>

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
