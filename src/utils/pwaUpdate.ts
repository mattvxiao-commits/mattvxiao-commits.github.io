import { registerSW } from "virtual:pwa-register";

type UpdateReadyListener = () => void;

let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;
const updateReadyListeners = new Set<UpdateReadyListener>();

export function registerPwaUpdateHandler() {
  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      notifyUpdateReady();
    }
  });
}

export function subscribePwaUpdateReady(listener: UpdateReadyListener) {
  updateReadyListeners.add(listener);

  return () => {
    updateReadyListeners.delete(listener);
  };
}

export async function applyPwaUpdate() {
  if (!updateServiceWorker) {
    return;
  }

  await updateServiceWorker(true);
}

export function notifyPwaUpdateReadyForTest() {
  notifyUpdateReady();
}

function notifyUpdateReady() {
  updateReadyListeners.forEach((listener) => listener());
}
