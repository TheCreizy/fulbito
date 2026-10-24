# `soundEngine.js` - Motor de Efectos de Sonido

> **Categoría:** `Audio`  
> **Ubicación:** `src/audio/soundEngine.js`  
> **Líneas de código:** 211  
> **Tamaño:** 6.33 KB

---

## 📋 Resumen del Módulo

Gestión y reproducción de audio ambiental, silbatazos, remates, festejos de gol y ambientación de estadio.

---

## 🧩 Exportaciones y Elementos Principales

- **Línea 210:** `export const soundEngine = new SoundEngine()`



---

## 💻 Código Fuente JavaScript (`soundEngine.js`)

````javascript
// Motor de Sonido Retro Sintetizado (Web Audio API - 100% sin archivos externos)
// Genera silbato del árbitro, rugido de hinchada en goles, golpe de pelota y sonido de tarjeta/cambio

class SoundEngine {
  constructor() {
    this.ctx = null
    this.muted = false
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }

  setMuted(muted) {
    this.muted = !!muted
  }

  toggleMute() {
    this.muted = !this.muted
    return this.muted
  }

  playWhistle(type = 'short') {
    if (this.muted) return
    try {
      this.init()
      if (!this.ctx) return
      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      // Modulador para el trino clásico del silbato de árbitro
      const lfo = this.ctx.createOscillator()
      const lfoGain = this.ctx.createGain()
      lfo.frequency.value = 42
      lfoGain.gain.value = 110
      lfo.connect(osc.frequency)
      lfo.start(now)

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(2850, now)

      const duration = type === 'long' ? 0.55 : (type === 'double' ? 0.42 : 0.22)
      gain.gain.setValueAtTime(0.001, now)
      gain.gain.linearRampToValueAtTime(0.11, now + 0.02)
      if (type === 'double') {
        gain.gain.setValueAtTime(0.01, now + 0.16)
        gain.gain.setValueAtTime(0.11, now + 0.21)
      }
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(now)
      osc.stop(now + duration)
      lfo.stop(now + duration)
    } catch {
      // Ignorar si el navegador bloquea autoplay antes de interacción
    }
  }

  playGoalRoar() {
    if (this.muted) return
    try {
      this.init()
      if (!this.ctx) return
      const now = this.ctx.currentTime
      const duration = 1.65

      // Ruido blanco filtrado simulando el rugido de la tribuna + fanfarria retro PC Fútbol
      const bufferSize = this.ctx.sampleRate * duration
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }

      const noise = this.ctx.createBufferSource()
      noise.buffer = buffer

      const filter = this.ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(750, now)
      filter.frequency.linearRampToValueAtTime(1250, now + 0.45)
      filter.frequency.linearRampToValueAtTime(650, now + duration)
      filter.Q.value = 1.4

      const gain = this.ctx.createGain()
      gain.gain.setValueAtTime(0.001, now)
      gain.gain.linearRampToValueAtTime(0.18, now + 0.18)
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

      noise.connect(filter)
      filter.connect(gain)
      gain.connect(this.ctx.destination)
      noise.start(now)

      // Acorde retro de gol estilo PC Fútbol 5.0
      const notes = [523.25, 659.25, 783.99, 1046.5]
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator()
        const nGain = this.ctx.createGain()
        osc.type = 'square'
        osc.frequency.setValueAtTime(freq, now + idx * 0.09)
        nGain.gain.setValueAtTime(0.055, now + idx * 0.09)
        nGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.35)
        osc.connect(nGain)
        nGain.connect(this.ctx.destination)
        osc.start(now + idx * 0.09)
        osc.stop(now + idx * 0.09 + 0.36)
      })
    } catch {
      // Ignorar errores de audio
    }
  }

  playShotKick() {
    if (this.muted) return
    try {
      this.init()
      if (!this.ctx) return
      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(150, now)
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.09)
      gain.gain.setValueAtTime(0.14, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
      osc.connect(gain)
      gain.connect(this.ctx.destination)
      osc.start(now)
      osc.stop(now + 0.095)
    } catch {}
  }

  playMenuClick(type = 'normal') {
    if (this.muted) return
    try {
      this.init()
      if (!this.ctx) return
      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'triangle'
      const freq = type === 'confirm' ? 880 : (type === 'tab' ? 520 : 660)
      osc.frequency.setValueAtTime(freq, now)
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.05)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
      osc.connect(gain)
      gain.connect(this.ctx.destination)
      osc.start(now)
      osc.stop(now + 0.085)
    } catch {}
  }

  playStaffSpeech() {
    if (this.muted) return
    try {
      this.init()
      if (!this.ctx) return
      const now = this.ctx.currentTime
      const freqs = [320, 440, 520]
      freqs.forEach((f, i) => {
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(f, now + i * 0.04)
        gain.gain.setValueAtTime(0.04, now + i * 0.04)
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.06)
        osc.connect(gain)
        gain.connect(this.ctx.destination)
        osc.start(now + i * 0.04)
        osc.stop(now + i * 0.04 + 0.065)
      })
    } catch {}
  }

  playCardBeep() {
    if (this.muted) return
    try {
      this.init()
      if (!this.ctx) return
      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.setValueAtTime(330, now + 0.1)
      gain.gain.setValueAtTime(0.07, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24)
      osc.connect(gain)
      gain.connect(this.ctx.destination)
      osc.start(now)
      osc.stop(now + 0.25)
    } catch {}
  }
}

export const soundEngine = new SoundEngine()

````

