import { w as writable } from "./exports.js";
const DEFAULT_DURATION = 4e3;
function createToastStore() {
  const { subscribe, update, set } = writable([]);
  const timers = /* @__PURE__ */ new Map();
  let seq = 0;
  function clearTimer(id) {
    const timer = timers.get(id);
    if (timer !== void 0) {
      clearTimeout(timer);
      timers.delete(id);
    }
  }
  function dismiss(id) {
    clearTimer(id);
    update((toasts2) => toasts2.filter((t) => t.id !== id));
  }
  function push(tone, message, options) {
    seq += 1;
    const id = `toast-${seq}`;
    const duration = options.duration ?? DEFAULT_DURATION;
    const toast = { id, tone, message, duration };
    update((toasts2) => [...toasts2, toast]);
    if (duration > 0) {
      timers.set(
        id,
        setTimeout(() => dismiss(id), duration)
      );
    }
    return id;
  }
  function clear() {
    for (const id of timers.keys()) {
      clearTimer(id);
    }
    set([]);
  }
  return {
    subscribe,
    success: (message, options = {}) => push("success", message, options),
    error: (message, options = {}) => push("error", message, options),
    info: (message, options = {}) => push("info", message, options),
    dismiss,
    clear
  };
}
const toasts = createToastStore();
export {
  toasts as t
};
