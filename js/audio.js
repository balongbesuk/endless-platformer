/**
     * ============================================================================
     * 3. AUDIO MODULE (js/audio.js)
     * Web Audio API Synthesizer murni tanpa aset eksternal.
     * ============================================================================
     */
    class SoundEngine {
      constructor(storage) {
        this.storage = storage;
        this.ctx = null;
        this.muted = this.storage.getMuted();
      }

      init() {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) {
            this.ctx = new AudioCtx();
          }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      }

      toggleMute() {
        this.muted = !this.muted;
        this.storage.setMuted(this.muted);
        return this.muted;
      }

      startBGM() {
        if (this.bgmRunning) return;
        this.bgmRunning = true;
        this.bgmStep = 0;
        this._playNextBGMNote();
      }

      stopBGM() {
        this.bgmRunning = false;
        if (this.bgmTimer) {
          clearTimeout(this.bgmTimer);
          this.bgmTimer = null;
        }
      }

      _playNextBGMNote() {
        if (!this.bgmRunning) return;
        if (!this.muted && this.ctx && this.ctx.state === 'running') {
          // Melodi 8-bit retro santai & riang (Pentatonik nada C/G)
          const notes = [
            261.63, 329.63, 392.00, 523.25, 392.00, 440.00, 392.00, 329.63,
            293.66, 349.23, 392.00, 440.00, 392.00, 349.23, 293.66, 261.63
          ];
          const bass = [130.81, 130.81, 164.81, 164.81, 174.61, 174.61, 196.00, 196.00];

          const idx = (this.bgmStep || 0) % notes.length;
          const bIdx = Math.floor(idx / 2) % bass.length;
          this.bgmStep = (this.bgmStep || 0) + 1;

          try {
            const now = this.ctx.currentTime;
            // Lead melodi triangle halus
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(notes[idx], now);
            gain.gain.setValueAtTime(0.018, now);
            gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.19);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.20);

            // Bassline lembut setiap 2 ketukan
            if (idx % 2 === 0) {
              const bOsc = this.ctx.createOscillator();
              const bGain = this.ctx.createGain();
              bOsc.type = 'sine';
              bOsc.frequency.setValueAtTime(bass[bIdx], now);
              bGain.gain.setValueAtTime(0.03, now);
              bGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.38);
              bOsc.connect(bGain);
              bGain.connect(this.ctx.destination);
              bOsc.start(now);
              bOsc.stop(now + 0.39);
            }
          } catch {}
        }
        this.bgmTimer = setTimeout(() => this._playNextBGMNote(), 220);
      }

      playTone(freqStart, freqEnd, duration, type = 'square', gainVal = 0.12) {
        if (this.muted || !this.ctx) return;
        try {
          const now = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freqStart, now);
          if (freqEnd !== freqStart) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
          }
          gain.gain.setValueAtTime(gainVal, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + duration);
        } catch {
          // Abaikan jika audio context belum diizinkan
        }
      }

      jump() {
        this.playTone(190, 480, 0.14, 'square', 0.1);
      }

      coin(isSpecial = false) {
        if (isSpecial) {
          this.playTone(587, 880, 0.09, 'triangle', 0.14);
          setTimeout(() => this.playTone(880, 1318, 0.16, 'triangle', 0.14), 70);
        } else {
          this.playTone(987, 1318, 0.11, 'square', 0.09);
        }
      }

      stomp() {
        this.playTone(320, 120, 0.12, 'sawtooth', 0.13);
      }

      powerup() {
        this.playTone(330, 660, 0.12, 'triangle', 0.12);
        setTimeout(() => this.playTone(660, 990, 0.15, 'triangle', 0.12), 90);
      }

      extraLife() {
        // Melodi selebrasi 1-UP 4 nada naik (E4 -> A4 -> D5 -> D6)
        this.playTone(330, 440, 0.08, 'triangle', 0.16);
        setTimeout(() => this.playTone(440, 587, 0.08, 'triangle', 0.16), 75);
        setTimeout(() => this.playTone(587, 880, 0.14, 'triangle', 0.18), 150);
        setTimeout(() => this.playTone(880, 1174, 0.22, 'triangle', 0.22), 230);
      }

      damage() {
        this.playTone(220, 75, 0.28, 'sawtooth', 0.16);
      }

      gameOver() {
        this.playTone(300, 220, 0.18, 'sawtooth', 0.14);
        setTimeout(() => this.playTone(220, 150, 0.22, 'sawtooth', 0.14), 190);
        setTimeout(() => this.playTone(150, 85, 0.35, 'sawtooth', 0.16), 400);
      }

      siren() {
        this.playTone(420, 780, 0.24, 'sawtooth', 0.13);
        setTimeout(() => this.playTone(780, 420, 0.24, 'sawtooth', 0.13), 240);
      }

      bossHit() {
        this.playTone(180, 70, 0.25, 'sawtooth', 0.18);
      }

      bossShoot() {
        this.playTone(560, 180, 0.14, 'sawtooth', 0.12);
      }

      bossSlam() {
        this.playTone(130, 45, 0.35, 'triangle', 0.28);
      }

      bossDefeat() {
        this.playTone(220, 440, 0.12, 'square', 0.15);
        setTimeout(() => this.playTone(440, 660, 0.12, 'square', 0.15), 110);
        setTimeout(() => this.playTone(660, 1100, 0.35, 'square', 0.16), 220);
      }

      uiClick() {
        this.playTone(850, 1200, 0.04, 'triangle', 0.08);
      }

      emote() {
        this.playTone(523, 784, 0.10, 'triangle', 0.15);
        setTimeout(() => this.playTone(784, 1046, 0.14, 'triangle', 0.15), 80);
      }

      land() {
        this.playTone(130, 55, 0.06, 'sine', 0.06);
      }

      grow() {
        this.playTone(330, 440, 0.08, 'triangle', 0.14);
        setTimeout(() => this.playTone(440, 587, 0.08, 'triangle', 0.14), 65);
        setTimeout(() => this.playTone(587, 880, 0.15, 'triangle', 0.15), 130);
      }

      shrink() {
        this.playTone(520, 330, 0.09, 'sawtooth', 0.12);
        setTimeout(() => this.playTone(330, 180, 0.12, 'sawtooth', 0.12), 75);
      }

      newRecord() {
        this.playTone(523.25, 523.25, 0.08, 'triangle', 0.15);
        setTimeout(() => this.playTone(659.25, 659.25, 0.08, 'triangle', 0.15), 75);
        setTimeout(() => this.playTone(783.99, 783.99, 0.09, 'triangle', 0.15), 150);
        setTimeout(() => this.playTone(1046.50, 1046.50, 0.26, 'triangle', 0.16), 235);
      }
    }

// Global window assignments for direct file:// compatibility
window.SoundEngine = SoundEngine;
