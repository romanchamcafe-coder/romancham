// Lightweight, dependency-free toast pub/sub.
export type ToastTone = "success" | "error" | "info";
export type ToastMsg = { id: number; text: string; tone: ToastTone };
type Listener = (t: ToastMsg) => void;

const listeners = new Set<Listener>();
let counter = 0;

export function toast(text: string, tone: ToastTone = "success") {
  const msg: ToastMsg = { id: ++counter, text, tone };
  listeners.forEach((l) => l(msg));
}

export function subscribeToast(l: Listener) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
