import {
  Component, ChangeDetectionStrategy,
  input, output, signal, computed, effect, inject,
} from '@angular/core';
import { Task, Project, AppConfig, Session, DEFAULT_CONFIG } from '../../models/types';
import { PomodoroStorageService } from '../../services/pomodoro-storage.service';

interface DayData {
  label: string;
  count: number;
  heightPct: number;
  isToday: boolean;
}

interface ProjectStat {
  project: Project;
  count: number;
  pct: number;
}

@Component({
  selector: 'app-stats-modal',
  standalone: true,
  templateUrl: './stats-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsModalComponent {
  private readonly storage = inject(PomodoroStorageService);

  // Inputs
  isOpen   = input<boolean>(false);
  tasks    = input<Task[]>([]);
  projects = input<Project[]>([]);
  config   = input<AppConfig>(DEFAULT_CONFIG);

  // Output
  modalClosed = output<void>();

  // Loaded fresh when modal opens
  private history = signal<Session[]>([]);

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.history.set(this.storage.loadHistory());
      }
    });
  }

  close(): void { this.modalClosed.emit(); }

  // ── Helpers ──────────────────────────────────────────────────────

  private todayStart(): number {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  private dayKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  // ── Today summary ────────────────────────────────────────────────

  pomodorosToday = computed(() => {
    const start = this.todayStart();
    return this.history().filter(
      s => s.type === 'pomodoro' && s.completed && new Date(s.date).getTime() >= start
    ).length;
  });

  focusTimeLabel = computed(() => {
    const totalMin = this.pomodorosToday() * this.config().pomodoroTime;
    if (totalMin === 0) return '—';
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} m`;
  });

  tasksCompletedToday = computed(() => {
    const start = this.todayStart();
    return this.tasks().filter(t => t.completed && (t.completedAt ?? 0) >= start).length;
  });

  streak = computed(() => {
    const pomodoroDates = new Set(
      this.history()
        .filter(s => s.type === 'pomodoro' && s.completed)
        .map(s => this.dayKey(new Date(s.date)))
    );

    const today = new Date();
    const hasToday = pomodoroDates.has(this.dayKey(today));
    let streak = 0;

    for (let i = hasToday ? 0 : 1; ; i++) {
      const day = new Date(today);
      day.setDate(day.getDate() - i);
      if (pomodoroDates.has(this.dayKey(day))) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  });

  // ── Weekly chart ─────────────────────────────────────────────────

  weeklyChartData = computed((): DayData[] => {
    const history = this.history();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    const days: DayData[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = today.getTime() - i * 86_400_000;
      const dayEnd   = dayStart + 86_400_000;
      const count    = history.filter(s => {
        const t = new Date(s.date).getTime();
        return s.type === 'pomodoro' && s.completed && t >= dayStart && t < dayEnd;
      }).length;
      const dow = new Date(dayStart).getDay();
      days.push({ label: DAY_LABELS[dow], count, heightPct: 0, isToday: i === 0 });
    }

    const max = Math.max(...days.map(d => d.count), 1);
    return days.map(d => ({
      ...d,
      heightPct: d.count === 0 ? 0 : Math.max(6, Math.round((d.count / max) * 100)),
    }));
  });

  // ── Project breakdown ────────────────────────────────────────────

  projectStats = computed((): ProjectStat[] => {
    const taskMap = new Map(this.tasks().map(t => [t.id, t.projectId]));
    const counts  = new Map<string, number>();

    for (const s of this.history()) {
      if (s.type !== 'pomodoro' || !s.completed) continue;
      const pid = s.taskId ? (taskMap.get(s.taskId) ?? '__none__') : '__none__';
      counts.set(pid, (counts.get(pid) ?? 0) + 1);
    }

    const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
    const maxCount = Math.max(...[...counts.values()], 1);

    return this.projects()
      .map(p => ({
        project: p,
        count:  counts.get(p.id) ?? 0,
        pct:    Math.round(((counts.get(p.id) ?? 0) / maxCount) * 100),
      }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count);
  });

  // ── Recent history ────────────────────────────────────────────────

  recentSessions = computed(() =>
    [...this.history()]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)
  );

  formatDate(iso: string): string {
    const d = new Date(iso);
    const isToday = d.toDateString() === new Date().toDateString();
    const time = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Hoy ${time}`;
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) + ' · ' + time;
  }

  typeLabel(type: string): string {
    const map: Record<string, string> = {
      pomodoro:   '🍅 Pomodoro',
      shortBreak: '☕ Desc. corto',
      longBreak:  '🌙 Desc. largo',
    };
    return map[type] ?? type;
  }

  durationLabel(type: string): string {
    const c = this.config();
    const map: Record<string, number> = {
      pomodoro:   c.pomodoroTime,
      shortBreak: c.shortBreakTime,
      longBreak:  c.longBreakTime,
    };
    return map[type] !== undefined ? `${map[type]} min` : '—';
  }

  hasData = computed(() => this.history().length > 0);
}
