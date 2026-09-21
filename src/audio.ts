import { useEffect, useRef } from "react";
import type { State } from "./engine/types";
export function useEventAudio(s: State) {
  const context = useRef<AudioContext | null>(null);
  const id = s.events.at(-1)?.id;
  useEffect(() => {
    const unlock = () => {
      if (!context.current) context.current = new AudioContext();
      void context.current.resume();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      void context.current?.close();
      context.current = null;
    };
  }, []);
  useEffect(() => {
    const e = s.events.at(-1),
      c = context.current;
    if (
      !s.settings.sound ||
      !e ||
      Date.now() - e.at > 10000 ||
      !c ||
      c.state !== "running"
    )
      return;
    const notes =
      e.kind === "result"
        ? [523, 659]
        : e.kind === "champion"
          ? [523, 659, 784, 1046]
          : [392, 523, 659];
    for (const [i, hz] of notes.entries()) {
      const oscillator = c.createOscillator(),
        gain = c.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = hz;
      gain.gain.setValueAtTime(0, c.currentTime + i * 0.17);
      gain.gain.linearRampToValueAtTime(0.08, c.currentTime + i * 0.17 + 0.015);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        c.currentTime + i * 0.17 + 0.3,
      );
      oscillator.connect(gain);
      gain.connect(c.destination);
      oscillator.start(c.currentTime + i * 0.17);
      oscillator.stop(c.currentTime + i * 0.17 + 0.32);
    }
  }, [id, s.settings.sound]);
}
