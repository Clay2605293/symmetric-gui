import { useEffect, useMemo, useState } from 'react'
import CipherForm from '../components/CipherForm'
import OutputPanel from '../components/OutputPanel'
import RoundsView from '../components/RoundsView'
import AvalancheDemo from '../components/AvalancheDemo'
import { encryptConfusionOnly, decryptConfusionOnly } from '../lib/cipher'
import '../styles/app.css'

export default function Home() {
  // ====== Config base ======
  const BLOCK_BITS = 64
  const BLOCK_BYTES = BLOCK_BITS / 8
  const KEY_BITS = 128
  const KEY_BYTES = KEY_BITS / 8

  // ====== Estado ======
  const [direction, setDirection] = useState('encrypt') // 'encrypt' | 'decrypt'
  const [form, setForm] = useState({
    plaintext: '',
    ciphertext: '',
    key: '',
    iv: '',      // CBC-only
    rounds: 8,
  })
  const [errors, setErrors] = useState({})
  const [out, setOut] = useState({
    ciphertext: '',
    decrypted: '',
    encoding: 'hex',   // 'hex' | 'base64'
    cipherBytes: null, // Uint8Array del último ciphertext (para re-encodear)
  })

  // Viewer (rondas/sbox del bloque activo)
  const [rounds, setRounds] = useState([])
  const [activeSBox, setActiveSBox] = useState(null)

  // NUEVO: trazas por bloque + selección
  const [roundsByBlock, setRoundsByBlock] = useState([]) // Array<Array<Round>>
  const [sboxesByBlock, setSboxesByBlock] = useState([]) // Array<number[]>
  const [activeBlock, setActiveBlock] = useState(0)

  // P-Box demo (solo visual)
  const demoPbox = useMemo(
    () => Array.from({ length: BLOCK_BITS }, (_, i) => (i * 3) % BLOCK_BITS),
    [BLOCK_BITS]
  )

  // ====== Helpers ======
  function utf8ToBytes(str) { return new TextEncoder().encode(str ?? '') }
  function bytesToUtf8(bytes) { try { return new TextDecoder().decode(bytes) } catch { return '' } }
  function hexToBytes(hex) {
    const s = (hex || '').replace(/\s+/g, '')
    const out = []
    for (let i = 0; i < s.length; i += 2) out.push(parseInt(s.slice(i, i + 2) || '00', 16))
    return new Uint8Array(out)
  }
  function bytesToHex(bytes) { return Array.from(bytes || []).map(b => b.toString(16).padStart(2, '0')).join('') }
  function toBase64(bytes) {
    if (!bytes) return ''
    let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b) }); return btoa(bin)
  }
  function fromBase64(b64) {
    try { const bin = atob(b64 || ''); const out = new Uint8Array(bin.length); for (let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i); return out }
    catch { return new Uint8Array() }
  }
  function padBlock(bytes, size) {
    const rem = bytes.length % size
    const padLen = rem === 0 ? size : size - rem
    const out = new Uint8Array(bytes.length + padLen)
    out.set(bytes, 0); out.fill(padLen, bytes.length)
    return out
  }
  function unpadBlock(bytes) {
    if (!bytes?.length) return new Uint8Array()
    const padLen = bytes[bytes.length - 1]
    if (padLen <= 0 || padLen > bytes.length) return bytes
    return bytes.slice(0, bytes.length - padLen)
  }
  function xorBytes(a, b) {
    const len = Math.min(a.length, b.length)
    const out = new Uint8Array(len)
    for (let i = 0; i < len; i++) out[i] = a[i] ^ b[i]
    return out
  }

  // === Random IV helpers ===
  function randomIV(bytes = BLOCK_BYTES) {
    if (globalThis.crypto?.getRandomValues) {
      const v = new Uint8Array(bytes); crypto.getRandomValues(v); return v
    }
    // Fallback (no-crypto): pseudo-random básico
    const v = new Uint8Array(bytes)
    for (let i = 0; i < bytes; i++) v[i] = (Math.random() * 256) & 0xff
    return v
  }
  function genIVHex() { return bytesToHex(randomIV(BLOCK_BYTES)) }

  // Auto-generar IV al montar (mostrar uno desde el inicio)
  useEffect(() => {
    setForm(f => (f.iv ? f : { ...f, iv: genIVHex() }))
  }, [])

  // ====== Validaciones (CBC-only) ======
  function validateAll(nextForm = form, nextOut = out, nextDirection = direction) {
    const e = {}
    if (!nextForm.key) e.key = 'Requerida'

    // En decrypt sí pedimos IV válido (en encrypt lo generamos nosotros)
    if (nextDirection === 'decrypt') {
      const need = BLOCK_BYTES * 2
      const iv = (nextForm.iv || '').replace(/\s+/g, '')
      if (!iv) e.iv = `IV requerido (${need} hex chars)`
      else if (!/^[0-9a-fA-F]+$/.test(iv) || iv.length !== need) e.iv = `IV debe ser hex de ${need} chars`
    }

    if (nextDirection === 'encrypt') {
      if (nextForm.plaintext.length > 100) e.plaintext = 'Máximo 100 caracteres'
    } else {
      const ct = (nextForm.ciphertext || '').trim()
      if (!ct) e.ciphertext = 'Ciphertext requerido'
      else if (nextOut.encoding === 'hex') {
        const s = ct.replace(/\s+/g, '')
        if (!/^[0-9a-fA-F]+$/.test(s) || s.length % 2 !== 0) e.ciphertext = 'Hex inválido (pares y [0-9a-f])'
      } else {
        try { fromBase64(ct) } catch { e.ciphertext = 'Base64 inválido' }
      }
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ====== Handlers ======
  const onFormChange = (patch) => {
    const next = { ...form, ...patch }
    setForm(next)
    validateAll(next, out, direction)
  }

  const onSwap = () => {
    setDirection(prev => (prev === 'encrypt' ? 'decrypt' : 'encrypt'))
    setForm(f => ({ ...f, plaintext: '', ciphertext: '' })) // conserva key/iv
    setOut(o => ({ ...o, ciphertext: '', decrypted: '', cipherBytes: null }))
    setRounds([])
    setActiveSBox(null)
    // limpiar navegación por bloques
    setRoundsByBlock([])
    setSboxesByBlock([])
    setActiveBlock(0)
    setErrors({})
  }

  const onClearAll = () => {
    setForm(f => ({ ...f, plaintext: '', ciphertext: '', key: '', iv: genIVHex() })) // IV nuevo
    setOut(o => ({ ...o, ciphertext: '', decrypted: '', cipherBytes: null }))
    setRounds([])
    setActiveSBox(null)
    setRoundsByBlock([])
    setSboxesByBlock([])
    setActiveBlock(0)
    setErrors({})
  }

  // Re-encodear al cambiar encoding (si tenemos bytes crudos)
  const onEncodingChange = (enc) => {
    setOut(prev => {
      if (direction === 'encrypt' && prev.cipherBytes?.length) {
        const ct = enc === 'hex' ? bytesToHex(prev.cipherBytes) : toBase64(prev.cipherBytes)
        return { ...prev, encoding: enc, ciphertext: ct }
      }
      return { ...prev, encoding: enc }
    })
  }

  // ====== Selector de bloque (viewer) ======
  const onBlockChange = (idx) => {
    const i = Math.max(0, Math.min(idx, roundsByBlock.length - 1))
    setActiveBlock(i)
    setRounds(roundsByBlock[i] || [])
    setActiveSBox(sboxesByBlock[i] || null)
  }

  // ====== Cifrar (CBC-only) ======
  const doEncrypt = () => {
    // 1) IV nuevo para ESTE mensaje
    const ivHex = genIVHex()
    setForm(f => ({ ...f, iv: ivHex })) // visible (readOnly)

    // 2) Validar (en encrypt no pedimos IV del user)
    if (!validateAll({ ...form, iv: ivHex }, out, 'encrypt')) return

    // 3) Preparar
    const keyStr = form.key || ''
    const plainBytes = utf8ToBytes(form.plaintext)
    const padded = padBlock(plainBytes, BLOCK_BYTES)
    const iv = hexToBytes(ivHex)

    const outBuf = new Uint8Array(padded.length)
    let prev = iv

    // Guardamos trazas por BLOQUE para luego fusionarlas por RONDA
    const tracesPerBlock = []
    let sboxFirst = null

    for (let o = 0; o < padded.length; o += BLOCK_BYTES) {
      const block = padded.slice(o, o + BLOCK_BYTES)
      const x = xorBytes(block, prev)

      const { ciphertext: c1, roundTraces, sbox } =
        encryptConfusionOnly(x, form.rounds, keyStr, BLOCK_BYTES)

      outBuf.set(c1, o)
      prev = c1

      tracesPerBlock.push(roundTraces)
      if (!sboxFirst) sboxFirst = sbox
    }

    // === FUSIÓN: construimos una traza por RONDA concatenando todos los bloques ===
    const mergedTraces = []
    const R = form.rounds

    for (let r = 0; r < R; r++) {
      const m = {
        idx: r,
        stateIn: '',
        afterSubBytes: '',
        afterPermute: '',
        subkeyHex: '',
        stateOut: '',
        // afterShift es opcional
      }

      for (let b = 0; b < tracesPerBlock.length; b++) {
        const t = tracesPerBlock[b][r]
        if (!t) continue
        m.stateIn       += (t.stateIn || '')
        m.afterSubBytes += (t.afterSubBytes || '')
        if (typeof t.afterShift === 'string') {
          m.afterShift = (m.afterShift || '') + t.afterShift
        }
        m.afterPermute  += (t.afterPermute || '')
        // La subkey es la misma por ronda; nos quedamos con la del primer bloque
        if (!m.subkeyHex && t.subkeyHex) m.subkeyHex = t.subkeyHex
        m.stateOut      += (t.stateOut || '')
      }
      if (m.afterShift === undefined) delete m.afterShift
      mergedTraces.push(m)
    }

    // 5) Enviar al viewer: ahora ve TODO el mensaje por ronda
    setRounds(mergedTraces)
    setActiveSBox(sboxFirst)

    // 6) Output final (y guardamos bytes crudos para re-encodear)
    setOut(o => ({
      ...o,
      cipherBytes: outBuf,
      ciphertext: o.encoding === 'hex' ? bytesToHex(outBuf) : toBase64(outBuf),
    }))
  }


  // ====== Descifrar (CBC-only) ======
  const doDecrypt = () => {
    if (!validateAll(form, out, 'decrypt')) return

    const keyStr = form.key || ''
    let cipherBytes = new Uint8Array()
    if (out.encoding === 'hex') cipherBytes = hexToBytes(form.ciphertext)
    else cipherBytes = fromBase64(form.ciphertext)

    const iv = hexToBytes(form.iv)
    const outBytes = new Uint8Array(cipherBytes.length)
    let prev = iv

    for (let o = 0; o < cipherBytes.length; o += BLOCK_BYTES) {
      const cblock = cipherBytes.slice(o, o + BLOCK_BYTES)
      const { plaintext: p1 } = decryptConfusionOnly(cblock, form.rounds, keyStr)
      const p = xorBytes(p1, prev)
      outBytes.set(p, o)
      prev = cblock
    }

    const plainAll = unpadBlock(outBytes)
    setOut(o => ({ ...o, decrypted: bytesToUtf8(plainAll) }))
  }

  const onAction = () => {
    if (direction === 'encrypt') doEncrypt()
    else doDecrypt()
  }

  const onOutputChange = (patch) => setOut(prev => ({ ...prev, ...patch }))

  // ====== AvalancheDemo (CBC-only) ======
  const encryptFn = ({ plaintextHex, keyHex, ivHex, rounds }) => {
    const p = hexToBytes(plaintextHex)
    const keyStr = bytesToUtf8(hexToBytes(keyHex || ''))
    const padded = padBlock(p, BLOCK_BYTES)
    const iv = hexToBytes(ivHex || '00'.repeat(BLOCK_BYTES))
    const outArr = new Uint8Array(padded.length)
    let prev = iv
    for (let o = 0; o < padded.length; o += BLOCK_BYTES) {
      const block = padded.slice(o, o + BLOCK_BYTES)
      const x = xorBytes(block, prev)
      const { ciphertext } = encryptConfusionOnly(x, rounds, keyStr, BLOCK_BYTES)
      outArr.set(ciphertext, o)
      prev = ciphertext
    }
    return { ciphertextHex: bytesToHex(outArr) }
  }

  const cipherOptions = useMemo(() => ({
    mode: 'CBC',
    ivHex: form.iv,
    rounds: form.rounds,
  }), [form.iv, form.rounds])

  const activeOutput = direction === 'encrypt' ? out.ciphertext : out.decrypted
  const activeLabel  = direction === 'encrypt' ? 'Ciphertext' : 'Decrypted'

  return (
    <div className="app">
      <h1>Symmetric Cipher</h1>

      <CipherForm
        direction={direction}
        value={form}
        errors={errors}
        encoding={out.encoding}
        busy={false}
        onChange={onFormChange}
        onEncodingChange={onEncodingChange}
        onAction={onAction}
        onClear={onClearAll}
        onSwap={onSwap}
      />

      <OutputPanel
        direction={direction}
        encoding={out.encoding}
        value={activeOutput}
        label={activeLabel}
        busy={false}
        onChange={onOutputChange}
      />

      <RoundsView
        rounds={rounds}
        sbox={activeSBox || Array.from({ length: 16 }, (_, i) => i)}
        pbox={demoPbox}
        blockBits={BLOCK_BITS}
        active={0}
        collapsed={false}
        /* NUEVO: navegación por bloques */
        blockCount={roundsByBlock.length}
        activeBlock={activeBlock}
        onBlockChange={onBlockChange}
      />

      <AvalancheDemo
        blockBits={BLOCK_BITS}
        keyBits={KEY_BITS}
        defaultKeyHex={'00'.repeat(KEY_BYTES)}
        encryptFn={encryptFn}
        cipherOptions={cipherOptions}
      />
    </div>
  )
}
