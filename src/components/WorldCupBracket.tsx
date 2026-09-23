import { Trophy, Zap } from "lucide-react";
import { standings } from "../engine/tournament";
import {
  phaseNames,
  tables,
  type Match,
  type Phase,
  type State,
} from "../engine/types";
import { teamName } from "./TV";
import "../cup-bracket.css";

const rounds = [
  { phase: "PRELIMINARY", title: "PRÈVIA" },
  { phase: "ROUND_OF_16", title: "OCTAUS" },
  { phase: "QUARTER_FINALS", title: "QUARTS" },
  { phase: "SEMI_FINALS", title: "SEMIFINALS" },
  { phase: "FINAL", title: "GRAN FINAL" },
] as const;

function phasePosition(phase: Phase) {
  if (["SETUP", "DRAW", "GROUP_STAGE", "GROUP_STAGE_COMPLETE"].includes(phase)) return 0;
  if (phase === "QUALIFIED") return 1;
  if (phase === "CHAMPION") return 7;
  return rounds.findIndex((round) => round.phase === phase) + 2;
}

function matchCount(phase: Match["phase"], entrants: number) {
  if (entrants < 2) return 0;
  const bracket = 2 ** Math.floor(Math.log2(entrants));
  if (phase === "PRELIMINARY") return entrants - bracket;
  if (phase === "ROUND_OF_16") return bracket >= 16 ? 8 : 0;
  if (phase === "QUARTER_FINALS") return bracket >= 8 ? 4 : 0;
  if (phase === "SEMI_FINALS") return bracket >= 4 ? 2 : 0;
  return 1;
}

function wins(match: Match, teamId: string) {
  if (match.status !== "completed") return "–";
  return match.games.filter((game) =>
    match.a === teamId ? game.a > game.b : game.b > game.a,
  ).length;
}

function MatchNode({
  state,
  match,
  index,
  active,
}: {
  state: State;
  match?: Match;
  index: number;
  active: boolean;
}) {
  return (
    <div
      className={`wc-match ${match?.status === "completed" ? "complete" : ""} ${match?.status === "playing" && active ? "playing" : ""} ${!match ? "future" : ""}`}
      title={
        match
          ? `${teamName(state, match.a)} contra ${teamName(state, match.b)} · Futbolí ${match.table}`
          : `Creuament ${index + 1} pendent`
      }
    >
      <div className="wc-match-top">
        <span>{match ? `FUTBOLÍ ${match.table}` : `CREUAMENT ${String(index + 1).padStart(2, "0")}`}</span>
        <strong>
          {match?.status === "completed"
            ? "FINALITZAT"
            : match?.status === "playing" && active
              ? "EN JOC"
              : "PENDENT"}
        </strong>
      </div>
      {[match?.a, match?.b].map((id, teamIndex) => (
        <div className={`wc-match-team ${match?.winner === id && id ? "winner" : ""}`} key={teamIndex}>
          <b>{id ? teamName(state, id) : "Per decidir"}</b>
          <em>{match && id ? wins(match, id) : "–"}</em>
        </div>
      ))}
    </div>
  );
}

function ConnectorLines({ state, counts }: { state: State; counts: number[] }) {
  const paths: { d: string; confirmed: boolean }[] = [];
  const positions = (count: number) =>
    Array.from({ length: count }, (_, index) => ((index + 0.5) / count) * 800);

  for (let stage = 0; stage < rounds.length - 1; stage++) {
    const sourceCount = counts[stage];
    const nextStage = counts.findIndex((count, index) => index > stage && count > 0);
    if (nextStage < 0) continue;
    const targetCount = counts[nextStage];
    if (!sourceCount || !targetCount) continue;
    const sourceMatches = state.matches.filter((match) => match.phase === rounds[stage].phase);
    const targetMatches = state.matches.filter((match) => match.phase === rounds[nextStage].phase);
    const sourceYs = positions(sourceCount);
    const targetYs = positions(targetCount);
    sourceYs.forEach((fromY, index) => {
      const winner = sourceMatches[index]?.winner;
      const actualTarget = winner
        ? targetMatches.findIndex((match) => match.a === winner || match.b === winner)
        : -1;
      const targetIndex = actualTarget >= 0
        ? actualTarget
        : stage === 0
          ? Math.round((index / Math.max(1, sourceCount - 1)) * (targetCount - 1))
          : Math.min(targetCount - 1, Math.floor(index / 2));
      const startX = (stage + 1) * 200 - 15;
      const endX = nextStage * 200 + 15;
      const midX = (startX + endX) / 2;
      paths.push({
        d: `M ${startX} ${fromY} H ${midX} V ${targetYs[targetIndex]} H ${endX}`,
        confirmed: actualTarget >= 0 && !!winner,
      });
    });
  }
  paths.push({ d: "M 985 400 H 1015", confirmed: !!state.champion });

  return (
    <svg className="wc-connectors" viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden="true">
      {paths.map((path, index) => (
        <path d={path.d} className={path.confirmed ? "confirmed" : "anticipated"} key={index} />
      ))}
    </svg>
  );
}

