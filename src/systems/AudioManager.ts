export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenTimer: ReturnType<typeof setInterval> | null = null;

  // Music sequencer
  private musicGain: GainNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  private currentStep = 0;
  private static readonly BPM = 140;
  private static readonly STEP_DUR = 60 / AudioManager.BPM / 4;
  private static readonly STEPS = 16;
  private static readonly LOOKAHEAD = 0.1;
  private static readonly SCHEDULE_MS = 25;

  // Patterns: 1=kick, 2=snare, 3=hihat closed, 4=hihat open
  private static readonly DRUM: readonly number[] = [
    1, 3, 3, 3,  2, 3, 3, 3,  1, 3, 1, 3,  2, 3, 3, 4,
  ];
  // Bass: note freq or 0=rest, duration in steps
  private static readonly BASS: readonly (readonly [number, number])[] = [
    [82.4, 2], [0, 0], [0, 0], [0, 0],
    [98.0, 2], [0, 0], [0, 0], [0, 0],
    [110, 2],  [0, 0], [0, 0], [0, 0],
    [123.5, 2],[0, 0], [0, 0], [0, 0],
  ];

  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);
    this.createNoiseBuffer();
  }

  private createNoiseBuffer(): void {
    if (!this.ctx) return;
    const sr = this.ctx.sampleRate;
    const len = sr * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, sr);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  setMasterVolume(v: number): void {
    if (this.masterGain) this.masterGain.gain.value = Math.max(0, Math.min(1, v));
  }

  // --- Engine ---

  startEngine(): void {
    if (this.engineOsc || !this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.value = 50;
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    filter.Q.value = 1;
    gain.gain.value = 0.15;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start();

    this.engineOsc = osc;
    this.engineGain = gain;
    this.engineFilter = filter;
  }

  updateEngine(currentSpeed: number, topSpeed: number): void {
    if (!this.engineOsc || !this.engineFilter || !this.ctx) return;
    const ratio = Math.max(0, Math.min(1, currentSpeed / topSpeed));
    const now = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(50 + ratio * 150, now, 0.1);
    this.engineFilter.frequency.setTargetAtTime(200 + ratio * 600, now, 0.1);
  }

  stopEngine(): void {
    if (this.engineOsc) { try { this.engineOsc.stop(); } catch {} this.engineOsc.disconnect(); this.engineOsc = null; }
    if (this.engineFilter) { this.engineFilter.disconnect(); this.engineFilter = null; }
    if (this.engineGain) { this.engineGain.disconnect(); this.engineGain = null; }
  }

  // --- Siren ---

  startSiren(): void {
    if (this.sirenOsc || !this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 700;
    gain.gain.value = 0.12;
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    this.sirenOsc = osc;
    this.sirenGain = gain;

    let high = false;
    this.sirenTimer = setInterval(() => {
      if (!this.sirenOsc || !this.ctx) return;
      high = !high;
      this.sirenOsc.frequency.setTargetAtTime(high ? 900 : 700, this.ctx.currentTime, 0.02);
    }, 250);
  }

  stopSiren(): void {
    if (this.sirenTimer) { clearInterval(this.sirenTimer); this.sirenTimer = null; }
    if (this.sirenOsc) { try { this.sirenOsc.stop(); } catch {} this.sirenOsc.disconnect(); this.sirenOsc = null; }
    if (this.sirenGain) { this.sirenGain.disconnect(); this.sirenGain = null; }
  }

  // --- Music sequencer ---

  startMusic(): void {
    if (this.musicTimer || !this.ctx || !this.masterGain) return;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.1;
    this.musicGain.connect(this.masterGain);
    this.currentStep = 0;
    this.nextStepTime = this.ctx.currentTime;

    this.musicTimer = setInterval(() => {
      if (!this.ctx || !this.musicGain) return;
      while (this.nextStepTime < this.ctx.currentTime + AudioManager.LOOKAHEAD) {
        this.scheduleMusicStep(this.currentStep, this.nextStepTime);
        this.nextStepTime += AudioManager.STEP_DUR;
        this.currentStep = (this.currentStep + 1) % AudioManager.STEPS;
      }
    }, AudioManager.SCHEDULE_MS);
  }

  stopMusic(): void {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
    if (this.musicGain) { this.musicGain.disconnect(); this.musicGain = null; }
  }

  stopAll(): void {
    this.stopEngine();
    this.stopSiren();
    this.stopMusic();
  }

  private scheduleMusicStep(step: number, time: number): void {
    const drum = AudioManager.DRUM[step];
    if (drum === 1) this.musicKick(time);
    else if (drum === 2) this.musicSnare(time);
    else if (drum === 3) this.musicHihat(time, false);
    else if (drum === 4) this.musicHihat(time, true);

    const [freq, dur] = AudioManager.BASS[step];
    if (freq > 0) this.musicBass(freq, time, dur * AudioManager.STEP_DUR);
  }

  private musicKick(time: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.2);
    setTimeout(() => { try { osc.disconnect(); } catch {} }, 300);
  }

  private musicSnare(time: number): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    src.connect(hp);
    hp.connect(gain);
    gain.connect(this.musicGain);
    src.start(time);
    src.stop(time + 0.15);
    setTimeout(() => { try { src.disconnect(); } catch {} }, 250);
  }

  private musicHihat(time: number, open: boolean): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 8000;
    const gain = this.ctx.createGain();
    const decay = open ? 0.08 : 0.03;
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
    src.connect(hp);
    hp.connect(gain);
    gain.connect(this.musicGain);
    src.start(time);
    src.stop(time + decay + 0.02);
    setTimeout(() => { try { src.disconnect(); } catch {} }, 200);
  }

  private musicBass(freq: number, time: number, duration: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 350;
    lp.Q.value = 2;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.5, time + 0.01);
    gain.gain.setValueAtTime(0.5, time + duration - 0.02);
    gain.gain.linearRampToValueAtTime(0, time + duration);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + duration + 0.01);
    setTimeout(() => { try { osc.disconnect(); } catch {} }, (duration + 0.1) * 1000);
  }

  // --- One-shot sounds ---

  private playOneShot(
    build: (ctx: AudioContext, dest: GainNode, noise: AudioBuffer) => { source: AudioScheduledSourceNode; duration: number },
  ): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.ctx.state !== 'running') return;
    const { source, duration } = build(this.ctx, this.masterGain, this.noiseBuffer);
    source.start();
    source.stop(this.ctx.currentTime + duration + 0.05);
    setTimeout(() => { try { source.disconnect(); } catch {} }, (duration + 0.1) * 1000);
  }

  playCrash(): void {
    this.playOneShot((ctx, dest, noise) => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const gain = ctx.createGain();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 800;
      bp.Q.value = 1;
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      src.connect(bp);
      bp.connect(gain);
      gain.connect(dest);
      return { source: src, duration: 0.2 };
    });
  }

  playBump(): void {
    this.playOneShot((ctx, dest, noise) => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const gain = ctx.createGain();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 400;
      bp.Q.value = 1;
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      src.connect(bp);
      bp.connect(gain);
      gain.connect(dest);
      return { source: src, duration: 0.1 };
    });
  }

  playHit(): void {
    this.playOneShot((ctx, dest) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 200;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(dest);
      return { source: osc, duration: 0.15 };
    });
  }

  playMiss(): void {
    this.playOneShot((ctx, dest, noise) => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      src.connect(hp);
      hp.connect(gain);
      gain.connect(dest);
      return { source: src, duration: 0.2 };
    });
  }

  playKnockout(): void {
    this.playOneShot((ctx, dest) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.5);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(dest);
      return { source: osc, duration: 0.5 };
    });
  }

  playPickup(): void {
    this.playOneShot((ctx, dest) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 1200;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(dest);
      return { source: osc, duration: 0.3 };
    });
  }

  playEscape(): void {
    if (!this.ctx || !this.masterGain || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const dest = this.masterGain;
    const freqs = [600, 800, 1000];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.1;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(start);
      osc.stop(start + 0.25);
      setTimeout(() => { try { osc.disconnect(); } catch {} }, 400);
    });
  }

  playArrested(): void {
    this.playOneShot((ctx, dest) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.5);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(dest);
      return { source: osc, duration: 0.5 };
    });
  }

  playRaceFinish(qualified: boolean): void {
    if (!this.ctx || !this.masterGain || this.ctx.state !== 'running') return;
    if (qualified) {
      const ctx = this.ctx;
      const dest = this.masterGain;
      const freqs = [500, 700, 900, 1200];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        const start = ctx.currentTime + i * 0.15;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(start);
        osc.stop(start + 0.35);
        setTimeout(() => { try { osc.disconnect(); } catch {} }, 500);
      });
    } else {
      this.playArrested();
    }
  }

  destroy(): void {
    this.stopEngine();
    this.stopSiren();
    this.stopMusic();
    if (this.ctx) { this.ctx.close(); this.ctx = null; }
    this.masterGain = null;
    this.noiseBuffer = null;
  }
}

export const audioManager = new AudioManager();
