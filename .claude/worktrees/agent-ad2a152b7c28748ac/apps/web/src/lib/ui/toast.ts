import { writable, type Readable } from 'svelte/store';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  readonly id: string;
  readonly tone: ToastTone;
  readonly message: string;
  /** Auto-dismiss delay in ms; 0 disables auto-dismiss. */
  readonly duration: number;
}

export interface ToastOptions {
  /** Override the auto-dismiss delay (ms). Use 0 to keep it until dismissed. */
  duration?: number;
}

export interface ToastStore extends Readable<Toast[]> {
  success(message: string, options?: ToastOptions): string;
  error(message: string, options?: ToastOptions): string;
  info(message: string, options?: ToastOptions): string;
  dismiss(id: string): void;
  clear(): void;
}

const DEFAULT_DURATION = 4000;

function createToastStore(): ToastStore {
  const { subscribe, update, set } = writable<Toast[]>([]);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let seq = 0;

  function clearTimer(id: string): void {
    const timer = timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.delete(id);
    }
  }

  function dismiss(id: string): void {
    clearTimer(id);
    update((toasts) => toasts.filter((t) => t.id !== id));
  }

  function push(tone: ToastTone, message: string, options: ToastOptions): string {
    seq += 1;
    const id = `toast-${seq}`;
    const duration = options.duration ?? DEFAULT_DURATION;
    const toast: Toast = { id, tone, message, duration };
    update((toasts) => [...toasts, toast]);
    if (duration > 0) {
      timers.set(
        id,
        setTimeout(() => dismiss(id), duration)
      );
    }
    return id;
  }

  function clear(): void {
    for (const id of timers.keys()) {
      clearTimer(id);
    }
    set([]);
  }

  return {
    subscribe,
    success: (message, options = {}) => push('success', message, options),
    error: (message, options = {}) => push('error', message, options),
    info: (message, options = {}) => push('info', message, options),
    dismiss,
    clear
  };
}

/** Global toast store — call `toasts.success('…')` from anywhere; render with `ToastContainer`. */
export const toasts: ToastStore = createToastStore();
