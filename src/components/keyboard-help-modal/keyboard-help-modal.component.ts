import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

export interface ShortcutDef {
  key: string;
  label: string;
}

export const SHORTCUTS: ShortcutDef[] = [
  { key: 'Espacio',   label: 'Play / Pausa del timer' },
  { key: 'R',         label: 'Reiniciar timer' },
  { key: '1',         label: 'Cambiar a Pomodoro' },
  { key: '2',         label: 'Cambiar a Descanso corto' },
  { key: '3',         label: 'Cambiar a Descanso largo' },
  { key: 'S',         label: 'Abrir / cerrar Configuración' },
  { key: 'T',         label: 'Enfocar campo de nueva tarea' },
  { key: '?',         label: 'Mostrar / ocultar esta ayuda' },
  { key: 'Esc',       label: 'Cerrar modal activo' },
];

@Component({
  selector: 'app-keyboard-help-modal',
  standalone: true,
  templateUrl: './keyboard-help-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeyboardHelpModalComponent {
  isOpen      = input<boolean>(false);
  modalClosed = output<void>();

  readonly shortcuts = SHORTCUTS;

  close(): void { this.modalClosed.emit(); }
}
