import { Injectable } from '@angular/core';
import { Task, Project, AppConfig, Session, AmbientState } from '../models/types';

const KEYS = {
  tasks:    'pomoTimer_tasks',
  config:   'pomoTimer_config',
  projects: 'pomoTimer_projects',
  history:  'pomoTimer_history',
  ambient:  'pomoTimer_ambient',
} as const;

@Injectable({ providedIn: 'root' })
export class PomodoroStorageService {

  // ── Tasks ──────────────────────────────────────────────────────────
  saveTasks(tasks: Task[]): void {
    try { localStorage.setItem(KEYS.tasks, JSON.stringify(tasks)); } catch {}
  }

  loadTasks(): Task[] {
    try {
      const raw = localStorage.getItem(KEYS.tasks);
      return raw ? (JSON.parse(raw) as Task[]) : [];
    } catch { return []; }
  }

  // ── Config ─────────────────────────────────────────────────────────
  saveConfig(config: AppConfig): void {
    try { localStorage.setItem(KEYS.config, JSON.stringify(config)); } catch {}
  }

  loadConfig(): AppConfig | null {
    try {
      const raw = localStorage.getItem(KEYS.config);
      return raw ? (JSON.parse(raw) as AppConfig) : null;
    } catch { return null; }
  }

  // ── Projects ────────────────────────────────────────────────────────
  saveProjects(projects: Project[]): void {
    try { localStorage.setItem(KEYS.projects, JSON.stringify(projects)); } catch {}
  }

  loadProjects(): Project[] | null {
    try {
      const raw = localStorage.getItem(KEYS.projects);
      return raw ? (JSON.parse(raw) as Project[]) : null;
    } catch { return null; }
  }

  // ── History ─────────────────────────────────────────────────────────
  saveSession(session: Session): void {
    try {
      const history = this.loadHistory();
      history.push(session);
      // Keep last 200 sessions
      const trimmed = history.slice(-200);
      localStorage.setItem(KEYS.history, JSON.stringify(trimmed));
    } catch {}
  }

  loadHistory(): Session[] {
    try {
      const raw = localStorage.getItem(KEYS.history);
      return raw ? (JSON.parse(raw) as Session[]) : [];
    } catch { return []; }
  }

  // ── Ambient ─────────────────────────────────────────────────────────
  saveAmbientState(state: AmbientState): void {
    try { localStorage.setItem(KEYS.ambient, JSON.stringify(state)); } catch {}
  }

  loadAmbientState(): AmbientState | null {
    try {
      const raw = localStorage.getItem(KEYS.ambient);
      return raw ? (JSON.parse(raw) as AmbientState) : null;
    } catch { return null; }
  }
}
