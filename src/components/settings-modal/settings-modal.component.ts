import { Component, ChangeDetectionStrategy, input, output, signal, effect } from '@angular/core';
import { AppConfig, DEFAULT_CONFIG } from '../../models/types';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  templateUrl: './settings-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsModalComponent {
  // Inputs
  isOpen       = input<boolean>(false);
  currentConfig = input<AppConfig>(DEFAULT_CONFIG);

  // Outputs
  configSaved  = output<AppConfig>();
  modalClosed  = output<void>();

  // Local editable copy – synced when modal opens
  local = signal<AppConfig>({ ...DEFAULT_CONFIG });

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.local.set({ ...this.currentConfig() });
      }
    });
  }

  // ── Updaters ──────────────────────────────────────────────────────
  setPomodoroTime(e: Event): void {
    const v = this.clamp(+(e.target as HTMLInputElement).value, 1, 90);
    this.local.update(c => ({ ...c, pomodoroTime: v }));
  }

  setShortBreak(e: Event): void {
    const v = this.clamp(+(e.target as HTMLInputElement).value, 1, 30);
    this.local.update(c => ({ ...c, shortBreakTime: v }));
  }

  setLongBreak(e: Event): void {
    const v = this.clamp(+(e.target as HTMLInputElement).value, 5, 60);
    this.local.update(c => ({ ...c, longBreakTime: v }));
  }

  setPomodorosUntilLong(e: Event): void {
    const v = this.clamp(+(e.target as HTMLInputElement).value, 2, 8);
    this.local.update(c => ({ ...c, pomodorosUntilLongBreak: v }));
  }

  toggleCompletionSound(): void {
    this.local.update(c => ({ ...c, enableCompletionSound: !c.enableCompletionSound }));
  }

  resetDefaults(): void {
    this.local.set({ ...DEFAULT_CONFIG });
  }

  save(): void {
    this.configSaved.emit(this.local());
    this.modalClosed.emit();
  }

  close(): void {
    this.modalClosed.emit();
  }

  private clamp(val: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, isNaN(val) ? min : val));
  }
}
