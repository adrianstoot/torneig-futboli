import { initialState, uid, tables, type State } from "./types";
import {
  draw,
  startGroups,
  saveResult,
  queue,
  event,
  qualifiers,
  standings,
} from "./tournament";
const names = [
  "Hugo",
  "Marc",
  "Laia",
  "Paula",
  "Nil",
  "Àlex",
  "Martina",
  "Clara",
  "Joan",
  "Hèctor",
  "Sofia",
  "Emma",
  "Pau",
  "Maria",
  "Jordi",
  "Anna",
  "Carles",
  "Núria",
  "Vicent",
  "Aina",
  "Biel",
  "Lluc",
  "Irene",
  "Sara",
  "David",
  "Alba",
  "Sergi",
  "Lola",
  "Toni",
  "Carme",
  "Lluís",
  "Marta",
  "Adrià",
  "Elena",
  "Miquel",
  "Rosa",
  "Xavi",
  "Cèlia",
  "Ferran",
  "Neus",
  "Arnau",
  "Júlia",
  "Guillem",
  "Eva",
  "Albert",
  "Ariadna",
  "Roc",
  "Carla",
  "Oriol",
  "Berta",
  "Pol",
  "Mar",
  "Jofre",
  "Noa",
  "Raül",
  "Inés",
  "Josep",
  "Lídia",
  "Dani",
  "Aitana",
];
export function createPractice(): State {
  let s = initialState();
  s.demo = true;
  s.settings.auto = false;
  s.teams = Array.from({ length: 30 }, (_, i) => ({
    id: uid(),
    name: `Parella ${String(i + 1).padStart(2, "0")}`,
    player1: names[i * 2],
    player2: names[i * 2 + 1],
    shortName: "",
    group: null,
  }));
  s = startGroups(draw(s));
  return event(
    s,
    "phase",
    "Benvinguts al mode prova!",
    "30 parelles creades. Introdueix els resultats directament en cada futbolí.",
  );
}
export function simulateRound(input: State): State {
  let s = structuredClone(input);
  if (!s.demo) s.demo = true;
  let safety = 0;
  const phase = s.phase;
  while (s.phase === phase && safety++ < 300) {
    const m = tables.map((t) => queue(s, t)[0]).find(Boolean);
    if (!m) break;
    const win = Math.random() > 0.5;
    const split = Math.random() > 0.65;
    const games = [
      { a: win ? 10 : 4, b: win ? 5 : 10 },
      {
        a: split ? (win ? 7 : 10) : win ? 10 : 6,
        b: split ? (win ? 10 : 3) : win ? 4 : 10,
      },
    ];
    if (phase !== "GROUP_STAGE" && split)
      games.push({ a: win ? 10 : 6, b: win ? 5 : 10 });
    s = saveResult(s, m.id, games);
  }
  // Fictional results can leave perfectly level teams. Give every pair a
  // deterministic test ranking so the organiser can continue the dry run.
  if (s.phase === "GROUP_STAGE_COMPLETE") {
    const ranked = qualifiers(s).map((row) => row.id);
    const remaining = tables.flatMap((table) =>
      standings(s, table).map((row) => row.id),
    );
    s.settings.tieOrder = [...new Set([...s.settings.tieOrder, ...ranked, ...remaining])];
  }
  return s;
}
