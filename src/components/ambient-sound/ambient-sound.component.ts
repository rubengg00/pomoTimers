import {
  Component, ChangeDetectionStrategy, OnDestroy, inject, signal, effect,
  ElementRef, HostListener,
} from '@angular/core';
import { PomodoroStorageService } from '../../services/pomodoro-storage.service';

export type SoundId = 'rain' | 'cafe' | 'forest' | 'waves' | 'fireplace' | 'whitenoise';

interface Sound {
  id: SoundId;
  name: string;
  icon: string;
}

export const SOUNDS: Sound[] = [
  { id: 'rain',       name: 'Lluvia',      icon: '☔' },
  { id: 'cafe',       name: 'Café',        icon: '☕' },
  { id: 'forest',     name: 'Bosque',      icon: '🌿' },
  { id: 'waves',      name: 'Olas',        icon: '🌊' },
  { id: 'fireplace',  name: 'Chimenea',    icon: '🔥' },
  { id: 'whitenoise', name: 'White noise', icon: '◻' },
];

@Component({
  selector: 'app-ambient-sound',
  standalone: true,
  templateUrl: './ambient-sound.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmbientSoundComponent implements OnDestroy {
  private readonly storage = inject(PomodoroStorageService);
  private readonly el      = inject(ElementRef);

  readonly sounds = SOUNDS;

  // UI state
  isExpanded  = signal(false);
  activeSound = signal<SoundId | null>(null);
  volume      = signal(60);

  // Audio engine
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: (AudioBufferSourceNode | OscillatorNode)[] = [];
  private activeIntervals: ReturnType<typeof setInterval>[] = [];

  constructor() {
    // Restore persisted state (sound ID + volume, but do NOT auto-play)
    const saved = this.storage.loadAmbientState();
    if (saved) {
      this.volume.set(saved.volume);
      this.activeSound.set(saved.activeSound as SoundId | null);
    }

    // Persist whenever state changes
    effect(() => {
      this.storage.saveAmbientState({
        activeSound: this.activeSound(),
        volume: this.volume(),
      });
    });
  }

  // ── Close panel when clicking outside the component ──────────────
  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: HTMLElement): void {
    if (!this.isExpanded()) return;
    if (!this.el.nativeElement.contains(target)) {
      this.isExpanded.set(false);
    }
  }

  // ── UI actions ────────────────────────────────────────────────────

  toggleExpand(): void {
    this.isExpanded.update(v => !v);
  }

  toggleSound(id: SoundId): void {
    if (this.activeSound() === id) {
      this.stopSound();
      this.activeSound.set(null);
    } else {
      this.activeSound.set(id);
      this.startSound(id);
    }
  }

  onVolumeChange(e: Event): void {
    const v = +(e.target as HTMLInputElement).value;
    this.volume.set(v);
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(v / 100, this.ctx!.currentTime, 0.02);
    }
  }

  // ── Audio engine ──────────────────────────────────────────────────

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume() / 100;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private stopSound(): void {
    for (const n of this.activeNodes) {
      try { n.stop(); } catch {}
      try { n.disconnect(); } catch {}
    }
    for (const id of this.activeIntervals) {
      clearInterval(id);
    }
    this.activeNodes = [];
    this.activeIntervals = [];
  }

  private startSound(id: SoundId): void {
    this.stopSound();
    const ctx = this.getCtx();

    switch (id) {
      case 'rain':       this.buildRain(ctx);       break;
      case 'cafe':       this.buildCafe(ctx);       break;
      case 'forest':     this.buildForest(ctx);     break;
      case 'waves':      this.buildWaves(ctx);      break;
      case 'fireplace':  this.buildFireplace(ctx);  break;
      case 'whitenoise': this.buildWhiteNoise(ctx); break;
    }
  }

  // ── Noise helpers ─────────────────────────────────────────────────

  private makeWhiteNoiseBuffer(ctx: AudioContext, seconds = 3): AudioBuffer {
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  private makeBrownNoiseBuffer(ctx: AudioContext, seconds = 3): AudioBuffer {
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        d[i] = (last + 0.02 * w) / 1.02;
        last = d[i];
        d[i] *= 3.5;
      }
    }
    return buf;
  }

  private loopSource(ctx: AudioContext, buf: AudioBuffer): AudioBufferSourceNode {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  // ── Sound builders ────────────────────────────────────────────────

  /** Rain: two layers of white noise — low pattering + high-freq sparkle */
  private buildRain(ctx: AudioContext): void {
    const out = this.masterGain!;

    // Layer 1 — heavy drops hitting surface
    const src1 = this.loopSource(ctx, this.makeWhiteNoiseBuffer(ctx, 4));
    const lp1 = ctx.createBiquadFilter();
    lp1.type = 'lowpass'; lp1.frequency.value = 900; lp1.Q.value = 0.3;
    const g1 = ctx.createGain(); g1.gain.value = 0.75;
    src1.connect(lp1); lp1.connect(g1); g1.connect(out);
    src1.start();
    this.activeNodes.push(src1);

    // Layer 2 — fine high-frequency rain sparkle
    const src2 = this.loopSource(ctx, this.makeWhiteNoiseBuffer(ctx, 2));
    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass'; bp2.frequency.value = 5000; bp2.Q.value = 1.2;
    const g2 = ctx.createGain(); g2.gain.value = 0.22;
    src2.connect(bp2); bp2.connect(g2); g2.connect(out);
    src2.start();
    this.activeNodes.push(src2);

    // Slow AM on layer 1 to simulate intensity variation
    const lfo = ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.12;
    lfo.connect(lfoG); lfoG.connect(g1.gain);
    lfo.start();
    this.activeNodes.push(lfo);
  }

  /** Café: brown noise murmur + detuned low oscillators with slow AM */
  private buildCafe(ctx: AudioContext): void {
    const out = this.masterGain!;

    // Background murmur
    const src = this.loopSource(ctx, this.makeBrownNoiseBuffer(ctx, 4));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 350;
    const g = ctx.createGain(); g.gain.value = 0.55;
    src.connect(lp); lp.connect(g); g.connect(out);
    src.start();
    this.activeNodes.push(src);

    // Three detuned oscillators that simulate distant speech cadence
    [90, 120, 155].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = freq;

      const oscLfo = ctx.createOscillator();
      oscLfo.type = 'sine'; oscLfo.frequency.value = 0.12 + i * 0.07;

      const lfoAmp = ctx.createGain(); lfoAmp.gain.value = 0.018;
      const oscGain = ctx.createGain(); oscGain.gain.value = 0.032;

      oscLfo.connect(lfoAmp); lfoAmp.connect(oscGain.gain);
      osc.connect(oscGain); oscGain.connect(out);

      osc.start(); oscLfo.start();
      this.activeNodes.push(osc, oscLfo);
    });
  }

  /** Forest: bandpass wind noise with slow swell LFO */
  private buildForest(ctx: AudioContext): void {
    const out = this.masterGain!;

    const src = this.loopSource(ctx, this.makeWhiteNoiseBuffer(ctx, 5));
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.4;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2500;
    const gWind = ctx.createGain(); gWind.gain.value = 0.55;
    src.connect(bp); bp.connect(lp); lp.connect(gWind); gWind.connect(out);
    src.start();
    this.activeNodes.push(src);

    // Wind swell
    const lfo = ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 0.06;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.18;
    lfo.connect(lfoG); lfoG.connect(gWind.gain);
    lfo.start();
    this.activeNodes.push(lfo);

    // Occasional bird chirp — triggered via setInterval
    const chirp = () => {
      if (!this.ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2400 + Math.random() * 800, now);
      osc.frequency.exponentialRampToValueAtTime(1800, now + 0.12);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.08, now + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(env); env.connect(out);
      osc.start(now); osc.stop(now + 0.15);
    };
    // Random interval: every 3–9 s
    const scheduleChirp = () => {
      const delay = 3000 + Math.random() * 6000;
      const id = setTimeout(() => { chirp(); scheduleChirp(); }, delay);
      this.activeIntervals.push(id as unknown as ReturnType<typeof setInterval>);
    };
    scheduleChirp();
  }

  /** Waves: slow-swell LFO shaping filtered brown noise */
  private buildWaves(ctx: AudioContext): void {
    const out = this.masterGain!;

    const src = this.loopSource(ctx, this.makeBrownNoiseBuffer(ctx, 6));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 500;
    const g = ctx.createGain(); g.gain.value = 0.6;
    src.connect(lp); lp.connect(g); g.connect(out);
    src.start();
    this.activeNodes.push(src);

    // Primary wave swell (~8 s)
    const lfo1 = ctx.createOscillator();
    lfo1.type = 'sine'; lfo1.frequency.value = 0.12;
    const lfo1G = ctx.createGain(); lfo1G.gain.value = 0.35;
    lfo1.connect(lfo1G); lfo1G.connect(g.gain);
    lfo1.start();
    this.activeNodes.push(lfo1);

    // Secondary swell at different phase
    const lfo2 = ctx.createOscillator();
    lfo2.type = 'sine'; lfo2.frequency.value = 0.07;
    const lfo2G = ctx.createGain(); lfo2G.gain.value = 0.15;
    lfo2.connect(lfo2G); lfo2G.connect(g.gain);
    lfo2.start();
    this.activeNodes.push(lfo2);

    // Distant crash — high-pass filtered white noise with slow AM
    const src2 = this.loopSource(ctx, this.makeWhiteNoiseBuffer(ctx, 3));
    const hp2 = ctx.createBiquadFilter();
    hp2.type = 'highpass'; hp2.frequency.value = 2000;
    const g2 = ctx.createGain(); g2.gain.value = 0.08;
    src2.connect(hp2); hp2.connect(g2); g2.connect(out);
    src2.start();
    this.activeNodes.push(src2);

    const lfo3 = ctx.createOscillator();
    lfo3.type = 'sine'; lfo3.frequency.value = 0.12;
    const lfo3G = ctx.createGain(); lfo3G.gain.value = 0.07;
    lfo3.connect(lfo3G); lfo3G.connect(g2.gain);
    lfo3.start();
    this.activeNodes.push(lfo3);
  }

  /** Fireplace: crackle (shaped white noise) + low rumble (brown) */
  private buildFireplace(ctx: AudioContext): void {
    const out = this.masterGain!;

    // Low rumble
    const rumble = this.loopSource(ctx, this.makeBrownNoiseBuffer(ctx, 4));
    const rumbleLp = ctx.createBiquadFilter();
    rumbleLp.type = 'lowpass'; rumbleLp.frequency.value = 150;
    const rumbleG = ctx.createGain(); rumbleG.gain.value = 0.65;
    rumble.connect(rumbleLp); rumbleLp.connect(rumbleG); rumbleG.connect(out);
    rumble.start();
    this.activeNodes.push(rumble);

    // Crackle layer — white noise through highpass + peaking
    const crack = this.loopSource(ctx, this.makeWhiteNoiseBuffer(ctx, 2));
    const crackHp = ctx.createBiquadFilter();
    crackHp.type = 'highpass'; crackHp.frequency.value = 300;
    const crackPeak = ctx.createBiquadFilter();
    crackPeak.type = 'peaking'; crackPeak.frequency.value = 900;
    crackPeak.gain.value = 14; crackPeak.Q.value = 1.5;
    const crackG = ctx.createGain(); crackG.gain.value = 0.14;
    crack.connect(crackHp); crackHp.connect(crackPeak);
    crackPeak.connect(crackG); crackG.connect(out);
    crack.start();
    this.activeNodes.push(crack);

    // Random crackle bursts
    const burst = () => {
      if (!this.ctx) return;
      const now = ctx.currentTime;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.28 + Math.random() * 0.18, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.08 + Math.random() * 0.05);
      crackG.connect(g); g.connect(out);
      setTimeout(() => { try { g.disconnect(); } catch {} }, 200);
    };
    const scheduleBurst = () => {
      const delay = 400 + Math.random() * 1800;
      const id = setTimeout(() => { burst(); scheduleBurst(); }, delay);
      this.activeIntervals.push(id as unknown as ReturnType<typeof setInterval>);
    };
    scheduleBurst();
  }

  /** White noise: gentle lowpass-filtered white noise */
  private buildWhiteNoise(ctx: AudioContext): void {
    const out = this.masterGain!;
    const src = this.loopSource(ctx, this.makeWhiteNoiseBuffer(ctx, 3));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 6000;
    const g = ctx.createGain(); g.gain.value = 0.7;
    src.connect(lp); lp.connect(g); g.connect(out);
    src.start();
    this.activeNodes.push(src);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  ngOnDestroy(): void {
    this.stopSound();
    this.ctx?.close();
  }
}
