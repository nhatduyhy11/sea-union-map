import { create } from "zustand";

// Toast thông báo ngắn (góc dưới canvas), tự tắt sau TOAST_MS. Gọi qua
// showToast() từ bất kỳ đâu — không cần hook.
export type ToastKind = "info" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  dismiss: (id: number) => void;
}

const TOAST_MS = 3500;
let nextId = 1;

export const useToast = create<ToastState>()((set) => ({
  toasts: [],
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function showToast(kind: ToastKind, message: string) {
  const id = nextId++;
  useToast.setState((state) => ({
    toasts: [...state.toasts, { id, kind, message }],
  }));
  setTimeout(() => useToast.getState().dismiss(id), TOAST_MS);
}
