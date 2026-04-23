export interface Task {
  id: number;
  text: string;
  completed: boolean;
  completedAt?: number;          // timestamp ms — set on completion, cleared on un-completion
  projectId: string | null;
  pomodorosEstimated: number;
  pomodorosCompleted: number;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface AppConfig {
  pomodoroTime: number;
  shortBreakTime: number;
  longBreakTime: number;
  pomodorosUntilLongBreak: number;
  enableCompletionSound: boolean;
}

export interface Session {
  id: string;
  date: string;
  type: 'pomodoro' | 'shortBreak' | 'longBreak';
  completed: boolean;
  taskId?: number;
}

export interface AmbientState {
  activeSound: string | null;
  volume: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  pomodoroTime: 25,
  shortBreakTime: 5,
  longBreakTime: 15,
  pomodorosUntilLongBreak: 4,
  enableCompletionSound: true,
};

export const DEFAULT_PROJECTS: Project[] = [
  { id: 'personal', name: 'Personal', color: '#a78bfa', icon: '🌟' },
  { id: 'trabajo',  name: 'Trabajo',  color: '#67e8f9', icon: '💼' },
  { id: 'estudio',  name: 'Estudio',  color: '#fbbf24', icon: '📚' },
];
