import { useEffect, useState, useRef, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Trophy,
  Radio,
  Users,
  ChevronRight,
  Maximize,
} from "lucide-react";
import {
  phaseNames,
  tables,
  type State,
  type TableId,
  type Match,
  type Team,
} from "../engine/types";
import { queue, standings, qualifiers } from "../engine/tournament";
import { Foosball } from "./Foosball";
import { useEventAudio } from "../audio";
import { Presenter } from "./Presenter";
export const teamName = (s: State, id?: string) =>
  s.teams.find((t) => t.id === id)?.name || "Per decidir";
export function TrophyArt() {
  return (
    <svg
      className="trophy-art"
      viewBox="0 0 160 170"
      aria-label="Copa del torneig"
    >
      <defs>
        <linearGradient id="gold">
          <stop stopColor="#ff9c14" />
          <stop offset=".4" stopColor="#fff1a0" />
          <stop offset=".65" stopColor="#ffcc21" />
          <stop offset="1" stopColor="#ec9300" />
        </linearGradient>
      </defs>
      <path
        d="M45 25H18v25q0 35 42 38M115 25h27v25q0 35-42 38"
        fill="none"
        stroke="url(#gold)"
        strokeWidth="12"
      />
      <path
        d="M39 13h82v44q0 40-34 46v29h23v15H50v-15h23v-29Q39 97 39 57z"
        fill="url(#gold)"
      />
      <path d="M44 147h72v14H44z" fill="#d79522" />
      <path
        d="m80 33 6 14 16 2-12 11 3 16-13-8-13 8 3-16-12-11 16-2z"
        fill="#fff2ad"
      />
      <path
        d="M49 22v30"
        stroke="#fff8ce"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function Header({ s, admin = false }: { s: State; admin?: boolean }) {
  return (
    <header className="tournament-header">
      <img
        className="crest"
        src="/assets/escudo.jpeg"
        alt="Escut de la Falla L'Alquerieta i Museu Faller"
      />
      <div className="header-title">
        <div className="eyebrow">FALLA L’ALQUERIETA I MUSEU FALLER</div>
        <h1>
          TORNEIG <span>FUTBOLÍ</span> <em>2027</em>
        </h1>
      </div>
      <div className="header-right">
        <div className="live-badge">
          <Radio size={17} />
          {admin ? "CONTROL DEL TORNEIG" : "EN DIRECTE"}
        </div>
        <span>
          {s.demo ? "DEMOSTRACIÓ · DADES FICTÍCIES" : phaseNames[s.phase]}
        </span>
      </div>
    </header>
  );
}
export function Standings({
  s,
  table,
  full = false,
}: {
  s: State;
  table: TableId;
  full?: boolean;
}) {
  const rows = standings(s, table);
  return (
    <div className="standings">
      <div className="section-label">
        <BarChart3 size={15} /> CLASSIFICACIÓ{" "}
        <span>PASSEN {Math.min(6, rows.length)}</span>
      </div>
      <div className={`ranking-row ranking-head ${full ? "full" : ""}`}>
        <span>#</span>
        <span>PARELLA</span>
        <span>PJ</span>
        {full && (
          <>
            <span>PG</span>
            <span>PP</span>
            <span>GF</span>
            <span>GC</span>
            <span>DIF</span>
          </>
        )}
        <span>PTS</span>
      </div>
      {rows.slice(0, full ? 30 : 6).map((r, i) => (
        <motion.div
          layout
          transition={{ duration: 0.7 }}
          key={r.id}
          className={`ranking-row ${full ? "full" : ""} ${i < 6 ? "qualified" : ""} ${i === 5 ? "cut" : ""}`}
        >
          <span className="rank">{i + 1}</span>
          <span className="rank-name">
            {teamName(s, r.id)}
            {r.tied && <small title="Empat pendent"> ≈</small>}
          </span>
          <span>{r.played}</span>
          {full && (
            <>
              <span>{r.won}</span>
              <span>{r.lost}</span>
              <span>{r.gf}</span>
              <span>{r.gc}</span>
              <span>
                {r.diff > 0 ? "+" : ""}
                {r.diff}
              </span>
            </>
          )}
          <strong>{r.points}</strong>
        </motion.div>
      ))}
      {!rows.length && (
        <p className="empty-small">
          Les parelles apareixeran després del sorteig.
        </p>
      )}
    </div>
  );
}
export function TableLiveCard({
  s,
  table,
  compact = false,
}: {
  s: State;
  table: TableId;
  compact?: boolean;
}) {
  const q = queue(s, table),
    m = q[0],
    next = q[1];
  const groupMs = s.matches.filter(
      (x) => x.table === table && x.phase === "GROUP_STAGE",
    ),
    done = groupMs.filter((x) => x.status === "completed").length;
  const last = s.matches
    .filter((x) => x.table === table && x.status === "completed")
    .at(-1);
  const a = s.teams.find((t) => t.id === m?.a),
    b = s.teams.find((t) => t.id === m?.b);
  return (
    <section className={`live-card table-${table} ${compact ? "compact" : ""}`}>
      <div className="table-card-header">
        <h2>
          FUTBOLÍ <b>{table}</b>
        </h2>
        <span className={`status ${m ? "on" : ""}`}>
          {m
            ? "EN JOC"
            : s.phase === "SETUP" || s.phase === "DRAW"
              ? "PREPARANT"
              : s.phase === "CHAMPION"
                ? "FINALITZAT"
                : "EN ESPERA"}
        </span>
      </div>
      <div className="live-card-body">
        <div className="current-kicker">
          {m ? "ARA JUGUEN" : "FUTBOLÍ DISPONIBLE"}
          <span>{m ? phaseNames[m.phase] : "Bona partida!"}</span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={m?.id || "idle"}
            className="match-players"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <TeamLabel team={a} />
            <span className="versus">VS</span>
            <TeamLabel team={b} />
          </motion.div>
        </AnimatePresence>
        <Foosball active={!!m} table={table} />
        <div className="match-foot">
          {last ? (
            <>
              <span>ÚLTIM RESULTAT</span>
              <b title={`${teamName(s, last.a)} / ${teamName(s, last.b)}`}>
                {teamName(s, last.a)}{" "}
                <i>{last.games.map((g) => `${g.a}–${g.b}`).join(" / ")}</i>{" "}
                {teamName(s, last.b)}
              </b>
            </>
          ) : (
            <>
              <span>{m ? "PARTIT EN CURS" : "A PUNT PER A JUGAR"}</span>
              <b>
                {m
                  ? "Esperant el resultat de l’organització"
                  : "Joc net. Bona companyia."}
              </b>
            </>
          )}
        </div>
      </div>
      <div className="next-match">
        <span>
          DESPRÉS <ChevronRight size={14} />
        </span>
        <b>
          {next
            ? `${teamName(s, next.a)} · ${teamName(s, next.b)}`
            : m
              ? "Últim enfrontament d’esta fase"
              : s.phase === "CHAMPION"
                ? "Gràcies per participar!"
                : "Esperant la següent ronda"}
        </b>
      </div>
      {!compact && (
        <>
          <Standings s={s} table={table} />
          <div className="table-progress">
            <span>
              {done} / {groupMs.length} ENFRONTAMENTS
            </span>
            <b>
              {groupMs.length ? Math.round((done / groupMs.length) * 100) : 0}%
            </b>
            <div>
              <i
                style={{
                  width: `${groupMs.length ? (done / groupMs.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
function TeamLabel({ team }: { team?: Team }) {
  return (
    <div className="team-label">
      <strong>{team?.shortName || team?.name || "—"}</strong>
      <span>{team ? "Parella en joc" : "Sense partit assignat"}</span>
    </div>
  );
}
export const tvViews = [
  { id: "live", label: "En directe", icon: Activity },
  { id: "standings", label: "Classificació", icon: BarChart3 },
  { id: "bracket", label: "Camí a la copa", icon: Trophy },
];
export function Bracket({ s }: { s: State }) {
  const phases: Match["phase"][] = [
    "PRELIMINARY",
    "ROUND_OF_16",
    "QUARTER_FINALS",
    "SEMI_FINALS",
    "FINAL",
  ];
  return (
    <div className="bracket">
      {phases.map((p) => (
        <section
          className={`bracket-round ${s.phase === p ? "current" : ""}`}
          key={p}
        >
          <div className="section-label">{phaseNames[p]}</div>
          <div className="round-matches">
            {s.matches
              .filter((m) => m.phase === p)
              .map((m) => (
                <div
                  className={`bracket-match ${m.status === "completed" ? "finished" : ""}`}
                  key={m.id}
                >
                  {[m.a, m.b].map((id) => (
                    <div key={id} className={m.winner === id ? "winner" : ""}>
                      <small>{s.seeds.indexOf(id) + 1}</small>
                      <b>{teamName(s, id)}</b>
                      <strong>
                        {m.status === "completed"
                          ? m.games.filter((g) =>
                              id === m.a ? g.a > g.b : g.b > g.a,
                            ).length
                          : "—"}
                      </strong>
                    </div>
                  ))}
                </div>
              ))}
            {!s.matches.some((m) => m.phase === p) && (
              <div className="bracket-placeholder">
                {s.phase === "SETUP" ? "El camí comença ací" : "Per decidir"}
                <span>Millor seed vs pitjor seed</span>
              </div>
            )}
          </div>
        </section>
      ))}
      <section className="bracket-champion">
        <TrophyArt />
        <span>CAMPEONS</span>
        <strong>
          {s.champion ? teamName(s, s.champion) : "Qui alçarà la copa?"}
        </strong>
      </section>
    </div>
  );
}
export function Upcoming({ s }: { s: State }) {
  return (
    <div className="three-columns upcoming">
      {tables.map((t) => (
        <section className={`content-panel table-${t}`} key={t}>
          <h3>FUTBOLÍ {t}</h3>
          {queue(s, t)
            .slice(0, 5)
            .map((m, i) => (
              <div className="upcoming-row" key={m.id}>
                <span>
                  {i === 0
                    ? "ARA"
                    : i === 1
                      ? "PRÒXIM"
                      : String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <b>{teamName(s, m.a)}</b>
                  <small>contra</small>
                  <b>{teamName(s, m.b)}</b>
                </div>
              </div>
            ))}
          {!queue(s, t).length && (
            <p className="empty-small">No queden partits en esta fase.</p>
          )}
        </section>
      ))}
    </div>
  );
}
export function Qualified({ s }: { s: State }) {
  const ids = s.seeds.length ? s.seeds : qualifiers(s).map((r) => r.id);
  return (
    <div className="qualified-scene">
      <div className="qualified-intro">
        <TrophyArt />
        <h2>
          {ids.length} PARELLES
          <br />
          <span>{s.seeds.length ? "CLASSIFICADES" : "EN ZONA DE PAS"}</span>
        </h2>
        <p>
          {s.seeds.length
            ? "El camí cap a la copa continua."
            : "Classificació provisional · passen fins a 6 per grup"}
        </p>
      </div>
      <div className="seed-grid">
        {ids.map((id, i) => (
          <motion.div layout className="seed" key={id}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            <div>
              <b>{teamName(s, id)}</b>
              <small>Futbolí {s.teams.find((t) => t.id === id)?.group}</small>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
function Celebration({ s }: { s: State }) {
  const team = s.teams.find((t) => t.id === s.champion);
  return (
    <div className="champion-scene">
      <div className="confetti">
        {Array.from({ length: 36 }, (_, i) => (
          <i
            key={i}
            style={{ left: `${i * 2.9}%`, "--i": i } as CSSProperties}
          />
        ))}
      </div>
      <img
        className="champion-mascot"
        src="/assets/mascota.png"
        alt="Mascota celebrant"
      />
      <div>
        <div className="eyebrow">TORNEIG FUTBOLÍ 2027</div>
        <h2>{team ? "CAMPEONS!" : "GRAN FINAL"}</h2>
        <h3>
          {team?.name ||
            s.matches
              .filter((m) => m.phase === "FINAL")
              .map((m) => `${teamName(s, m.a)} · ${teamName(s, m.b)}`)
              .join("") ||
            "El gran moment està per arribar"}
        </h3>
        <p>Tota la falla amb vosaltres!</p>
      </div>
      <TrophyArt />
    </div>
  );
}
export function TV({ s }: { s: State }) {
  useEventAudio(s);
  const previousView = useRef(s.settings.view);
  const path = location.pathname.split("/")[2];
  const [view, setView] = useState(
    path === "classification"
      ? "standings"
      : path || (s.phase === "CHAMPION" ? "champion" : s.settings.view),
  );
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState<State["events"][number] | null>(null);
  const [cursor, setCursor] = useState(true);
  const last = s.events.at(-1);
  useEffect(() => {
    if (previousView.current !== s.settings.view) {
      setView(s.settings.view);
      previousView.current = s.settings.view;
    }
  }, [s.settings.view]);
  useEffect(() => {
    if (!s.settings.auto || s.phase === "CHAMPION") return;
    const views = [
      "GROUP_STAGE",
      "GROUP_STAGE_COMPLETE",
      "SETUP",
      "DRAW",
    ].includes(s.phase)
      ? ["live", "standings", "upcoming"]
      : ["live", "bracket", "qualified"];
    const timer = setInterval(
      () => setView((v) => views[(views.indexOf(v) + 1) % views.length]),
      s.settings.seconds * 1000,
    );
    return () => clearInterval(timer);
  }, [s.settings.auto, s.settings.seconds, s.phase]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!last || Date.now() - last.at > 15000) return;
    setNotice(last);
    if (last.kind === "champion") setView("champion");
    const timeout = setTimeout(
      () => setNotice(null),
      last.kind === "champion" ? 5000 : 3500,
    );
    return () => clearTimeout(timeout);
  }, [last?.id]);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const move = () => {
      setCursor(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setCursor(false), 3000);
    };
    window.addEventListener("mousemove", move);
    move();
    return () => {
      window.removeEventListener("mousemove", move);
      clearTimeout(timeout);
    };
  }, []);
  const compact = view !== "live";
  return (
    <div
      className={`tv-screen ${compact ? "has-detail" : ""} ${!cursor ? "hide-cursor" : ""}`}
    >
      <Header s={s} />
      <div className="broadcast-strip">
        <span>
          <Users size={16} />
          {s.teams.length} PARELLES
        </span>
        <span>3 FUTBOLINS</span>
        <span>2 PARTIDES PER ENFRONTAMENT</span>
        <span>1 PUNT PER PARTIDA GUANYADA</span>
        <b>{phaseNames[s.phase]}</b>
      </div>
      <main className="tv-main">
        <div className="three-columns persistent-tables">
          {tables.map((t) => (
            <TableLiveCard s={s} table={t} compact={compact} key={t} />
          ))}
        </div>
        {compact && (
          <motion.div
            className="tv-detail"
            key={view}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {view === "standings" ? (
              <div className="three-columns">
                {tables.map((t) => (
                  <section key={t} className={`content-panel table-${t}`}>
                    <Standings s={s} table={t} full />
                  </section>
                ))}
              </div>
            ) : view === "upcoming" ? (
              <Upcoming s={s} />
            ) : view === "qualified" ? (
              <Qualified s={s} />
            ) : view === "champion" || view === "final" ? (
              <Celebration s={s} />
            ) : (
              <Bracket s={s} />
            )}
          </motion.div>
        )}
      </main>
      <AnimatePresence>
        {notice && notice.kind !== "champion" && (
          <motion.aside
            className={`broadcast-notice ${notice.kind}`}
            initial={{ x: 500, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            key={notice.id}
          >
            {notice.kind === "phase" ? (
              <Presenter s={s} event={notice} />
            ) : (
              <>
                {notice.kind !== "result" && (
                  <img src="/assets/mascota.png" alt="La mascota anuncia" />
                )}
                <div>
                  <span>
                    {notice.kind === "result"
                      ? "ÚLTIMA HORA"
                      : "LA MASCOTA ANUNCIA"}
                  </span>
                  <strong>{notice.title}</strong>
                  <p>{notice.detail}</p>
                  {notice.teams.length > 2 && (
                    <div className="announced-teams">
                      {notice.teams.map((id) => teamName(s, id)).join(" · ")}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
      <footer className="tv-footer">
        <div className="footer-brand">
          JOC NET.
          <br />
          <b>GRAN FALLA!</b>
        </div>
        <nav>
          {tvViews.map((v) => (
            <button
              key={v.id}
              className={view === v.id ? "active" : ""}
              onClick={() => setView(v.id)}
            >
              <v.icon size={18} />
              {v.label}
            </button>
          ))}
        </nav>
        <div className="clock">
          {new Date(now).toLocaleTimeString("ca-ES", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          <small>{s.settings.auto ? "AUTO TV" : "VISTA FIXADA"}</small>
        </div>
        <button
          className="fullscreen"
          aria-label="Pantalla completa"
          onClick={() =>
            document.documentElement.requestFullscreen?.().catch(() => {})
          }
        >
          <Maximize size={17} />
        </button>
      </footer>
      <div className="bottom-stripe" />
    </div>
  );
}
