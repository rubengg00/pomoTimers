import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { Project } from '../../models/types';

const PRESET_COLORS = [
  '#a78bfa', '#67e8f9', '#fbbf24', '#34d399',
  '#f87171', '#fb923c', '#a3e635', '#e879f9',
];

@Component({
  selector: 'app-projects-bar',
  standalone: true,
  templateUrl: './projects-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsBarComponent {
  // Inputs
  projects     = input<Project[]>([]);
  activeFilter = input<string | null>(null);

  // Outputs
  filterChanged   = output<string | null>();
  projectCreated  = output<Project>();

  // New-project form state
  showForm     = signal(false);
  newName      = signal('');
  newColor     = signal(PRESET_COLORS[0]);
  newIcon      = signal('📁');

  readonly presetColors = PRESET_COLORS;

  selectFilter(id: string | null): void {
    this.filterChanged.emit(id);
  }

  toggleForm(): void {
    this.showForm.update(v => !v);
    if (!this.showForm()) {
      this.newName.set('');
      this.newColor.set(PRESET_COLORS[0]);
      this.newIcon.set('📁');
    }
  }

  onNameInput(e: Event): void {
    this.newName.set((e.target as HTMLInputElement).value);
  }

  onIconInput(e: Event): void {
    this.newIcon.set((e.target as HTMLInputElement).value);
  }

  selectColor(color: string): void {
    this.newColor.set(color);
  }

  createProject(): void {
    const name = this.newName().trim();
    if (!name) return;
    const project: Project = {
      id: Date.now().toString(),
      name,
      color: this.newColor(),
      icon: this.newIcon() || '📁',
    };
    this.projectCreated.emit(project);
    this.showForm.set(false);
    this.newName.set('');
    this.newColor.set(PRESET_COLORS[0]);
    this.newIcon.set('📁');
  }

  onFormKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.createProject();
    if (e.key === 'Escape') this.toggleForm();
  }
}
