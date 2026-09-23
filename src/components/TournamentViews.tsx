import { useEffect, useRef, useState } from "react";
import { BarChart3, ChevronRight, Crown, Trophy } from "lucide-react";
import { qualifiers, queue, standings } from "../engine/tournament";
import {
  phaseNames,
  tables,
  type Match,
  type Phase,
  type State,
  type TableId,
} from "../engine/types";
import { Standings, TrophyArt, teamName } from "./TV";

type Stage = "GROUP_STAGE" | "QUALIFIED" | Match["phase"] | "CHAMPION";
const journey: { id: Stage; short: string }[] = [
  { id: "GROUP_STAGE", short: "GRUPS" },
  { id: "QUALIFIED", short: "CLASSIFICATS" },
  { id: "PRELIMINARY", short: "PRÈVIA" },
  { id: "ROUND_OF_16", short: "OCTAUS" },
  { id: "QUARTER_FINALS", short: "QUARTS" },
  { id: "SEMI_FINALS", short: "SEMIFINALS" },
  { id: "FINAL", short: "FINAL" },
  { id: "CHAMPION", short: "COPA" },
];
const knockoutStages = journey.slice(2, 7).map((stage) => stage.id);

function expectedMatches(stage: Stage, entrants: number) {
  if (entrants < 2) return 0;
  const bracket = 2 ** Math.floor(Math.log2(entrants));
  if (stage === "PRELIMINARY") return entrants - bracket;
  if (stage === "ROUND_OF_16") return bracket >= 16 ? 8 : 0;
  if (stage === "QUARTER_FINALS") return bracket >= 8 ? 4 : 0;
  if (stage === "SEMI_FINALS") return bracket >= 4 ? 2 : 0;
  if (stage === "FINAL") return 1;
  return 0;
}

function progressLabel(position: number, active: number) {
  return position < active
    ? "FASE SUPERADA"
    : position === active
      ? "ESTEM ACÍ"
      : "PER VINDRE";
}

function currentStage(phase: Phase): Stage {
  if (["SETUP", "DRAW", "GROUP_STAGE", "GROUP_STAGE_COMPLETE"].includes(phase))
    return "GROUP_STAGE";
  return phase;
}

function stageIndex(phase: Phase) {
  return journey.findIndex((stage) => stage.id === currentStage(phase));
}

function matchWins(match: Match, id: string) {
  if (match.status !== "completed") return "–";
  return match.games.filter((game) =>
    id === match.a ? game.a > game.b : game.b > game.a,
  ).length;
}

export function MatchCard({ s, match }: { s: State; match: Match }) {
  return (
    <div
      className={`phase-match ${match.status === "completed" ? "is-finished" : ""} ${match.status === "playing" ? "is-playing" : ""}`}
    >
      <div className="phase-match-meta">
        <span>FUTBOLÍ {match.table}</span>
        <span>
          {match.status === "completed"
            ? "FINALITZAT"
            : match.status === "playing"
              ? "EN JOC"
              : "PENDENT"}
        </span>
      </div>
      {[match.a, match.b].map((id) => (
        <div
          className={`phase-match-team ${match.winner === id ? "winner" : ""}`}
          key={id}
        >
          <b title={teamName(s, id)}>{teamName(s, id)}</b>
          <strong>{matchWins(match, id)}</strong>
        </div>
      ))}
    </div>
  );
}

function GroupCard({ s, table }: { s: State; table: TableId }) {
  const next = queue(s, table)[1];
  const count = s.matches.filter(
    (match) =>
      match.table === table &&
      match.phase === "GROUP_STAGE" &&
      match.status === "completed",
  ).length;
  const total = s.matches.filter(
    (match) => match.table === table && match.phase === "GROUP_STAGE",
  ).length;
  return (
    <section className={`phase-card table-${table}`}>
      <header className="phase-card-heading">
        <span>FUTBOLÍ {table}</span>
        <small>
          {count}/{total} ENFRONTAMENTS
        </small>
      </header>
      <div className="phase-card-body">
        <Standings s={s} table={table} full />
      </div>
      <div className="phase-card-next">
        <span>QUE ES PREPAREN</span>
        <strong>
          {next
            ? `${teamName(s, next.a)}  VS  ${teamName(s, next.b)}`
            : "Sense més partits en esta fase"}
        </strong>
      </div>
    </section>
  );
}

