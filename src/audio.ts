import { useEffect, useRef } from "react";
import type { State } from "./engine/types";

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return null;
  audioContext ??= new AudioContextClass();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

function tone(
  context: AudioContext,
  start: number,
  duration: number,
  from: number,
  to: number,
  volume: number,
  type: OscillatorType,
) {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope);
  envelope.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.01);
}

/** A soft, quick tactile sound for actionable controls. */
export function playButtonAudio() {
  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime + 0.004;
  tone(context, now, 0.075, 610, 475, 0.035, "triangle");
  tone(context, now + 0.025, 0.07, 950, 700, 0.016, "sine");
}

/** The result event gets one short referee-style whistle, generated offline. */
export function playResultWhistle() {
  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime + 0.008;
  tone(context, now, 0.22, 1260, 1740, 0.085, "sine");
  tone(context, now + 0.015, 0.195, 1510, 2050, 0.025, "sine");
}

function playAnnouncement(kind: "phase" | "info" | "champion") {
  const context = getAudioContext();
  if (!context) return;
  const notes =
    kind === "champion" ? [523, 659, 784, 1046] : [392, 523, 659];
  notes.forEach((frequency, index) => {
    tone(
      context,
      context.currentTime + index * 0.13,
      kind === "champion" ? 0.26 : 0.17,
      frequency,
      frequency * 1.01,
      0.055,
      "sine",
    );
  });
}

export function useGlobalButtonAudio(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLElement>(
        'button, input[type="button"], input[type="submit"], [role="button"]',
      );
      if (
        !button ||
        button.matches(":disabled") ||
        button.getAttribute("aria-disabled") === "true" ||
        button.closest("[inert]")
      )
        return;
      playButtonAudio();
    };
    // Capture once per activation, including clicks on icons inside buttons.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [enabled]);
}

export function useEventAudio(s: State) {
  const latest = s.events.at(-1);
  const lastSeenId = useRef(latest?.id);

  useEffect(() => {
    if (!latest || lastSeenId.current === latest.id) return;
    const previousId = lastSeenId.current;
    const previousIndex = previousId
      ? s.events.findIndex((event) => event.id === previousId)
      : -1;
    lastSeenId.current = latest.id;
    // Restored or replaced histories should never replay old results.
    if (previousId && previousIndex < 0) return;
    if (!s.settings.sound || Date.now() - latest.at > 10000) return;
    const addedEvents = s.events.slice(previousIndex + 1);
    // Saving the last match also adds a phase/champion event in the same commit.
    if (addedEvents.some((event) => event.kind === "result"))
      playResultWhistle();
    else playAnnouncement(latest.kind === "result" ? "info" : latest.kind);
  }, [latest?.id, s.settings.sound]);
}
