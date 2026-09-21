import { z } from "zod";
import {
  initialState,
  phaseNames,
  tables,
  uid,
  type State,
  type Team,
  type Match,
  type Game,
  type Standing,
  type TableId,
  type Phase,
  type Event,
} from "./types";
export function event(
  s: State,
  kind: Event["kind"],
  title: string,
  detail = "",
  teams: string[] = [],
) {
  s.events = [
    ...s.events,
    { id: uid(), at: Date.now(), kind, title, detail, teams },
  ].slice(-200);
  return s;
}
export function draw(input: State): State {
  if (!["SETUP", "DRAW"].includes(input.phase))
    throw Error("El sorteig ja està confirmat.");
  if (input.teams.length < 6 || input.teams.length > 30)
    throw Error("Inscriu entre 6 i 30 parelles.");
  const s = structuredClone(input),
    list = [...s.teams];
  for (let i = list.length - 1; i > 0; i--) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    const j = Math.floor((a[0] / 4294967296) * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  s.teams = list.map((t, i) => ({ ...t, group: tables[i % 3] }));
  s.phase = "DRAW";
  return event(
    s,
    "phase",
    "Ja tenim sorteig!",
    "Tres grups. Una mateixa passió.",
    s.teams.map((t) => t.id),
  );
}
export function roundRobin(ids: string[], table: TableId): Match[] {
  const ring: (string | null)[] = [...ids];
  if (ring.length % 2) ring.push(null);
  const matches: Match[] = [];
  for (let round = 0; round < ring.length - 1; round++) {
    for (let i = 0; i < ring.length / 2; i++) {
      const a = ring[i],
        b = ring[ring.length - 1 - i];
      if (a && b)
        matches.push({
          id: uid(),
          phase: "GROUP_STAGE",
          table,
          a: round % 2 ? b : a,
          b: round % 2 ? a : b,
          games: [],
          status: "scheduled",
          order: matches.length,
        });
    }
    ring.splice(1, 0, ring.pop()!);
  }
  return matches;
}
export function startGroups(input: State): State {
  if (input.phase !== "DRAW") throw Error("Cal confirmar el sorteig.");
  const sizes = tables.map(
    (g) => input.teams.filter((t) => t.group === g).length,
  );
  if (
    input.teams.some((t) => t.group === null) ||
    Math.min(...sizes) < 2 ||
    Math.max(...sizes) - Math.min(...sizes) > 1
  )
    throw Error("Equilibra els grups: com a màxim una parella de diferència.");
  const s = structuredClone(input);
  s.matches = tables.flatMap((g) =>
    roundRobin(
      s.teams.filter((t) => t.group === g).map((t) => t.id),
      g,
    ),
  );
  s.phase = "GROUP_STAGE";
  activate(s);
  return event(
    s,
    "phase",
    "Que comence el torneig!",
    "Els tres futbolins ja estan en joc.",
  );
}
export function queue(s: State, table: TableId): Match[] {
  return s.matches
    .filter(
      (m) =>
        m.table === table && m.phase === s.phase && m.status !== "completed",
    )
    .sort((a, b) => a.order - b.order);
}
function activate(s: State) {
  for (const t of tables) {
    const next = queue(s, t)[0];
    if (next) next.status = "playing";
  }
}
export function standings(s: State, group?: TableId): Standing[] {
  const rows = s.teams
    .filter((t) => !group || t.group === group)
    .map((t) => ({
      id: t.id,
      played: 0,
      won: 0,
      lost: 0,
      gf: 0,
      gc: 0,
      diff: 0,
      points: 0,
      direct: 0,
      tied: false,
    }));
  const map = new Map(rows.map((r) => [r.id, r]));
  const matches = s.matches.filter(
    (m) => m.phase === "GROUP_STAGE" && m.status === "completed",
  );
  for (const m of matches) {
    for (const [id, home] of [
      [m.a, true],
      [m.b, false],
    ] as const) {
      const r = map.get(id);
      if (!r) continue;
      r.played++;
      for (const g of m.games) {
        const a = home ? g.a : g.b,
          b = home ? g.b : g.a;
        r.gf += a;
        r.gc += b;
        r.won += Number(a > b);
        r.lost += Number(a < b);
      }
      r.points = r.won;
      r.diff = r.gf - r.gc;
    }
  }
  const directIndex = s.settings.tieRules.indexOf("direct");
  const before =
    directIndex < 0 ? [] : s.settings.tieRules.slice(0, directIndex);
  for (const r of rows) {
    const tied = new Set(
      rows
        .filter(
          (o) => o.points === r.points && before.every((k) => o[k] === r[k]),
        )
        .map((o) => o.id),
    );
    r.direct = matches
      .filter(
        (m) => tied.has(m.a) && tied.has(m.b) && (m.a === r.id || m.b === r.id),
      )
      .reduce(
        (n, m) =>
          n +
          m.games.filter((g) => (m.a === r.id ? g.a > g.b : g.b > g.a)).length,
        0,
      );
  }
  const compare = (a: Standing, b: Standing) =>
    b.points - a.points ||
    s.settings.tieRules.reduce((n, k) => n || b[k] - a[k], 0);
  const manual = (id: string) => {
    const n = s.settings.tieOrder.indexOf(id);
    return n < 0 ? 9999 : n;
  };
  rows.sort(
    (a, b) =>
      compare(a, b) || manual(a.id) - manual(b.id) || a.id.localeCompare(b.id),
  );
  for (const r of rows)
    r.tied = rows.some(
      (o) =>
        o.id !== r.id &&
        compare(r, o) === 0 &&
        (manual(r.id) === 9999 || manual(o.id) === 9999),
    );
  return rows;
}
export function qualifiers(s: State): Standing[] {
  const rows = tables.flatMap((t) => standings(s, t).slice(0, 6));
  const unequal =
    new Set(tables.map((t) => s.teams.filter((x) => x.group === t).length))
      .size > 1;
  const divisor = (r: Standing) =>
    s.settings.normalized && unequal ? Math.max(1, r.played) : 1;
  const manual = (id: string) => {
    const v = s.settings.tieOrder.indexOf(id);
    return v < 0 ? 9999 : v;
  };
  return rows.sort(
    (a, b) =>
      b.points / divisor(b) - a.points / divisor(a) ||
      b.diff / divisor(b) - a.diff / divisor(a) ||
      b.gf / divisor(b) - a.gf / divisor(a) ||
      manual(a.id) - manual(b.id) ||
      a.id.localeCompare(b.id),
  );
}
export function validateGames(games: Game[], knockout: boolean) {
  if (games.length < 2 || games.length > 3)
    throw Error("Introduïx les dues partides.");
  for (const g of games)
    if (
      !Number.isInteger(g.a) ||
      !Number.isInteger(g.b) ||
      g.a < 0 ||
      g.b < 0 ||
      g.a > 999 ||
      g.b > 999 ||
      g.a === g.b
    )
      throw Error(
        "Cada partida necessita un guanyador i gols enters entre 0 i 999.",
      );
  const split = games[0].a > games[0].b !== games[1].a > games[1].b;
  if (knockout && split && games.length !== 3)
    throw Error("Cal una tercera partida de desempat.");
  if ((!knockout || !split) && games.length !== 2)
    throw Error("No correspon una partida de desempat.");
}
export function saveResult(input: State, id: string, games: Game[]): State {
  const s = structuredClone(input),
    m = s.matches.find((x) => x.id === id);
  if (!m) throw Error("Enfrontament inexistent.");
  if (
    m.phase !== s.phase &&
    !(m.phase === "GROUP_STAGE" && s.phase === "GROUP_STAGE_COMPLETE")
  )
    throw Error(
      "Ja hi ha una fase posterior. Torna a esta fase abans de corregir.",
    );
  if (m.status === "scheduled")
    throw Error("Este enfrontament encara no està en joc.");
  validateGames(games, m.phase !== "GROUP_STAGE");
  m.games = games;
  m.status = "completed";
  const wins = games.filter((g) => g.a > g.b).length;
  m.winner =
    wins > games.length / 2 ? m.a : wins < games.length / 2 ? m.b : undefined;
  const a = s.teams.find((t) => t.id === m.a)!,
    b = s.teams.find((t) => t.id === m.b)!;
  event(
    s,
    "result",
    `Resultat · Futbolí ${m.table}`,
    `${a.name} ${wins} — ${games.length - wins} ${b.name}`,
    [m.a, m.b],
  );
  if (
    s.matches
      .filter((x) => x.phase === s.phase)
      .every((x) => x.status === "completed")
  ) {
    if (s.phase === "GROUP_STAGE") {
      s.phase = "GROUP_STAGE_COMPLETE";
      event(
        s,
        "phase",
        "Fase de grups completada!",
        "Preparats per a conéixer els classificats?",
      );
    } else if (s.phase === "FINAL") {
      s.phase = "CHAMPION";
      s.champion = m.winner!;
      event(s, "champion", "CAMPEONS!", a.id === m.winner ? a.name : b.name, [
        m.winner!,
      ]);
    }
  }
  activate(s);
  return s;
}
function createRound(
  s: State,
  ids: string[],
  phase: Phase,
  pairs = ids.length / 2,
) {
  s.phase = phase;
  for (let i = 0; i < pairs; i++)
    s.matches.push({
      id: uid(),
      a: ids[i],
      b: ids[ids.length - 1 - i],
      phase,
      table: tables[i % 3],
      order: i,
      status: "scheduled",
      games: [],
    });
  activate(s);
  event(
    s,
    "phase",
    phaseNames[phase],
    `${ids.length} parelles · la copa està més prop`,
    ids,
  );
  return s;
}
export function advance(input: State): State {
  const s = structuredClone(input);
  if (s.phase === "GROUP_STAGE_COMPLETE") {
    if (
      tables.some((t) => standings(s, t).some((r) => r.tied)) ||
      hasSeedTies(s)
    )
      throw Error("Resol els empats de classificació abans de continuar.");
    s.seeds = qualifiers(s).map((r) => r.id);
    s.phase = "QUALIFIED";
    return event(
      s,
      "phase",
      `${s.seeds.length} parelles classificades!`,
      "Enhorabona! El camí cap a la copa continua.",
      s.seeds,
    );
  }
  if (s.phase === "QUALIFIED") {
    const n = s.seeds.length,
      power = 2 ** Math.floor(Math.log2(n)),
      extra = n - power;
    if (extra) {
      s.byes = s.seeds.slice(extra, n - extra);
      return createRound(s, s.seeds, "PRELIMINARY", extra);
    }
    return createRound(s, s.seeds, roundName(n));
  }
  if (
    !["PRELIMINARY", "ROUND_OF_16", "QUARTER_FINALS", "SEMI_FINALS"].includes(
      s.phase,
    )
  )
    throw Error("Encara no es pot avançar.");
  const matches = s.matches.filter((m) => m.phase === s.phase);
  if (!matches.length || matches.some((m) => m.status !== "completed"))
    throw Error("Queden enfrontaments per acabar.");
  const ids = [
    ...(s.phase === "PRELIMINARY" ? s.byes : []),
    ...matches.map((m) => m.winner!),
  ].sort((a, b) => s.seeds.indexOf(a) - s.seeds.indexOf(b));
  s.byes = [];
  return createRound(s, ids, roundName(ids.length));
}
function roundName(n: number): Phase {
  if (n === 16) return "ROUND_OF_16";
  if (n === 8) return "QUARTER_FINALS";
  if (n === 4) return "SEMI_FINALS";
  if (n === 2) return "FINAL";
  throw Error("Nombre de supervivents invàlid.");
}
export function rewind(input: State, phase: Phase): State {
  const s = structuredClone(input);
  const order: Phase[] = [
    "GROUP_STAGE",
    "PRELIMINARY",
    "ROUND_OF_16",
    "QUARTER_FINALS",
    "SEMI_FINALS",
    "FINAL",
  ];
  if (!order.includes(phase)) throw Error("Fase invàlida.");
  s.matches = s.matches.filter(
    (m) => order.indexOf(m.phase) <= order.indexOf(phase),
  );
  s.phase = phase;
  s.champion = null;
  if (phase === "GROUP_STAGE") {
    s.seeds = [];
    s.byes = [];
    if (s.matches.every((m) => m.status === "completed"))
      s.phase = "GROUP_STAGE_COMPLETE";
  } else if (phase === "PRELIMINARY") {
    const active = new Set(
      s.matches.filter((m) => m.phase === phase).flatMap((m) => [m.a, m.b]),
    );
    s.byes = s.seeds.filter((id) => !active.has(id));
  } else s.byes = [];
  return event(
    s,
    "info",
    "Fase reoberta",
    "S’han retirat les rondes posteriors per a poder corregir.",
  );
}
export function addTeam(s: State, t: Team) {
  if (!["SETUP", "DRAW"].includes(s.phase))
    throw Error("Les inscripcions estan tancades.");
  if (!t.name.trim() || !t.player1.trim() || !t.player2.trim())
    throw Error("Completa el nom de la parella i dels dos jugadors.");
  if (
    s.teams.some(
      (x) =>
        x.id !== t.id &&
        x.name.trim().toLocaleLowerCase() === t.name.trim().toLocaleLowerCase(),
    )
  )
    throw Error("Ja existix una parella amb este nom.");
  if (!s.teams.some((x) => x.id === t.id) && s.teams.length >= 30)
    throw Error("Màxim 30 parelles.");
  t = {
    ...t,
    name: t.name.trim(),
    player1: t.player1.trim(),
    player2: t.player2.trim(),
    shortName: t.shortName.trim(),
  };
  if (s.phase === "DRAW" && !t.group)
    t.group = [...tables].sort(
      (a, b) =>
        s.teams.filter((x) => x.group === a).length -
        s.teams.filter((x) => x.group === b).length,
    )[0];
  return {
    ...s,
    teams: s.teams.some((x) => x.id === t.id)
      ? s.teams.map((x) => (x.id === t.id ? t : x))
      : [...s.teams, t],
  };
}
const phaseSchema = z.enum([
  "SETUP",
  "DRAW",
  "GROUP_STAGE",
  "GROUP_STAGE_COMPLETE",
  "QUALIFIED",
  "PRELIMINARY",
  "ROUND_OF_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "FINAL",
  "CHAMPION",
]);
const tableSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const schema = z.object({
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  phase: phaseSchema,
  teams: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(80),
        player1: z.string().min(1).max(80),
        player2: z.string().min(1).max(80),
        shortName: z.string().max(40),
        group: tableSchema.nullable(),
      }),
    )
    .max(30),
  matches: z
    .array(
      z.object({
        id: z.string(),
        phase: phaseSchema,
        table: tableSchema,
        a: z.string(),
        b: z.string(),
        games: z.array(z.object({ a: z.number(), b: z.number() })).max(3),
        status: z.enum(["scheduled", "playing", "completed"]),
        order: z.number().int().nonnegative(),
        winner: z.string().optional(),
      }),
    )
    .max(1000),
  seeds: z.array(z.string()),
  byes: z.array(z.string()),
  champion: z.string().nullable(),
  settings: z.object({
    auto: z.boolean(),
    seconds: z.number().int().min(5).max(120),
    view: z.enum([
      "live",
      "standings",
      "upcoming",
      "qualified",
      "bracket",
      "final",
      "champion",
    ]),
    sound: z.boolean(),
    normalized: z.boolean(),
    tieOrder: z.array(z.string()),
    tieRules: z.array(z.enum(["diff", "gf", "direct"])).length(3),
    knockout: z.enum(["two-tiebreak", "best-of-three"]),
  }),
  events: z
    .array(
      z.object({
        id: z.string(),
        at: z.number(),
        kind: z.enum(["result", "phase", "info", "champion"]),
        title: z.string(),
        detail: z.string(),
        teams: z.array(z.string()),
      }),
    )
    .max(200),
  demo: z.boolean(),
});
export function validateState(value: unknown): State {
  const s = schema.parse(value);
  const ids = new Set(s.teams.map((t) => t.id));
  if (
    ids.size !== s.teams.length ||
    new Set(s.matches.map((m) => m.id)).size !== s.matches.length
  )
    throw Error("IDs duplicats.");
  if (new Set(s.settings.tieRules).size !== 3)
    throw Error("Desempats invàlids.");
  for (const m of s.matches) {
    if (!ids.has(m.a) || !ids.has(m.b) || m.a === m.b)
      throw Error("Referència de parella invàlida.");
    if (m.status === "completed") {
      validateGames(m.games, m.phase !== "GROUP_STAGE");
      const wins = m.games.filter((g) => g.a > g.b).length;
      const winner =
        wins > m.games.length / 2
          ? m.a
          : wins < m.games.length / 2
            ? m.b
            : undefined;
      if (m.winner !== winner) throw Error("Guanyador inconsistent.");
    } else if (m.games.length) throw Error("Resultat incomplet.");
  }
  if (
    [
      ...s.seeds,
      ...s.byes,
      ...s.settings.tieOrder,
      ...(s.champion ? [s.champion] : []),
    ].some((id) => !ids.has(id))
  )
    throw Error("Classificació invàlida.");
  validateIntegrity(s);
  return s;
}
export function demoState(n = 30): State {
  let s = initialState();
  s.demo = true;
  s.teams = Array.from({ length: n }, (_, i) => ({
    id: uid(),
    name: `Parella ${String(i + 1).padStart(2, "0")}`,
    player1: `Jugador ${i * 2 + 1}`,
    player2: `Jugador ${i * 2 + 2}`,
    shortName: "",
    group: null,
  }));
  s = startGroups(draw(s));
  for (let i = 0; i < 18; i++) {
    const m = queue(s, tables[i % 3])[0];
    if (m)
      s = saveResult(s, m.id, [
        { a: 10, b: 3 + (i % 6) },
        { a: i % 2 ? 10 : 6, b: i % 2 ? 5 : 10 },
      ]);
  }
  s.events = [];
  return s;
}
export function hasSeedTies(s: State): boolean {
  const rows = qualifiers(s),
    unequal =
      new Set(tables.map((t) => s.teams.filter((x) => x.group === t).length))
        .size > 1;
  const divisor = (r: Standing) =>
    s.settings.normalized && unequal ? Math.max(1, r.played) : 1;
  return rows.some((a, i) =>
    rows
      .slice(i + 1)
      .some(
        (b) =>
          a.points * divisor(b) === b.points * divisor(a) &&
          a.diff * divisor(b) === b.diff * divisor(a) &&
          a.gf * divisor(b) === b.gf * divisor(a) &&
          (!s.settings.tieOrder.includes(a.id) ||
            !s.settings.tieOrder.includes(b.id)),
      ),
  );
}
function validateIntegrity(s: State) {
  const pairs = new Set<string>();
  for (const m of s.matches) {
    const key = [m.phase, ...[m.a, m.b].sort()].join(":");
    if (pairs.has(key)) throw Error("Enfrontament duplicat.");
    pairs.add(key);
    if (
      m.phase === "GROUP_STAGE" &&
      [m.a, m.b].some(
        (id) => s.teams.find((t) => t.id === id)?.group !== m.table,
      )
    )
      throw Error("Enfrontament fora del grup.");
  }
  const started = !["SETUP", "DRAW"].includes(s.phase);
  if (started) {
    if (s.teams.length < 6 || s.teams.some((t) => t.group === null))
      throw Error("Falten parelles o grups.");
    const sizes = tables.map(
      (t) => s.teams.filter((x) => x.group === t).length,
    );
    if (Math.min(...sizes) < 2 || Math.max(...sizes) - Math.min(...sizes) > 1)
      throw Error("Grups desequilibrats.");
    for (const table of tables) {
      const n = s.teams.filter((t) => t.group === table).length;
      if (
        s.matches.filter((m) => m.phase === "GROUP_STAGE" && m.table === table)
          .length !==
        (n * (n - 1)) / 2
      )
        throw Error("Calendari incomplet.");
      const q = queue(s, table);
      if (
        q.length &&
        (q[0].status !== "playing" ||
          q.slice(1).some((m) => m.status !== "scheduled"))
      )
        throw Error("Cua de partits inconsistent.");
    }
  }
  if (
    started &&
    s.phase !== "GROUP_STAGE" &&
    s.matches.some((m) => m.phase === "GROUP_STAGE" && m.status !== "completed")
  )
    throw Error("La fase de grups no ha acabat.");
  if (
    new Set(s.seeds).size !== s.seeds.length ||
    new Set(s.settings.tieOrder).size !== s.settings.tieOrder.length
  )
    throw Error("Ranking duplicat.");
  if (
    started &&
    !["GROUP_STAGE", "GROUP_STAGE_COMPLETE"].includes(s.phase) &&
    s.seeds.length !== Math.min(s.teams.length, 18)
  )
    throw Error("Falten seeds.");
  if (
    s.phase === "CHAMPION" &&
    !s.matches.some(
      (m) =>
        m.phase === "FINAL" &&
        m.status === "completed" &&
        m.winner === s.champion,
    )
  )
    throw Error("Campió sense final vàlida.");
}
