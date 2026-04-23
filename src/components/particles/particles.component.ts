import {
  Component, ChangeDetectionStrategy,
  ElementRef, ViewChild, AfterViewInit, OnDestroy, input,
} from '@angular/core';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  opacity: number;
  color: string;
}

const COLORS = ['#a78bfa', '#67e8f9', '#6ee7b7'];
const COUNT  = 18;

@Component({
  selector: 'app-particles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;"></canvas>`,
})
export class ParticlesComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  /** Pass theme signal so the particles know whether to be visible in light mode */
  theme = input<'dark' | 'light'>('dark');

  private particles: Particle[] = [];
  private ctx!: CanvasRenderingContext2D;
  private animId = 0;
  private resizeObserver!: ResizeObserver;

  ngAfterViewInit(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;

    this.fitCanvas(canvas);
    this.initParticles(canvas);
    this.loop();

    this.resizeObserver = new ResizeObserver(() => {
      this.fitCanvas(canvas);
      // Re-position particles within new bounds
      const { width, height } = canvas;
      for (const p of this.particles) {
        p.x = Math.min(p.x, width);
        p.y = Math.min(p.y, height);
      }
    });
    this.resizeObserver.observe(document.body);
  }

  private fitCanvas(canvas: HTMLCanvasElement): void {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  private initParticles(canvas: HTMLCanvasElement): void {
    this.particles = Array.from({ length: COUNT }, () => ({
      x:       Math.random() * canvas.width,
      y:       Math.random() * canvas.height,
      vx:      (Math.random() - 0.5) * 0.18,
      vy:      (Math.random() - 0.5) * 0.18,
      radius:  0.8 + Math.random() * 2.2,
      opacity: 0.02 + Math.random() * 0.04,
      color:   COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
  }

  private loop(): void {
    const canvas = this.canvasRef.nativeElement;
    const { width, height } = canvas;

    this.ctx.clearRect(0, 0, width, height);

    // Reduce opacity in light mode
    const opacityScale = this.theme() === 'light' ? 0.5 : 1;

    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around
      if (p.x < -4)          p.x = width  + 4;
      if (p.x > width  + 4)  p.x = -4;
      if (p.y < -4)          p.y = height + 4;
      if (p.y > height + 4)  p.y = -4;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.opacity * opacityScale;
      this.ctx.fill();
    }

    this.ctx.globalAlpha = 1;
    this.animId = requestAnimationFrame(() => this.loop());
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animId);
    this.resizeObserver?.disconnect();
  }
}
