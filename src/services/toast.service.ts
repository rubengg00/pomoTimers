import { Injectable, signal } from '@angular/core';

export interface ToastItem {
  id: number;
  message: string;
  leaving: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<ToastItem[]>([]);

  show(message: string): void {
    const id = Date.now();
    this.toasts.update(ts => [...ts, { id, message, leaving: false }]);

    // Start leave animation at 2s, remove at 2.5s
    setTimeout(() => {
      this.toasts.update(ts =>
        ts.map(t => t.id === id ? { ...t, leaving: true } : t)
      );
    }, 2000);

    setTimeout(() => {
      this.toasts.update(ts => ts.filter(t => t.id !== id));
    }, 2500);
  }
}
