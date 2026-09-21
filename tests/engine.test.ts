import { describe, it, expect } from "vitest";
import { initialState, type State } from "../src/engine/types";
import {
  draw,
  startGroups,
  standings,
  saveResult,
  advance,
  queue,
  validateState,
  roundRobin,
  qualifiers,
} from "../src/engine/tournament";
const setup = (n: number) => {
  const s = initialState();
  s.teams = Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    name: `Pareja ${i}`,
    player1: `A${i}`,
    player2: `B${i}`,
    shortName: "",
    group: null,
  }));
  return s;
};
function finish(s: State) {
  for (const m of s.matches.filter(
    (m) => m.phase === s.phase && m.status !== "completed",
  ))
    s = saveResult(s, m.id, [
      { a: 10, b: 4 },
      { a: 10, b: 3 },
    ]);
  return s;
}
describe("Calendari adaptatiu", () => {
  for (const n of [6, 17, 18, 25, 26, 27, 28, 29, 30])
    it(`${n} parelles: sense duplicats, descansos ni pèrdua de participants`, () => {
      const s = startGroups(draw(setup(n)));
      const sizes = [1, 2, 3].map(
        (g) => s.teams.filter((t) => t.group === g).length,
      );
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      for (const g of [1, 2, 3]) {
        const ts = s.teams.filter((t) => t.group === g);
        const ms = s.matches.filter((m) => m.table === g);
        expect(ms).toHaveLength((ts.length * (ts.length - 1)) / 2);
        expect(new Set(ms.map((m) => [m.a, m.b].sort().join(":"))).size).toBe(
          ms.length,
        );
        for (const t of ts)
          expect(ms.filter((m) => m.a === t.id || m.b === t.id)).toHaveLength(
            ts.length - 1,
          );
      }
    });
  it("10 parelles = 45 enfrontaments i 90 partides", () =>
    expect(
      roundRobin(
        setup(10).teams.map((t) => t.id),
        1,
      ),
    ).toHaveLength(45));
});
describe("Resultats i fases", () => {
  it("compta partides, avança sols la seua taula i recalcula una correcció", () => {
    let s = startGroups(draw(setup(30)));
    const m = queue(s, 1)[0],
      other = queue(s, 2)[0].id;
    s = saveResult(s, m.id, [
      { a: 10, b: 7 },
      { a: 6, b: 10 },
    ]);
    expect(standings(s, 1).find((r) => r.id === m.a)?.points).toBe(1);
    expect(queue(s, 1)[0].id).not.toBe(m.id);
    expect(queue(s, 2)[0].id).toBe(other);
    s = saveResult(s, m.id, [
      { a: 10, b: 7 },
      { a: 10, b: 6 },
    ]);
    expect(standings(s, 1).find((r) => r.id === m.a)?.points).toBe(2);
    expect(standings(s, 1).find((r) => r.id === m.a)?.played).toBe(1);
  });
  it("rebutja empats, negatius i decimals", () => {
    const s = startGroups(draw(setup(26))),
      id = queue(s, 1)[0].id;
    for (const a of [-1, 2.5, 10])
      expect(() =>
        saveResult(s, id, [
          { a, b: 10 },
          { a: 10, b: 5 },
        ]),
      ).toThrow();
    expect(() => advance(s)).toThrow();
  });
  for (const n of [6, 17, 26, 27, 28, 30])
    it(`torneig complet de ${n} parelles fins al campió`, () => {
      let s = finish(startGroups(draw(setup(n))));
      expect(s.phase).toBe("GROUP_STAGE_COMPLETE");
      s.settings.tieOrder = s.teams.map((t) => t.id);
      s = advance(s);
      expect(s.seeds).toHaveLength(Math.min(n, 18));
      if (n >= 18) expect(qualifiers(s)).toHaveLength(18);
      s = advance(s);
      if (n >= 18) {
        expect(s.phase).toBe("PRELIMINARY");
        expect(
          s.matches
            .filter((m) => m.phase === "PRELIMINARY")
            .map((m) => [m.a, m.b]),
        ).toEqual([
          [s.seeds[0], s.seeds[17]],
          [s.seeds[1], s.seeds[16]],
        ]);
      }
      let safety = 0;
      while (s.phase !== "CHAMPION" && safety++ < 10) {
        s = finish(s);
        if (s.phase !== "CHAMPION") s = advance(s);
      }
      expect(s.champion).toBeTruthy();
      expect(s.phase).toBe("CHAMPION");
      expect(validateState(JSON.parse(JSON.stringify(s)))).toBeTruthy();
    });
  it("desempat obligatori en eliminatòries", () => {
    let s = finish(startGroups(draw(setup(30))));
    s.settings.tieOrder = s.teams.map((t) => t.id);
    s = advance(advance(s));
    const m = queue(s, 1)[0];
    expect(() =>
      saveResult(s, m.id, [
        { a: 10, b: 4 },
        { a: 4, b: 10 },
      ]),
    ).toThrow();
    s = saveResult(s, m.id, [
      { a: 10, b: 4 },
      { a: 4, b: 10 },
      { a: 8, b: 10 },
    ]);
    expect(s.matches.find((x) => x.id === m.id)?.winner).toBe(m.b);
  });
  it("bloqueja correccions que afectarien una fase posterior", () => {
    let s = finish(startGroups(draw(setup(30))));
    s.settings.tieOrder = s.teams.map((t) => t.id);
    s = advance(advance(s));
    expect(() =>
      saveResult(s, s.matches[0].id, [
        { a: 10, b: 1 },
        { a: 10, b: 2 },
      ]),
    ).toThrow();
  });
  it("rebutja còpies invàlides", () => {
    expect(() => validateState({ version: 1 })).toThrow();
    const s = startGroups(draw(setup(30)));
    s.matches[0].a = "missing";
    expect(() => validateState(s)).toThrow();
  });
});
