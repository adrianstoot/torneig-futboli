export type Phase =
  | "SETUP"
  | "DRAW"
  | "GROUP_STAGE"
  | "GROUP_STAGE_COMPLETE"
  | "QUALIFIED"
  | "PRELIMINARY"
  | "ROUND_OF_16"
  | "QUARTER_FINALS"
  | "SEMI_FINALS"
  | "FINAL"
  | "CHAMPION";
export type TableId = 1 | 2 | 3;
export interface Team {
  id: string;
  name: string;
  player1: string;
  player2: string;
  shortName: string;
  group: TableId | null;
}
export interface Game {
  a: number;
  b: number;
}
export interface Match {
  id: string;
  phase: Phase;
  table: TableId;
  a: string;
  b: string;
  games: Game[];
  status: "scheduled" | "playing" | "completed";
  order: number;
  winner?: string;
}
export interface Standing {
  id: string;
  played: number;
  won: number;
  lost: number;
  gf: number;
  gc: number;
  diff: number;
  points: number;
  direct: number;
  tied: boolean;
}
export interface Settings {
  auto: boolean;
  seconds: number;
  view: string;
  sound: boolean;
  normalized: boolean;
  tieOrder: string[];
  tieRules: ("diff" | "gf" | "direct")[];
  knockout: "two-tiebreak" | "best-of-three";
}
export interface Event {
  id: string;
  at: number;
  kind: "result" | "phase" | "info" | "champion";
  title: string;
  detail: string;
  teams: string[];
}
export interface State {
  version: 1;
  revision: number;
  phase: Phase;
  teams: Team[];
  matches: Match[];
  seeds: string[];
  byes: string[];
  champion: string | null;
  settings: Settings;
  events: Event[];
  demo: boolean;
}
export const tables: TableId[] = [1, 2, 3];
export const phaseNames: Record<Phase, string> = {
  SETUP: "Inscripcions",
  DRAW: "Sorteig",
  GROUP_STAGE: "Fase de grups",
  GROUP_STAGE_COMPLETE: "Grups completats",
  QUALIFIED: "Classificats",
  PRELIMINARY: "Ronda prèvia",
  ROUND_OF_16: "Octaus",
  QUARTER_FINALS: "Quarts",
  SEMI_FINALS: "Semifinals",
  FINAL: "Gran final",
  CHAMPION: "Campions",
};
export const initialState = (): State => ({
  version: 1,
  revision: 0,
  phase: "SETUP",
  teams: [],
  matches: [],
  seeds: [],
  byes: [],
  champion: null,
  settings: {
    auto: true,
    seconds: 20,
    view: "live",
    sound: true,
    normalized: true,
    tieOrder: [],
    tieRules: ["diff", "gf", "direct"],
    knockout: "best-of-three",
  },
  events: [],
  demo: false,
});
export const uid = () => crypto.randomUUID();