export function WorldCupBracket({ state }: { state: State }) {
  const current = phasePosition(state.phase);
  const entrants = state.seeds.length || tables.reduce((count, table) =>
    count + Math.min(6, state.teams.filter((team) => team.group === table).length), 0);
  const counts = rounds.map((round) => matchCount(round.phase, entrants));

  return (
    <section className="wc-screen" aria-label="Camí a la copa · quadre del torneig">
      <header className="wc-heading">
        <div>
          <span>EL QUADRE DEL TORNEIG</span>
          <h2>CAMÍ A LA <b>COPA</b> <Trophy aria-hidden="true" /></h2>
        </div>
        <strong><Zap aria-hidden="true" /> ARA: {phaseNames[state.phase].toUpperCase()}</strong>
      </header>

      <div className="wc-origins">
        <section className={`wc-origin-block ${current === 0 ? "current" : "passed"}`}>
          <h3><span>01</span> ELS TRES GRUPS <small>{state.teams.length} PARELLES</small></h3>
          <div className="wc-group-grid">
            {tables.map((table) => {
              const teams = state.teams.filter((team) => team.group === table);
              return (
                <div className={`wc-group table-${table}`} key={table}>
                  <b>FUTBOLÍ {table}</b>
                  <div>{teams.map((team) => <span title={team.name} key={team.id}>{team.name}</span>)}</div>
                </div>
              );
            })}
          </div>
        </section>
        <div className="wc-origin-arrow" aria-hidden="true">➜</div>
        <section className={`wc-origin-block ${current === 1 ? "current" : current > 1 ? "passed" : "future"}`}>
          <h3><span>02</span> PARELLES CLASSIFICADES <small>PASSEN {entrants}</small></h3>
          <div className="wc-group-grid">
            {tables.map((table) => {
              const ids = standings(state, table).slice(0, 6).map((row) => row.id);
              return (
                <div className={`wc-group table-${table}`} key={table}>
                  <b>FUTBOLÍ {table}</b>
                  <div>{ids.map((id, index) => <span title={teamName(state, id)} key={id}><i>{index + 1}</i>{teamName(state, id)}</span>)}</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="wc-bracket" aria-label="Creuaments fins a la final">
        <ConnectorLines state={state} counts={counts} />
        {rounds.map((round, roundIndex) => {
          const position = roundIndex + 2;
          const matches = state.matches.filter((match) => match.phase === round.phase);
          const count = counts[roundIndex];
          return (
            <section className={`wc-round ${position === current ? "current" : position < current ? "passed" : "future"}`} key={round.phase}>
              <h3><span>{String(position + 1).padStart(2, "0")}</span>{round.title}<small>{position === current ? "ARA" : position < current ? "✓" : "PENDENT"}</small></h3>
              <div className="wc-round-body">
                {count > 0
                  ? Array.from({ length: count }, (_, index) => (
                      <div className="wc-slot" key={index}>
                        <MatchNode state={state} match={matches[index]} index={index} active={position === current} />
                      </div>
                    ))
                  : <div className="wc-no-round">NO CAL ESTA RONDA</div>}
              </div>
            </section>
          );
        })}
        <section className={`wc-round wc-cup ${state.champion ? "current" : "future"}`}>
          <h3><span>08</span>LA COPA<small>{state.champion ? "✓" : "PENDENT"}</small></h3>
          <div className="wc-cup-content">
            <Trophy aria-hidden="true" />
            <span>{state.champion ? "CAMPIONS" : "LA GLÒRIA ESPERA"}</span>
            <strong>{state.champion ? teamName(state, state.champion) : "QUI ALÇARÀ LA COPA?"}</strong>
          </div>
        </section>
      </div>
    </section>
  );
}
