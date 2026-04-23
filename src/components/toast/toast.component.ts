import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-container" aria-live="polite" aria-atomic="false">
      @for (toast of svc.toasts(); track toast.id) {
        <div class="toast-item glass-card" [class.toast-leaving]="toast.leaving">
          {{ toast.message }}
        </div>
      }
    </div>
  `,
})
export class ToastComponent {
  readonly svc = inject(ToastService);
}
