import { Injectable, OnDestroy } from '@angular/core';

interface ShortcutEntry {
  handler: () => void;
  /** When true, fires even while the user is typing inside an input/textarea */
  alwaysActive: boolean;
}

/**
 * Central registry for keyboard shortcuts.
 *
 * HOW TO ADD A NEW SHORTCUT
 * ─────────────────────────
 * 1. Inject KeyboardShortcutsService wherever the action lives (usually AppComponent).
 * 2. Call `this.kbd.register(key, handler)` in the constructor.
 *    - `key`     → the value of `KeyboardEvent.key` (e.g. ' ', 'r', '?', 'Escape').
 *    - `handler` → zero-argument callback.
 *    - Pass `true` as the third argument if the shortcut should fire even when the
 *      user is typing in an <input> or <textarea> (e.g. Escape to close a modal).
 * 3. To remove it, call `this.kbd.unregister(key)`.
 *
 * The service attaches a single `keydown` listener to `document` and routes events
 * through the registry — no listener proliferation.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardShortcutsService implements OnDestroy {
  private readonly shortcuts = new Map<string, ShortcutEntry>();
  private readonly onKeydown: (e: KeyboardEvent) => void;

  constructor() {
    this.onKeydown = (e: KeyboardEvent) => {
      // Ignore modifier-combo shortcuts (Ctrl, Alt, Meta)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      const entry = this.shortcuts.get(e.key);
      if (!entry) return;
      if (isTyping && !entry.alwaysActive) return;

      e.preventDefault();
      entry.handler();
    };

    document.addEventListener('keydown', this.onKeydown);
  }

  /**
   * Register a shortcut.
   * @param key          KeyboardEvent.key value (case-sensitive: 'r', ' ', '?', 'Escape')
   * @param handler      Callback to invoke
   * @param alwaysActive Fire even when an input/textarea is focused (default: false)
   */
  register(key: string, handler: () => void, alwaysActive = false): void {
    this.shortcuts.set(key, { handler, alwaysActive });
  }

  unregister(key: string): void {
    this.shortcuts.delete(key);
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.onKeydown);
  }
}
