import { useGlobalButtonAudio } from "../audio";

export function GlobalButtonAudio({ enabled }: { enabled: boolean }) {
  useGlobalButtonAudio(enabled);
  return null;
}