function QualifiedCard({ s, table }: { s: State; table: TableId }) {
  const provisional = standings(s, table).slice(0, 6);
  const ids = s.seeds.length
    ? s.seeds.filter(
        (id) => s.teams.find((team) => team.id === id)?.group === table,
      )
    : provisional.map((row) => row.id);
  return (
    <section className={`phase-card table-${table}`}>
      <header className="phase-card-heading">
        <span>FUTBOLÍ {table}</span>
        <small>{s.seeds.length ? "CLASSIFICATS" : "ZONA DE PAS"}</small>
      </header>
      <div className="qualified-card-list">
        {ids.map((id, index) => (
          <div key={id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{teamName(s, id)}</strong>
            <Trophy aria-hidden="true" />
          </div>
        ))}
        {!ids.length && <p>Pendents dels resultats del grup.</p>}
      </div>
    </section>
  );
}

function KnockoutCard({
  s,
  table,
  stage,
}: {
  s: State;
  table: TableId;
  stage: Stage;
}) {
  const matches = s.matches.filter(
    (match) => match.phase === stage && match.table === table,
  );
  const isPast =
    stageIndex(s.phase) > journey.findIndex((item) => item.id === stage);
  return (
    <section className={`phase-card table-${table}`}>
      <header className="phase-card-heading">
        <span>FUTBOLÍ {table}</span>
        <small>
          {matches.length
            ? `${matches.filter((m) => m.status === "completed").length}/${matches.length} PARTITS`
            : "AL MILLOR DE 3"}
        </small>
      </header>
      <div className="phase-match-list">
        {matches.map((match) => (
          <MatchCard key={match.id} s={s} match={match} />
        ))}
        {!matches.length && (
          <div className="phase-empty">
            {isPast
              ? "Esta ronda no va ser necessària."
              : "Els creuaments apareixeran en acabar la fase anterior."}
          </div>
        )}
      </div>
    </section>
  );
}

export function PhaseClassification({ s }: { s: State }) {
  const [selected, setSelected] = useState<Stage>(() => currentStage(s.phase));
  useEffect(() => setSelected(currentStage(s.phase)), [s.phase]);
  const selectedIndex = journey.findIndex((item) => item.id === selected);
  const currentIndex = stageIndex(s.phase);
  return (
    <div className="phase-classification">
      <div className="phase-view-heading">
        <div>
          <span>EL TORNEIG, RONDA A RONDA</span>
          <h2>
            <BarChart3 /> CLASSIFICACIÓ PER FASES
          </h2>
        </div>
        <strong>
          {selected === "GROUP_STAGE"
            ? "6 PARELLES PASSEN PER FUTBOLÍ"
            : selected === "QUALIFIED"
              ? "18 PARELLES CAP A LA COPA"
              : "ELIMINATÒRIES · AL MILLOR DE 3 PARTIDES"}
        </strong>
      </div>
      <nav className="phase-tabs" aria-label="Fases de classificació">
        {journey.slice(0, 7).map((stage, index) => (
          <button
            key={stage.id}
            className={`${selected === stage.id ? "selected" : ""} ${index < currentIndex ? "passed" : ""} ${index === currentIndex ? "current" : ""}`}
            onClick={() => setSelected(stage.id)}
            aria-current={index === currentIndex ? "step" : undefined}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {stage.short}
          </button>
        ))}
      </nav>
      <div className="phase-grid" key={selected}>
        {selected === "GROUP_STAGE"
          ? tables.map((table) => <GroupCard key={table} s={s} table={table} />)
          : selected === "QUALIFIED"
            ? tables.map((table) => (
                <QualifiedCard key={table} s={s} table={table} />
              ))
            : tables.map((table) => (
                <KnockoutCard
                  key={table}
                  s={s}
                  table={table}
                  stage={selected}
                />
              ))}
      </div>
      {selected === "QUALIFIED" && (
        <div className="phase-footnote">
          {s.seeds.length
            ? `${s.seeds.length} parelles confirmades`
            : `${qualifiers(s).length} parelles en zona de pas provisional`}{" "}
          · Els creuaments es fan entre els primers i els últims classificats.
        </div>
      )}
    </div>
  );
}

export function CupJourney({ s }: { s: State }) {
  const laneRef = useRef<HTMLDivElement>(null);
  const activeIndex = stageIndex(s.phase);
  const entrants =
    s.seeds.length ||
    tables.reduce(
      (total, table) =>
        total +
        Math.min(6, s.teams.filter((team) => team.group === table).length),
      0,
    );
  useEffect(() => {
    const lane = laneRef.current;
    const column = lane?.children.item(activeIndex) as HTMLElement | null;
    if (lane && column)
      lane.scrollTo({
        left: Math.max(
          0,
          column.offsetLeft - lane.offsetLeft - lane.clientWidth / 3,
        ),
        behavior: "smooth",
      });
  }, [activeIndex]);
  return (
    <div className="cup-journey">
      <div className="cup-heading">
        <div>
          <span>DELS TRES FUTBOLINS A LA FINAL</span>
          <h2>
            CAMÍ A LA COPA <Trophy />
          </h2>
        </div>
        <strong>ARA: {phaseNames[s.phase].toUpperCase()}</strong>
      </div>
      <div className="cup-timeline" aria-label="Progrés del torneig">
        {journey.map((stage, index) => (
          <button
            key={stage.id}
            className={`${index < activeIndex ? "passed" : ""} ${index === activeIndex ? "current" : ""}`}
            onClick={() => {
              const lane = laneRef.current;
              const column = lane?.children.item(index) as HTMLElement | null;
              if (lane && column)
                lane.scrollTo({
                  left: Math.max(
                    0,
                    column.offsetLeft - lane.offsetLeft - lane.clientWidth / 3,
                  ),
                  behavior: "smooth",
                });
            }}
          >
            <span>
              {index < activeIndex ? "✓" : String(index + 1).padStart(2, "0")}
            </span>
            <b>{stage.short}</b>
          </button>
        ))}
      </div>
      <div className="cup-lane" ref={laneRef}>
        <section
          className={`cup-column cup-groups ${activeIndex === 0 ? "current" : "passed"}`}
        >
          <header>
            <span>01</span>
            <b>PARELLES PER FUTBOLÍ</b>
            <small>{progressLabel(0, activeIndex)}</small>
          </header>
          <div className="cup-column-content">
            {tables.map((table) => (
              <div className={`cup-group table-${table}`} key={table}>
                <h3>
                  FUTBOLÍ {table}{" "}
                  <small>
                    {s.teams.filter((team) => team.group === table).length}{" "}
                    PARELLES
                  </small>
                </h3>
                <div>
                  {s.teams
                    .filter((team) => team.group === table)
                    .map((team) => (
                      <span key={team.id}>{team.name}</span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section
          className={`cup-column cup-qualified ${activeIndex === 1 ? "current" : activeIndex > 1 ? "passed" : ""}`}
        >
          <header>
            <span>02</span>
            <b>6 CLASSIFICATS PER GRUP</b>
            <small>{progressLabel(1, activeIndex)}</small>
          </header>
          <div className="cup-column-content">
            {tables.map((table) => {
              const ids = s.seeds.length
                ? s.seeds.filter(
                    (id) =>
                      s.teams.find((team) => team.id === id)?.group === table,
                  )
                : standings(s, table)
                    .slice(0, 6)
                    .map((row) => row.id);
              return (
                <div className={`cup-group table-${table}`} key={table}>
                  <h3>
                    FUTBOLÍ {table}{" "}
                    <small>
                      {s.seeds.length ? "CONFIRMATS" : "PROVISIONALS"}
                    </small>
                  </h3>
                  <div>
                    {ids.map((id, index) => (
                      <span key={id}>
                        <i>{index + 1}</i>
                        {teamName(s, id)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        {knockoutStages.map((stage, index) => {
          const matches = s.matches.filter((match) => match.phase === stage);
          const stagePosition = index + 2;
          return (
            <section
              className={`cup-column cup-round ${activeIndex === stagePosition ? "current" : ""} ${activeIndex > stagePosition ? "passed" : ""}`}
              key={stage}
            >
              <header>
                <span>{String(stagePosition + 1).padStart(2, "0")}</span>
                <b>{phaseNames[stage].toUpperCase()}</b>
                <small>{progressLabel(stagePosition, activeIndex)}</small>
              </header>
              <div className="cup-column-content">
                {matches.map((match) => (
                  <MatchCard key={match.id} s={s} match={match} />
                ))}
                {!matches.length &&
                  (expectedMatches(stage, entrants) ? (
                    Array.from(
                      { length: expectedMatches(stage, entrants) },
                      (_, slot) => (
                        <div className="cup-future-match" key={slot}>
                          <span>
                            CREUAMENT {String(slot + 1).padStart(2, "0")}
                          </span>
                          <b>Parella pendent</b>
                          <b>Parella pendent</b>
                        </div>
                      ),
                    )
                  ) : (
                    <div className="cup-placeholder">Ronda no necessària</div>
                  ))}
              </div>
            </section>
          );
        })}
        <section
          className={`cup-column cup-winner ${s.champion ? "current" : ""}`}
        >
          <header>
            <span>08</span>
            <b>LA COPA</b>
            <small>{progressLabel(7, activeIndex)}</small>
          </header>
          <div className="cup-winner-content">
            <TrophyArt />
            <span>CAMPEONS</span>
            <strong>
              {s.champion ? teamName(s, s.champion) : "QUI ALÇARÀ LA COPA?"}
            </strong>
          </div>
        </section>
      </div>
    </div>
  );
}
