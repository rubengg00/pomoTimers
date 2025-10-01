import { Component, ChangeDetectionStrategy, signal, computed, effect } from '@angular/core';

interface Task {
  id: number;
  text: string;
  completed: boolean;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  // State Signals
  timerMode = signal<'pomodoro' | 'shortBreak' | 'longBreak'>('pomodoro');
  isRunning = signal(false);
  pomodorosCompleted = signal(0);
  isMuted = signal(false);
  
  private readonly pomodorosForLongBreak = 4;
  private timerId: any = null;
  
  // Audio files
  private pomodoroStartSound = new Audio('/src/assets/start.mp3');
  private timerEndSound = new Audio('/src/assets/finish.mp3');

  // Durations in seconds for testing
  private durations = {
    pomodoro: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60,
  };

  timeRemaining = signal(this.durations.pomodoro);

  // Task Management Signals
  tasks = signal<Task[]>([]);
  newTaskText = signal('');
  activeTaskId = signal<number | null>(null);

  // Derived State
  minutes = computed(() => Math.floor(this.timeRemaining() / 60));
  seconds = computed(() => this.timeRemaining() % 60);
  formattedTime = computed(() => `${this.padZero(this.minutes())}:${this.padZero(this.seconds())}`);
  activeTask = computed(() => this.tasks().find(t => t.id === this.activeTaskId()));

  constructor() {
    this.pomodoroStartSound.volume = 0.8;
    this.timerEndSound.volume = 0.6;
  }

  toggleMute(): void {
    this.isMuted.update(muted => !muted);
  }

  private playSound(sound: HTMLAudioElement): void {
    if (!this.isMuted()) {
      sound.currentTime = 0;
      sound.play().catch(err => console.error("Error playing sound:", err));
    }
  }

  startPauseTimer(): void {
    if (this.isRunning()) {
      this.pauseTimer();
    } else {
      this.startTimer();
    }
  }

  startTimer(): void {
    if (this.isRunning()) return;
    
    if (this.timerMode() === 'pomodoro') {
      this.playSound(this.pomodoroStartSound);
    }

    this.isRunning.set(true);
    this.timerId = setInterval(() => {
      this.timeRemaining.update(t => t - 1);
      if (this.timeRemaining() <= 0) {
        this.handleTimerEnd();
      }
    }, 1000);
  }

  pauseTimer(): void {
    this.isRunning.set(false);
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  resetTimer(): void {
    this.pauseTimer();
    this.timeRemaining.set(this.durations[this.timerMode()]);
  }

  selectMode(mode: 'pomodoro' | 'shortBreak' | 'longBreak'): void {
    this.timerMode.set(mode);
    this.resetTimer();
  }

  // Task Management Methods
  onNewTaskInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.newTaskText.set(target.value);
  }
  
  addTask(event: Event): void {
    event.preventDefault();
    const text = this.newTaskText().trim();
    if (text) {
      const newTask: Task = {
        id: Date.now(),
        text,
        completed: false,
      };
      this.tasks.update(tasks => [...tasks, newTask]);
      this.newTaskText.set('');
      if (this.activeTaskId() === null) {
          this.setActiveTask(newTask.id);
      }
    }
  }
  
  toggleTaskCompletion(taskId: number): void {
    this.tasks.update(tasks =>
      tasks.map(task =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
  }

  deleteTask(taskId: number): void {
    this.tasks.update(tasks => tasks.filter(task => task.id !== taskId));
    if (this.activeTaskId() === taskId) {
      this.activeTaskId.set(null);
    }
  }

  setActiveTask(taskId: number): void {
    this.activeTaskId.set(taskId);
  }

  private handleTimerEnd(): void {
    this.playSound(this.timerEndSound);
    this.pauseTimer();

    if (this.timerMode() === 'pomodoro') {
      this.pomodorosCompleted.update(c => c + 1);
      if (this.pomodorosCompleted() > 0 && this.pomodorosCompleted() % this.pomodorosForLongBreak === 0) {
        this.selectMode('longBreak');
      } else {
        this.selectMode('shortBreak');
      }
    } else {
      this.selectMode('pomodoro');
    }
  }

  private padZero(num: number): string {
    return num < 10 ? `0${num}` : `${num}`;
  }
}