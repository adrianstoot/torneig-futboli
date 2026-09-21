import { useSyncExternalStore } from "react";
import { initialState, type State } from "./engine/types";
import { validateState } from "./engine/tournament";
const KEY = "futboli-2027-v1",
  UNDO = KEY + "-undo",
  BACKUP = KEY + "-backup";
const listeners = new Set<() => void>();
export let recoveryError = "";
function read(): State {
  const raw = localStorage.getItem(KEY);
  if (!raw) return initialState();
  try {
    return validateState(JSON.parse(raw));
  } catch {
    throw Error(
      "La còpia principal no es pot llegir. Restaura una còpia des dels ajustos.",
    );
  }
}
let state: State;
try {
  state = read();
} catch (e) {
  state = initialState();
  recoveryError = (e as Error).message;
}
const channel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(KEY) : null;
function notify() {
  listeners.forEach((f) => f());
}
function refresh() {
  try {
    state = read();
    notify();
  } catch (e) {
    recoveryError = (e as Error).message;
    notify();
  }
}
channel?.addEventListener("message", refresh);
window.addEventListener("storage", (e) => {
  if (e.key === KEY) refresh();
});
export const useTournament = () =>
  useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => {
        listeners.delete(f);
      };
    },
    () => state,
  );
export const getState = () => state;
export async function commit(
  update: (s: State) => State,
  remember = true,
  restore = false,
) {
  const action = () => {
    if (recoveryError && !restore) throw Error(recoveryError);
    const previous = restore ? state : read();
    const next = validateState(update(structuredClone(previous)));
    next.revision = previous.revision + 1;
    try {
      if (remember) {
        const undo: State[] = JSON.parse(localStorage.getItem(UNDO) || "[]");
        localStorage.setItem(
          UNDO,
          JSON.stringify([...undo, previous].slice(-12)),
        );
        localStorage.setItem(BACKUP, JSON.stringify(previous));
      }
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      throw Error(
        "No s’ha pogut guardar. Exporta una còpia i comprova l’espai del navegador.",
      );
    }
    state = next;
    recoveryError = "";
    notify();
    channel?.postMessage(next.revision);
  };
  if (navigator.locks) await navigator.locks.request(KEY, action);
  else action();
}
export async function undo() {
  await commit((s) => {
    const history: State[] = JSON.parse(localStorage.getItem(UNDO) || "[]");
    const previous = history.pop();
    if (!previous) throw Error("No hi ha cap acció per desfer.");
    localStorage.setItem(UNDO, JSON.stringify(history));
    return { ...validateState(previous), revision: s.revision };
  }, false);
}
export async function restoreBackup() {
  const value = localStorage.getItem(BACKUP);
  if (!value) throw Error("No hi ha cap còpia automàtica.");
  await commit(() => validateState(JSON.parse(value)), false, true);
}
export function exportTournament() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `torneig-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
setInterval(() => {
  try {
    if (!recoveryError && state.teams.length)
      localStorage.setItem(KEY + "-periodic", JSON.stringify(state));
  } catch {
    /* Primary action saving reports storage failures. */
  }
}, 60000);
