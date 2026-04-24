import {
  Component, ChangeDetectionStrategy,
  signal, computed, effect, inject, OnDestroy,
} from '@angular/core';

import { Task, Project, AppConfig, DEFAULT_CONFIG, DEFAULT_PROJECTS } from './models/types';
import { PomodoroStorageService } from './services/pomodoro-storage.service';
import { KeyboardShortcutsService } from './services/keyboard-shortcuts.service';
import { ToastService } from './services/toast.service';
import { SettingsModalComponent } from './components/settings-modal/settings-modal.component';
import { ProjectsBarComponent } from './components/projects-bar/projects-bar.component';
import { AmbientSoundComponent } from './components/ambient-sound/ambient-sound.component';
import { StatsModalComponent } from './components/stats-modal/stats-modal.component';
import { KeyboardHelpModalComponent } from './components/keyboard-help-modal/keyboard-help-modal.component';
import { ToastComponent } from './components/toast/toast.component';
import { ParticlesComponent } from './components/particles/particles.component';

// ── Ring constants ─────────────────────────────────────────────────
const RING_RADIUS = 90;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ≈ 565.49

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    SettingsModalComponent,
    ProjectsBarComponent,
    AmbientSoundComponent,
    StatsModalComponent,
    KeyboardHelpModalComponent,
    ToastComponent,
    ParticlesComponent,
  ],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnDestroy {
  private readonly storage = inject(PomodoroStorageService);
  private readonly kbd     = inject(KeyboardShortcutsService);
  private readonly toast   = inject(ToastService);

  // ── Theme ────────────────────────────────────────────────────────
  theme = signal<'dark' | 'light'>(this.resolveInitialTheme());

  // ── Configuration ────────────────────────────────────────────────
  config = signal<AppConfig>({
    ...DEFAULT_CONFIG,
    ...(this.storage.loadConfig() ?? {}),
    // Ensure new field has a default if loading an old config
    enableCompletionSound: this.storage.loadConfig()?.enableCompletionSound ?? true,
  });

  private readonly durations = computed(() => ({
    pomodoro:   this.config().pomodoroTime   * 60,
    shortBreak: this.config().shortBreakTime * 60,
    longBreak:  this.config().longBreakTime  * 60,
  }));

  readonly totalDuration = computed(() => this.durations()[this.timerMode()]);

  // ── Timer ────────────────────────────────────────────────────────
  timerMode          = signal<'pomodoro' | 'shortBreak' | 'longBreak'>('pomodoro');
  isRunning          = signal(false);
  pomodorosCompleted = signal(0);
  isMuted            = signal(false);
  timeRemaining      = signal(this.config().pomodoroTime * 60);

  private timerId: ReturnType<typeof setInterval> | null = null;

  // ── Progress ring ────────────────────────────────────────────────
  readonly RING_CIRCUMFERENCE = RING_CIRCUMFERENCE;

  ringOffset = computed(() => {
    const total = this.totalDuration();
    if (total === 0) return 0;
    const pct = Math.max(0, Math.min(1, this.timeRemaining() / total));
    return RING_CIRCUMFERENCE * (1 - pct);
  });

  ringColorStart = computed(() => {
    switch (this.timerMode()) {
      case 'pomodoro':   return '#a78bfa';
      case 'shortBreak': return '#67e8f9';
      case 'longBreak':  return '#6ee7b7';
    }
  });

  ringColorEnd = computed(() => {
    switch (this.timerMode()) {
      case 'pomodoro':   return '#c4b5fd';
      case 'shortBreak': return '#a5f3fc';
      case 'longBreak':  return '#a7f3d0';
    }
  });

  // Animation triggers (toggled briefly via setTimeout)
  timerFlipping = signal(false);
  ringFlash     = signal(false);

  // ── Tasks ────────────────────────────────────────────────────────
  tasks            = signal<Task[]>(this.storage.loadTasks());
  newTaskText      = signal('');
  newTaskProjectId = signal<string | null>(null);
  activeTaskId     = signal<number | null>(null);

  // ── Projects ─────────────────────────────────────────────────────
  projects       = signal<Project[]>(this.storage.loadProjects() ?? [...DEFAULT_PROJECTS]);
  activeFilterId = signal<string | null>(null);

  // ── UI state ─────────────────────────────────────────────────────
  isSettingsOpen  = signal(false);
  isStatsOpen     = signal(false);
  isKbdHelpOpen   = signal(false);
  isFocusMode     = signal(false);

  // ── Derived ──────────────────────────────────────────────────────
  minutes       = computed(() => Math.floor(this.timeRemaining() / 60));
  seconds       = computed(() => this.timeRemaining() % 60);
  formattedTime = computed(() => `${this.padZero(this.minutes())}:${this.padZero(this.seconds())}`);
  activeTask    = computed(() => this.tasks().find(t => t.id === this.activeTaskId()));

  filteredTasks = computed(() => {
    const filter = this.activeFilterId();
    return filter ? this.tasks().filter(t => t.projectId === filter) : this.tasks();
  });

  constructor() {
    setTimeout(() => {
      this.toast.show('¡Bienvenido a PomoTimers! 🍅');
    }, 350);

    // ── Persist on change ──────────────────────────────────────────
    effect(() => { this.storage.saveTasks(this.tasks()); });
    effect(() => { this.storage.saveConfig(this.config()); });
    effect(() => { this.storage.saveProjects(this.projects()); });

    // ── Theme: toggle body class + persist ─────────────────────────
    effect(() => {
      document.body.classList.toggle('light-mode', this.theme() === 'light');
      localStorage.setItem('pomoTimer_theme', this.theme());
    });

    // ── Browser title & favicon (updates every timer tick) ─────────
    effect(() => {
      const time    = this.formattedTime();
      const running = this.isRunning();
      this.updateBrowserMeta(running, time);
    });

    // ── Keyboard shortcuts ─────────────────────────────────────────
    this.kbd.register(' ', () => {
      if (this.anyModalOpen()) return;
      this.startPauseTimer();
    });
    this.kbd.register('r', () => {
      if (this.anyModalOpen()) return;
      this.resetTimer();
    });
    this.kbd.register('1', () => {
      if (this.anyModalOpen()) return;
      this.selectMode('pomodoro');
    });
    this.kbd.register('2', () => {
      if (this.anyModalOpen()) return;
      this.selectMode('shortBreak');
    });
    this.kbd.register('3', () => {
      if (this.anyModalOpen()) return;
      this.selectMode('longBreak');
    });
    this.kbd.register('s', () => {
      this.isStatsOpen.set(false);
      this.isKbdHelpOpen.set(false);
      this.isSettingsOpen.update(v => !v);
    });
    this.kbd.register('t', () => {
      if (this.anyModalOpen()) return;
      document.getElementById('new-task-input')?.focus();
    });
    this.kbd.register('f', () => {
      if (this.anyModalOpen()) return;
      this.isFocusMode.update(v => !v);
    });
    this.kbd.register('?', () => {
      this.isSettingsOpen.set(false);
      this.isStatsOpen.set(false);
      this.isKbdHelpOpen.update(v => !v);
    });
    this.kbd.register('Escape', () => {
      if (this.isKbdHelpOpen())  { this.isKbdHelpOpen.set(false);  return; }
      if (this.isSettingsOpen()) { this.isSettingsOpen.set(false); return; }
      if (this.isStatsOpen())    { this.isStatsOpen.set(false);    return; }
      if (this.isFocusMode())    { this.isFocusMode.set(false);    return; }
    }, true);
  }

  // ── Theme ─────────────────────────────────────────────────────────
  toggleTheme(): void { this.theme.update(t => t === 'dark' ? 'light' : 'dark'); }

  private resolveInitialTheme(): 'dark' | 'light' {
    const saved = localStorage.getItem('pomoTimer_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private anyModalOpen(): boolean {
    return this.isSettingsOpen() || this.isStatsOpen() || this.isKbdHelpOpen();
  }

  // ── Browser meta (title + favicon) ────────────────────────────────
  private updateBrowserMeta(running: boolean, time: string): void {
    // Title
    document.title = running ? `${time} — PomoTimers` : '⏸ PomoTimers';

    // Keep the branded transparent favicon instead of replacing it with a
    // generated canvas icon that can look muddy on dark browser chrome.
    try {
      let link = document.getElementById('favicon-dynamic') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.id = 'favicon-dynamic';
        link.rel = 'icon';
        link.type = 'image/svg+xml';
        document.head.appendChild(link);
      }
      link.href = 'public/favicon.svg';
    } catch { /* silently ignore favicon errors */ }
  }

  // ── Animation helpers ──────────────────────────────────────────────
  private triggerTimerFlip(): void {
    this.timerFlipping.set(true);
    setTimeout(() => this.timerFlipping.set(false), 420);
  }

  private triggerRingFlash(): void {
    this.ringFlash.set(true);
    setTimeout(() => this.ringFlash.set(false), 700);
  }

  // ── System notifications ───────────────────────────────────────────
  private async requestNotificationPermission(): Promise<void> {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission().catch(() => {});
    }
  }

  private sendNotification(title: string, body?: string): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      new Notification(title, { body, icon: '/public/favicon-96x96.png', silent: true });
    } catch { /* mobile Safari may throw */ }
  }

  // ── Shared AudioContext ────────────────────────────────────────────
  // Created once on the first user gesture so it starts in 'running' state.
  // Re-using the same instance avoids the browser autoplay-policy block
  // that suspends contexts created outside a user-gesture (e.g. setInterval).
  private audioCtx: AudioContext | null = null;

  private getAudioCtx(): AudioContext | null {
    if (this.isMuted() || !this.config().enableCompletionSound) return null;
    try {
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContext();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  // ── Short UI click tones (start / pause feedback) ─────────────────
  private playUiTone(type: 'start' | 'pause'): void {
    const ctx = this.getAudioCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      // Start: short upward blip (A5). Pause: short downward blip (E5).
      osc.frequency.value = type === 'start' ? 880 : 659;
      const t = ctx.currentTime;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.18, t + 0.008);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(env); env.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.12);
    } catch {}
  }

  // ── Completion tones (Web Audio API) ──────────────────────────────
  private playCompletionTones(type: 'pomodoro' | 'break'): void {
    const ctx = this.getAudioCtx();
    if (!ctx) return;
    try {
      // Pomodoro: C5 → E5 → G5 (ascending triad, bowl-bell decay)
      // Break:    A4 → C5 (2 neutral tones)
      const notes = type === 'pomodoro'
        ? [523.25, 659.25, 783.99]
        : [440.00, 523.25];

      notes.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const osc2 = ctx.createOscillator();   // octave harmonic
        const env  = ctx.createGain();
        const env2 = ctx.createGain();

        osc.type  = 'sine'; osc.frequency.value  = freq;
        osc2.type = 'sine'; osc2.frequency.value = freq * 2;

        const t = ctx.currentTime + i * 0.48;

        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.32, t + 0.015);
        env.gain.exponentialRampToValueAtTime(0.001, t + 2.0);

        env2.gain.setValueAtTime(0, t);
        env2.gain.linearRampToValueAtTime(0.07, t + 0.015);
        env2.gain.exponentialRampToValueAtTime(0.001, t + 2.0);

        osc.connect(env);   env.connect(ctx.destination);
        osc2.connect(env2); env2.connect(ctx.destination);

        osc.start(t);  osc.stop(t + 2.0);
        osc2.start(t); osc2.stop(t + 2.0);
      });
    } catch {}
  }

  // ── Settings ─────────────────────────────────────────────────────
  openSettings(): void  { this.isSettingsOpen.set(true); }
  closeSettings(): void { this.isSettingsOpen.set(false); }

  onConfigSaved(newConfig: AppConfig): void {
    this.config.set(newConfig);
    this.pauseTimer();
    this.timeRemaining.set(this.durations()[this.timerMode()]);
    this.toast.show('Configuración guardada ✓');
  }

  // ── Stats ─────────────────────────────────────────────────────────
  openStats(): void  { this.isStatsOpen.set(true); }
  closeStats(): void { this.isStatsOpen.set(false); }

  // ── Kbd help ─────────────────────────────────────────────────────
  openKbdHelp(): void  { this.isKbdHelpOpen.set(true); }
  closeKbdHelp(): void { this.isKbdHelpOpen.set(false); }

  // ── Focus mode ────────────────────────────────────────────────────
  toggleFocusMode(): void { this.isFocusMode.update(v => !v); }

  // ── Projects ─────────────────────────────────────────────────────
  onFilterChanged(id: string | null): void { this.activeFilterId.set(id); }

  onProjectCreated(project: Project): void {
    this.projects.update(ps => [...ps, project]);
    this.toast.show(`Proyecto "${project.name}" creado ✓`);
  }

  getProject(id: string | null): Project | undefined {
    if (!id) return undefined;
    return this.projects().find(p => p.id === id);
  }

  // ── Timer ────────────────────────────────────────────────────────
  toggleMute(): void { this.isMuted.update(m => !m); }

  startPauseTimer(): void {
    if (this.isRunning()) {
      this.playUiTone('pause');
      this.pauseTimer();
    } else {
      this.playUiTone('start');
      this.startTimer();
    }
  }

  startTimer(): void {
    if (this.isRunning()) return;
    this.requestNotificationPermission();
    // Warm up the shared AudioContext while we're inside a user gesture
    // so it starts in 'running' state and can be used later from setInterval.
    this.getAudioCtx();
    this.isRunning.set(true);
    this.timerId = setInterval(() => {
      this.timeRemaining.update(t => t - 1);
      if (this.timeRemaining() <= 0) this.handleTimerEnd();
    }, 1000);
  }

  pauseTimer(): void {
    this.isRunning.set(false);
    if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
  }

  resetTimer(): void {
    this.pauseTimer();
    this.timeRemaining.set(this.durations()[this.timerMode()]);
  }

  selectMode(mode: 'pomodoro' | 'shortBreak' | 'longBreak'): void {
    this.triggerTimerFlip();
    this.timerMode.set(mode);
    this.pauseTimer();
    this.timeRemaining.set(this.durations()[mode]);
  }

  private handleTimerEnd(): void {
    this.pauseTimer();

    const wasPomodoro = this.timerMode() === 'pomodoro';

    // Completion tones
    this.playCompletionTones(wasPomodoro ? 'pomodoro' : 'break');

    // Ring flash
    this.triggerRingFlash();

    // System notification
    if (wasPomodoro) {
      const task = this.activeTask();
      this.sendNotification(
        '¡Pomodoro completado! 🍅',
        task ? `Trabajando en: ${task.text}` : undefined,
      );
    } else {
      this.sendNotification('Hora de ponerse a trabajar 💪');
    }

    // Save session
    this.storage.saveSession({
      id:        Date.now().toString(),
      date:      new Date().toISOString(),
      type:      this.timerMode(),
      completed: true,
      taskId:    this.activeTaskId() ?? undefined,
    });

    // Advance mode
    if (wasPomodoro) {
      this.pomodorosCompleted.update(c => c + 1);
      const cycle = this.config().pomodorosUntilLongBreak;
      this.selectMode(this.pomodorosCompleted() % cycle === 0 ? 'longBreak' : 'shortBreak');
    } else {
      this.selectMode('pomodoro');
    }
  }

  // ── Tasks ────────────────────────────────────────────────────────
  onNewTaskInput(e: Event): void {
    this.newTaskText.set((e.target as HTMLInputElement).value);
  }

  addTask(e: Event): void {
    e.preventDefault();
    const text = this.newTaskText().trim();
    if (!text) return;
    const task: Task = {
      id: Date.now(), text, completed: false,
      projectId: this.newTaskProjectId(),
      pomodorosEstimated: 0, pomodorosCompleted: 0,
    };
    this.tasks.update(ts => [...ts, task]);
    this.newTaskText.set('');
    if (this.activeTaskId() === null) this.setActiveTask(task.id);
    this.toast.show('Tarea añadida ✓');
  }

  toggleTaskCompletion(taskId: number): void {
    this.tasks.update(ts =>
      ts.map(t => t.id === taskId
        ? { ...t, completed: !t.completed, completedAt: !t.completed ? Date.now() : undefined }
        : t
      )
    );
  }

  deleteTask(taskId: number): void {
    this.tasks.update(ts => ts.filter(t => t.id !== taskId));
    if (this.activeTaskId() === taskId) this.activeTaskId.set(null);
  }

  setActiveTask(id: number): void        { this.activeTaskId.set(id); }
  setNewTaskProject(id: string | null): void { this.newTaskProjectId.set(id); }

  scrollToActiveTask(): void {
    const id = this.activeTaskId();
    if (!id) return;
    document.getElementById(`task-item-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── Helpers ──────────────────────────────────────────────────────
  padZero(n: number): string { return n < 10 ? `0${n}` : `${n}`; }

  ngOnDestroy(): void {
    if (this.timerId) clearInterval(this.timerId);
    this.audioCtx?.close().catch(() => {});
  }
}
