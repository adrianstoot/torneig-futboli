import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type CSSProperties,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Download,
  FlaskConical,
  History,
  Maximize,
  Music2,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Settings,
  Shuffle,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  useTournament,
  commit,
  exportTournament,
  getState,
  recoveryError,
  undo,
} from "../store";
import {
  addTeam,
  advance,
  draw,
  event,
  hasSeedTies,
  qualifiers,
  queue,
  saveResult,
  standings,
  startGroups,
  validateGames,
  validateState,
} from "../engine/tournament";
import {
  initialState,
  phaseNames,
  tables,
  uid,
  type Game,
  type Match,
  type State,
  type TableId,
  type Team,
} from "../engine/types";
import { simulateRound } from "../engine/practice";
import { useEventAudio } from "../audio";
import { Table3D } from "./Table3D";
import { MascotActor } from "./MascotActor";
import { Bracket, Qualified, Standings, TrophyArt, teamName } from "./TV";
import {
  Dialog,
  Draw,
  ResultEditor,
  Results,
  SettingsPanel,
  TieResolver,
} from "./Admin";

type View =
  | "live"
  | "standings"
  | "upcoming"
  | "bracket"
  | "qualified"
  | "final"
  | "champion";
type Panel = "teams" | "settings" | "results" | "ties" | null;
const views = [
  { id: "live", label: "Seguiment en directe", Icon: Radio },
  { id: "standings", label: "Classificació", Icon: BarChart3 },
  { id: "upcoming", label: "Pròxims enfrontaments", Icon: CalendarDays },
  { id: "bracket", label: "Camí a la copa", Icon: Trophy },
] as const;

export function BroadcastApp() {
  const s = useTournament();
  useEventAudio(s);
  const [view, setView] = useState<View>(
    s.phase === "CHAMPION" ? "champion" : "live",
  );
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultEditor, setResultEditor] = useState<Match | null>(null);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    body: string;
    action: () => void | Promise<unknown>;
  } | null>(null);
  const [notice, setNotice] = useState<State["events"][number] | null>(null);
  const [interaction, setInteraction] = useState("");
  const [artReady, setArtReady] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [tournamentTransition, setTournamentTransition] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(
    () => localStorage.getItem("futboli-background-music") !== "off",
  );
  const [musicStarted, setMusicStarted] = useState(false);
  const musicRef = useRef<HTMLAudioElement>(null);
  const [clock, setClock] = useState(Date.now());
  const last = s.events.at(-1);
  const started = !["SETUP", "DRAW"].includes(s.phase);
  const round = s.matches.filter((m) => m.phase === s.phase);
  const roundDone =
    round.length > 0 && round.every((m) => m.status === "completed");
  const tied =
    started &&
    (tables.some((t) => standings(s, t).some((r) => r.tied)) || hasSeedTies(s));
  async function run(fn: () => void | Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No s’ha pogut completar l’acció.",
      );
    } finally {
      setBusy(false);
    }
  }
  const confirm = (
    title: string,
    body: string,
    action: () => void | Promise<unknown>,
  ) => setConfirmation({ title, body, action });
  useEffect(() => {
    const image = new Image();
    image.onload = () => setArtReady(true);
    image.src = `${import.meta.env.BASE_URL}assets/arena-background.png`;
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!last || Date.now() - last.at > 20000) return;
    setNotice(last);
    if (last.kind === "champion") setView("champion");
    const timer = setTimeout(
      () => setNotice(null),
      last.kind === "phase"
        ? Math.max(7000, last.teams.length * 1500)
        : last.kind === "champion"
          ? 14000
          : 5000,
    );
    return () => clearTimeout(timer);
  }, [last?.id]);
  useEffect(() => {
    if (!s.settings.auto || !started || s.phase === "CHAMPION" || panel) return;
    const pages: View[] =
      s.phase === "GROUP_STAGE"
        ? ["live", "standings", "upcoming"]
        : ["live", "bracket", "qualified"];
    const timer = setInterval(() => {
      if (document.activeElement?.matches("input,textarea")) return;
      setView((v) => pages[(pages.indexOf(v) + 1) % pages.length]);
    }, s.settings.seconds * 1000);
    return () => clearInterval(timer);
  }, [s.settings.auto, s.settings.seconds, s.phase, panel, started]);
  useEffect(() => {
    const v = s.settings.view as View;
    if (
      [
        "live",
        "standings",
        "upcoming",
        "bracket",
        "qualified",
        "final",
        "champion",
      ].includes(v)
    )
      setView(v);
  }, [s.settings.view]);
  useEffect(() => {
    const audio = musicRef.current;
    if (!audio || !musicStarted) return;
    if (!musicEnabled) {
      audio.pause();
      return;
    }
    audio.volume = 0.55;
    void audio.play().catch(() => undefined);
  }, [musicEnabled, musicStarted]);
  const changeView = (v: View) => {
    setView(v);
    void run(() =>
      commit(
        (x) => ({ ...x, settings: { ...x.settings, view: v, auto: false } }),
        false,
      ),
    );
  };
  const advancePhase = () =>
    run(async () => {
      await commit(advance);
      setNotice(getState().events.at(-1) || null);
      const phase = getState().phase;
      setView(
        phase === "QUALIFIED"
          ? "qualified"
          : phase === "FINAL"
            ? "final"
            : "live",
      );
      setPanel(null);
    });
  useEffect(() => {
    if (s.phase === "CHAMPION") setView("champion");
    else if (s.phase === "FINAL") setView("final");
  }, [s.phase]);
  useEffect(() => {
    if (!interaction) return;
    const timer = setTimeout(() => setInteraction(""), 6500);
    return () => clearTimeout(timer);
  }, [interaction]);
  const guide = buildGuide(s, tied, roundDone);
  const guideAction = () => {
    if (s.phase === "SETUP") void run(() => commit(draw));
    else if (s.phase === "DRAW") void run(() => commit(startGroups));
    else if (s.phase === "GROUP_STAGE_COMPLETE" && tied) setPanel("ties");
    else if (s.phase === "CHAMPION") {
      setView("champion");
      void run(() =>
        commit((x) =>
          event(x, "champion", "CAMPEONS!", teamName(x, x.champion!), [
            x.champion!,
          ]),
        ),
      );
    } else advancePhase();
  };
  const drawFromRegistration = () =>
    run(async () => {
      await commit((current) => {
        if (current.teams.length > 0) return draw(current);
        const teams = Array.from({ length: 30 }, (_, i) => {
          const name = `Parella ${String(i + 1).padStart(2, "0")}`;
          return {
            id: uid(),
            name,
            player1: name,
            player2: name,
            shortName: "",
            group: null,
          };
        });
        return draw({ ...current, teams });
      });
      setTournamentTransition(true);
    });
  return (
    <div
      className={`arena-app ${artReady ? "art-ready" : ""} ${started ? "tournament-started" : "pre-tournament"} ${focusMode ? "audience-focus" : ""} view-${view}`}
    >
      <div className="arena-backdrop" />
      <div className="arena-energy" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <header className="arena-brand">
        <h1 className={artReady ? "sr-only" : ""}>
          TORNEIG <span>FUTBOLÍ</span> 2027
          <small>Falla L’Alquerieta i Museu Faller</small>
        </h1>
        <div className="arena-live">
          <Radio />
          {s.demo ? "MODE PROVA" : "EN DIRECTE"}
        </div>
      </header>
      <div className="arena-toolbar">
        <div className="rule-tokens">
          <span>
            <Users />
            {s.teams.length} <b>PARELLES</b>
          </span>
          <span>3 FUTBOLINS</span>
          <span>
            <Trophy />
            {phaseNames[s.phase]}
          </span>
          <span className="wide-rule">
            2 partides · 1 punt per partida guanyada
          </span>
        </div>
        <div className="arena-tools">
          <button
            title="So"
            aria-label={s.settings.sound ? "Desactivar so" : "Activar so"}
            onClick={() =>
              run(() =>
                commit(
                  (x) => ({
                    ...x,
                    settings: { ...x.settings, sound: !x.settings.sound },
                  }),
                  false,
                ),
              )
            }
          >
            {s.settings.sound ? <Volume2 /> : <VolumeX />}
          </button>
          <button
            title={
              musicEnabled
                ? "Desactivar música de fondo"
                : "Activar música de fondo"
            }
            aria-label={
              musicEnabled
                ? "Desactivar música de fondo"
                : "Activar música de fondo"
            }
            onClick={() => {
              const next = !musicEnabled;
              setMusicEnabled(next);
              localStorage.setItem(
                "futboli-background-music",
                next ? "on" : "off",
              );
            }}
          >
            <Music2 className={musicEnabled ? "music-active" : "music-muted"} />
          </button>
          <button
            title="Eines i còpies"
            aria-label="Ajustos"
            onClick={() => setPanel("settings")}
          >
            <Settings />
          </button>
          <button
            title="Pantalla completa"
            aria-label="Pantalla completa"
            onClick={() =>
              document.fullscreenElement
                ? document.exitFullscreen()
                : document.documentElement.requestFullscreen().catch(() => {})
            }
          >
            <Maximize />
          </button>
        </div>
      </div>
      {!started ? (
        <main className="arena-onboarding">
          {s.phase === "SETUP" ? (
            <Registration s={s} run={run} onDraw={drawFromRegistration} />
          ) : (
            <div className="arena-draw">
              <Draw
                s={s}
                run={run}
                onStart={() => run(() => commit(startGroups))}
              />
              <button className="arena-link" onClick={() => setPanel("teams")}>
                Editar parelles abans de començar
              </button>
            </div>
          )}
        </main>
      ) : (
        <main className="arena-tournament">
          <div
            className={`arena-tables ${["bracket", "qualified", "final", "champion"].includes(view) ? "short-tables" : ""}`}
          >
            {tables.map((table) => (
              <LiveBoard
                key={table}
                s={s}
                table={table}
                view={view}
                controls={!focusMode}
                onInteraction={setInteraction}
                onSave={async (match, games) => {
                  await commit((x) => {
                    if (queue(x, table)[0]?.id !== match.id)
                      throw Error(
                        "Este partit ja ha canviat. Revisa el nou enfrontament.",
                      );
                    return saveResult(x, match.id, games);
                  });
                  setInteraction("");
                }}
              />
            ))}
          </div>
          {["bracket", "qualified", "final", "champion"].includes(view) && (
            <div className="arena-stage-detail">
              <AnimatePresence mode="wait">
                <motion.div
                  className="arena-view"
                  key={view}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.38 }}
                >
                  {view === "bracket" ? (
                    <Bracket s={s} />
                  ) : view === "qualified" ? (
                    <Qualified s={s} />
                  ) : view === "final" ? (
                    <FinalScene s={s} />
                  ) : (
                    <Champion s={s} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </main>
      )}
      <div className="arena-guide">
        <div className="guide-avatar">
          <MascotActor
            mood={
              s.phase === "CHAMPION"
                ? "celebrate"
                : notice?.kind === "result"
                  ? "celebrate"
                  : "point"
            }
          />
        </div>
        <div className="ticker-window" aria-label="Ròtul del torneig">
          <div className="ticker-track">
            <span>
              COMENÇA EL TORNEIG! PARELLES, ACOSTEU-VOS ALS FUTBOLINS… QUE
              COMENCE EL JOC!
            </span>
            <b>✦</b>
            <span>
              COMENÇA EL TORNEIG! PARELLES, ACOSTEU-VOS ALS FUTBOLINS… QUE
              COMENCE EL JOC!
            </span>
            <b>✦</b>
            <span>
              COMENÇA EL TORNEIG! PARELLES, ACOSTEU-VOS ALS FUTBOLINS… QUE
              COMENCE EL JOC!
            </span>
            <b>✦</b>
          </div>
        </div>
        <div className="guide-actions">
          {guide.action && (s.phase as string) !== "SETUP" && (
            <button
              className="arena-primary"
              disabled={busy || (s.phase === "SETUP" && s.teams.length < 6)}
              onClick={guideAction}
            >
              {guide.action}
              <ChevronRight />
            </button>
          )}
          {s.demo &&
            started &&
            s.phase !== "CHAMPION" &&
            round.some((m) => m.status !== "completed") && (
              <button
                className="arena-secondary"
                onClick={() =>
                  confirm(
                    "Simular la resta de la fase",
                    "Només en mode prova: el sistema generarà els resultats pendents d’esta fase. També pots introduir-los tu en cada futbolí.",
                    () => run(() => commit(simulateRound)),
                  )
                }
              >
                <FlaskConical />
                Simular fase
              </button>
            )}
        </div>
      </div>
      <AnimatePresence>
        {tournamentTransition && (
          <motion.div
            className="tournament-transition"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            role="dialog"
            aria-label="Comença el torneig"
          >
            <video
              className="tournament-transition-video"
              src={`${import.meta.env.BASE_URL}futbolin-transicion-inicio-torneo.mp4`}
              autoPlay
              playsInline
              onEnded={() => {
                setTournamentTransition(false);
                setMusicStarted(true);
              }}
              onError={() => {
                setTournamentTransition(false);
                setMusicStarted(true);
              }}
            />
            <button
              className="tournament-transition-skip"
              onClick={() => {
                setTournamentTransition(false);
                setMusicStarted(true);
              }}
            >
              OMITIR
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <audio
        ref={musicRef}
        src={`${import.meta.env.BASE_URL}musica-fondo-app-tv.wav`}
        loop
        preload="auto"
        aria-hidden="true"
      />
      <footer className="arena-footer">
        <div className="footer-wordmark">
          JOC NET.<b>GRAN FALLA!</b>
        </div>
        <nav aria-label="Vistes del torneig">
          {views.map(({ id, label, Icon }) => (
            <button
              key={id}
              disabled={!started}
              className={view === id && started ? "selected" : ""}
              onClick={() => changeView(id)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div className="footer-actions">
          <button
            title="Historial i correccions"
            aria-label="Resultats i historial"
            onClick={() => setPanel("results")}
          >
            <History />
          </button>
          <button
            title="Desfer última acció"
            aria-label="Desfer última acció"
            onClick={() => run(undo)}
          >
            <RotateCcw />
          </button>
          <button
            title={focusMode ? "Mostrar controls" : "Ocultar controls"}
            aria-label={focusMode ? "Mostrar controls" : "Ocultar controls"}
            onClick={() => setFocusMode(!focusMode)}
          >
            {focusMode ? <Play /> : <Pause />}
          </button>
          <time>
            {new Date(clock).toLocaleTimeString("ca-ES", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </div>
      </footer>
      {(error || recoveryError) && (
        <div className="arena-error" role="alert">
          <span>{error || recoveryError}</span>
          <button aria-label="Tancar avís" onClick={() => setError("")}>
            <X />
          </button>
        </div>
      )}
      <AnimatePresence>
        {notice?.kind === "phase" && started && notice.teams.length > 0 && (
          <Ceremony
            key={notice.id}
            event={notice}
            s={s}
            onClose={() => setNotice(null)}
          />
        )}
      </AnimatePresence>
      {panel && (
        <Dialog
          title={
            {
              teams: "Parelles del torneig",
              settings: "Eines del torneig",
              results: "Resultats i correccions",
              ties: "Desempats i classificats",
            }[panel]
          }
          onClose={() => setPanel(null)}
        >
          <div className={`arena-panel panel-${panel}`}>
            {panel === "teams" ? (
              <Registration
                s={s}
                run={run}
                onDraw={() =>
                  run(async () => {
                    await commit(draw);
                    setPanel(null);
                  })
                }
              />
            ) : panel === "settings" ? (
              <SettingsPanel
                s={s}
                run={run}
                confirm={confirm}
                onReset={() => {
                  setPanel(null);
                  setView("live");
                }}
              />
            ) : panel === "results" ? (
              <Results
                s={s}
                run={run}
                confirm={confirm}
                onEdit={(m) => {
                  setPanel(null);
                  setResultEditor(m);
                }}
              />
            ) : (
              <>
                <p className="tie-instructions">
                  Revisa els criteris i confirma l’ordre només per a les
                  parelles que continuen empatades. Després podràs anunciar els
                  classificats.
                </p>
                <TieResolver s={s} run={run} />
                <button className="arena-primary" onClick={advancePhase}>
                  CONFIRMAR CLASSIFICATS <Trophy />
                </button>
              </>
            )}
          </div>
        </Dialog>
      )}
      {confirmation && (
        <Dialog
          title={confirmation.title}
          onClose={() => setConfirmation(null)}
        >
          <p className="dialog-description">{confirmation.body}</p>
          <div className="dialog-actions">
            <button
              className="button subtle"
              onClick={() => setConfirmation(null)}
            >
              Cancel·lar
            </button>
            <button
              className="button yellow"
              onClick={() => {
                const action = confirmation.action;
                setConfirmation(null);
                void run(action);
              }}
            >
              CONFIRMAR
            </button>
          </div>
        </Dialog>
      )}
      {resultEditor && (
        <ResultEditor
          s={s}
          match={resultEditor}
          onClose={() => setResultEditor(null)}
          onSave={async (games) => {
            await commit((x) => saveResult(x, resultEditor.id, games));
            setResultEditor(null);
          }}
        />
      )}
    </div>
  );
}

function buildGuide(s: State, tied: boolean, roundDone: boolean) {
  if (s.phase === "SETUP")
    return {
      title: s.teams.length
        ? `${s.teams.length} parelles inscrites. Qui més s’apunta?`
        : "Comencem per les parelles!",
      detail:
        "Inscriu les parelles o activa el mode prova amb 30 equips creats automàticament.",
      action: "REALITZAR SORTEIG",
    };
  if (s.phase === "DRAW")
    return {
      title: "Ja tenim els tres grups!",
      detail:
        "Revisa el sorteig. Si hi ha una baixa, podem adaptar els grups abans de començar.",
      action: "CONFIRMAR I COMENÇAR",
    };
  if (s.phase === "GROUP_STAGE_COMPLETE")
    return {
      title: tied
        ? "Grups completats! Resolem els empats."
        : "Ja tenim les parelles classificades!",
      detail: tied
        ? "L’organització decidix els empats que els criteris esportius no han resolt."
        : "La mascota anunciarà totes les parelles que continuen cap a la copa.",
      action: tied ? "REVISAR DESEMPATS" : "ANUNCIAR CLASSIFICATS",
    };
  if (s.phase === "QUALIFIED")
    return {
      title: `${s.seeds.length} parelles continuen el torneig!`,
      detail:
        "Els primers contra els últims. Preparem els enfrontaments de la següent fase.",
      action: "COMENÇAR ELIMINATÒRIES",
    };
  if (s.phase === "CHAMPION")
    return {
      title: `Enhorabona, ${teamName(s, s.champion!)}!`,
      detail: "Gràcies a totes les parelles. Joc, amistat i falla!",
      action: "REPETIR CELEBRACIÓ",
    };
  if (roundDone)
    return {
      title: `${phaseNames[s.phase]} completats. Endavant, campions!`,
      detail:
        "Tots els resultats estan guardats. Ja podem anunciar els supervivents.",
      action: "ANUNCIAR SEGÜENT RONDA",
    };
  return {
    title: "Posa el resultat directament en cada futbolí.",
    detail:
      "Escriu les dues partides i confirma. El sistema actualitza els punts i posa en joc la parella següent.",
    action: null,
  };
}

function Registration({
  s,
  run,
  onDraw,
}: {
  s: State;
  run: (fn: () => void | Promise<unknown>) => Promise<void>;
  onDraw: () => void;
}) {
  const [name, setName] = useState(""),
    [editing, setEditing] = useState<Team | null>(null),
    [bulk, setBulk] = useState(""),
    [bulkOpen, setBulkOpen] = useState(false);
  const locked = !["SETUP", "DRAW"].includes(s.phase);
  async function add(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      await commit((x) =>
        addTeam(x, {
          id: editing?.id || uid(),
          name: name.trim(),
          // Kept internally for backwards-compatible saved tournaments; never shown.
          player1: name.trim(),
          player2: name.trim(),
          shortName: editing?.shortName || "",
          group: editing?.group || null,
        }),
      );
      setName("");
      setEditing(null);
    });
  }
  return (
    <div className="registration">
      <div className="registration-main">
        <div className="registration-title">
          <span>01 · PREPAREM EL TORNEIG</span>
          <h2>
            QUI JUGA <em>ENGUANY?</em>
          </h2>
          <p>Apunta la teua parella. Nosaltres ens encarreguem de la resta.</p>
        </div>
        <form className="registration-form" onSubmit={add}>
          <label className="pair-name pair-name-primary">
            NOM DE LA PARELLA
            <input
              required
              maxLength={80}
              value={name}
              disabled={locked}
              onChange={(e) => setName(e.target.value)}
              placeholder="Exemple: Els Esclatasangs"
            />
          </label>
          <button className="arena-primary" disabled={locked} type="submit">
            <Plus />
            {editing ? "GUARDAR CANVIS" : "AFEGIR PARELLA"}
          </button>
          {editing && (
            <button
              type="button"
              className="arena-secondary"
              onClick={() => {
                setEditing(null);
                setName("");
              }}
            >
              Cancel·lar edició
            </button>
          )}
        </form>
        <div className="registered-heading">
          <h3>
            <Users /> PARELLES INSCRITES <b>{s.teams.length}/30</b>
          </h3>
        </div>
        {bulkOpen && (
          <div className="registration-bulk">
            <label>
              Una parella per línia: només el nom de l’equip
              <textarea
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                rows={3}
              />
            </label>
            <button
              className="arena-secondary"
              onClick={() =>
                run(async () => {
                  await commit((x) => {
                    for (const line of bulk
                      .split("\n")
                      .filter((l) => l.trim())) {
                      const name = line.trim();
                      if (!name) throw Error("Escriu el nom de cada parella.");
                      x = addTeam(x, {
                        id: uid(),
                        name,
                        player1: name,
                        player2: name,
                        shortName: "",
                        group: null,
                      });
                    }
                    return x;
                  });
                  setBulk("");
                  setBulkOpen(false);
                })
              }
            >
              AFEGIR TOTES
            </button>
          </div>
        )}
        <div className="registered-list">
          {s.teams.length ? (
            s.teams.map((t, i) => (
              <div className="registered-team" key={t.id}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <button
                  className="registered-name"
                  disabled={locked}
                  onClick={() => {
                    setEditing(t);
                    setName(t.name);
                  }}
                >
                  <b>{t.name}</b>
                </button>
                <button
                  title={`Retirar ${t.name}`}
                  disabled={locked}
                  aria-label={`Retirar ${t.name}`}
                  onClick={() =>
                    run(() =>
                      commit((x) => ({
                        ...x,
                        teams: x.teams.filter((a) => a.id !== t.id),
                      })),
                    )
                  }
                >
                  <X />
                </button>
              </div>
            ))
          ) : (
            <div className="registration-empty">
              <Users />
              <b>La primera parella obri el torneig.</b>
              <span>La següent podeu ser vosaltres!</span>
            </div>
          )}
        </div>
      </div>
      <aside className="registration-side">
        <MascotActor mood="welcome" />
        <div className="welcome-bubble">
          <strong>HOLA, EQUIP!</strong>
          <p>Ho tenim tot a punt per a una gran partida.</p>
        </div>
        <div className="registration-side-mascot" aria-hidden="true">
          <MascotActor mood="celebrate" />
        </div>
        <button className="arena-start" disabled={locked} onClick={onDraw}>
          <Shuffle />
          REALITZAR SORTEIG
          <ChevronRight />
        </button>
        <span className="adaptive-note">
          De 6 a 30 parelles · També amb imparells
        </span>
      </aside>
    </div>
  );
}

function PlayerFigure({ blue = false }: { blue?: boolean }) {
  return (
    <svg className="board-player" viewBox="0 0 72 112" aria-hidden="true">
      <defs>
        <linearGradient id={`player-${blue ? "blue" : "red"}`}>
          <stop stopColor={blue ? "#0267dc" : "#db001a"} />
          <stop offset=".5" stopColor={blue ? "#29bbff" : "#ff3d26"} />
          <stop offset="1" stopColor={blue ? "#034488" : "#af0019"} />
        </linearGradient>
      </defs>
      <path d="M4 47h64" stroke="#10121c" strokeWidth="12" />
      <path d="M4 43h64" stroke="#a8b8c8" strokeWidth="3" />
      <ellipse
        cx="36"
        cy="21"
        rx="14"
        ry="17"
        fill="#10131b"
        stroke="#69758a"
        strokeWidth="2"
      />
      <ellipse cx="31" cy="13" rx="4" ry="5" fill="#fff7" />
      <path
        d="M20 37h32l3 32H17z"
        fill={`url(#player-${blue ? "blue" : "red"})`}
        stroke="#fff9"
        strokeWidth="2"
      />
      {!blue && (
        <path
          d="m24 38-2 29m13-29v29m12-29 2 29"
          stroke="#ffeb27"
          strokeWidth="5"
        />
      )}
      <path d="M23 69h26v12H23z" fill="#f6f9ff" />
      <path d="M27 81h18v22H27z" fill={blue ? "#057be4" : "#f52429"} />
      <path d="M22 99h28v10H22z" fill={blue ? "#087bd9" : "#cc101c"} />
    </svg>
  );
}

function LiveBoard({
  s,
  table,
  view,
  controls,
  onSave,
  onInteraction,
}: {
  s: State;
  table: TableId;
  view: View;
  controls: boolean;
  onSave: (m: Match, g: Game[]) => Promise<void>;
  onInteraction: (message: string) => void;
}) {
  const q = queue(s, table),
    match = q[0];
  const matchId = match?.id || `idle-${s.phase}`;
  const draftKey = `futboli-draft-${matchId}`;
  const [scores, setScores] = useState<string[]>(["", "", "", "", "", ""]);
  const [confirming, setConfirming] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [impact, setImpact] = useState(0),
    [celebrating, setCelebrating] = useState(false);
  const previousMatch = useRef(matchId);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || "[]");
      setScores(
        Array.isArray(saved) && saved.length === 6
          ? saved
          : ["", "", "", "", "", ""],
      );
    } catch {
      setScores(["", "", "", "", "", ""]);
    }
    setConfirming(false);
    setError("");
    if (previousMatch.current !== matchId) {
      setCelebrating(true);
      setTimeout(() => setCelebrating(false), 1800);
      previousMatch.current = matchId;
    }
  }, [matchId, draftKey]);
  const write = (index: number, value: string) => {
    const next = scores.map((v, i) => (i === index ? value : v));
    setScores(next);
    setConfirming(false);
    setImpact((i) => i + 1);
    onInteraction(
      `Futbolí ${table}: estàs anotant la partida ${Math.floor(index / 2) + 1}.`,
    );
    try {
      localStorage.setItem(draftKey, JSON.stringify(next));
    } catch {
      /* Scores remain editable in memory. */
    }
  };
  const completeFirst = scores.slice(0, 4).every((x) => x !== "");
  const wins = completeFirst
    ? Number(Number(scores[0]) > Number(scores[1])) +
      Number(Number(scores[2]) > Number(scores[3]))
    : null;
  const split = completeFirst && wins === 1;
  const gameCount = match?.phase !== "GROUP_STAGE" && split ? 3 : 2;
  const allDone = scores.slice(0, gameCount * 2).every((x) => x !== "");
  const pointsA = allDone
    ? Array.from({ length: gameCount }, (_, i) =>
        Number(Number(scores[i * 2]) > Number(scores[i * 2 + 1])),
      ).reduce((a, b) => a + b, 0)
    : null;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!match) return;
    setError("");
    try {
      if (!allDone) throw Error("Escriu els resultats de les dues partides.");
      const games = Array.from({ length: gameCount }, (_, i) => ({
        a: Number(scores[i * 2]),
        b: Number(scores[i * 2 + 1]),
      }));
      validateGames(games, match.phase !== "GROUP_STAGE");
      if (!confirming) {
        setConfirming(true);
        onInteraction(
          `Futbolí ${table}: revisa el ${pointsA}–${gameCount - (pointsA ?? 0)} i confirma el resultat.`,
        );
        return;
      }
      setBusy(true);
      await onSave(match, games);
      localStorage.removeItem(draftKey);
    } catch (e) {
      setError((e as Error).message);
      onInteraction(`Futbolí ${table}: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  const rows = standings(s, table),
    groupMatches = s.matches.filter(
      (m) => m.table === table && m.phase === "GROUP_STAGE",
    ),
    done = groupMatches.filter((m) => m.status === "completed").length;
  const currentRound = s.matches.filter(
      (m) => m.table === table && m.phase === s.phase,
    ),
    roundCompleted = currentRound.filter(
      (m) => m.status === "completed",
    ).length;
  const groupPhase = [
    "GROUP_STAGE",
    "GROUP_STAGE_COMPLETE",
    "QUALIFIED",
  ].includes(s.phase);
  const progressTotal = groupPhase ? groupMatches.length : currentRound.length,
    progressDone = groupPhase ? done : roundCompleted;
  const lastMatch = s.matches
    .filter((m) => m.table === table && m.status === "completed")
    .at(-1);
  const bigDetail = ["bracket", "qualified", "final", "champion"].includes(
    view,
  );
  return (
    <section
      className={`arena-board table-${table} ${bigDetail ? "board-compact" : ""} ${celebrating ? "board-celebrating" : ""}`}
    >
      <div className="board-title">
        <PlayerFigure blue={table === 2} />
        <h2>
          FUTBOLÍ <b>{table}</b>
        </h2>
        <span className={`board-status ${match ? "playing" : ""}`}>
          <i />
          {match
            ? "EN JOC"
            : s.phase === "CHAMPION"
              ? "FINALITZAT"
              : "EN ESPERA"}
        </span>
      </div>
      <div className="board-score-strip">
        <div className="score-team">
          <span>{match ? "ARA JUGUEN" : "FUTBOLÍ DISPONIBLE"}</span>
          <AnimatePresence mode="wait">
            <motion.strong
              key={match?.a || "a"}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
            >
              {match ? teamName(s, match.a) : "En espera"}
            </motion.strong>
          </AnimatePresence>
          <small>{match ? "PARELLA EN JOC" : "Bona partida!"}</small>
        </div>
        <div
          className="board-points"
          title={
            completeFirst
              ? "Resultat en edició, pendent de confirmar"
              : "Partides guanyades"
          }
        >
          <b>{pointsA ?? "–"}</b>
          <i>–</i>
          <b>{pointsA !== null ? gameCount - pointsA : "–"}</b>
        </div>
        <div className="score-team">
          <span>{completeFirst ? "EN EDICIÓ" : "ENFRONTAMENT"}</span>
          <AnimatePresence mode="wait">
            <motion.strong
              key={match?.b || "b"}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
            >
              {match ? teamName(s, match.b) : "Sense partit"}
            </motion.strong>
          </AnimatePresence>
          <small>{match ? "PARELLA ENFRONTADA" : "Tota la falla juga"}</small>
        </div>
      </div>
      <form className="board-match-zone" onSubmit={submit}>
        <div className={`board-game-inputs ${!controls ? "readonly" : ""}`}>
          {Array.from({ length: gameCount }, (_, i) => (
            <label
              className={`game-entry ${i === 2 ? "tie-game" : ""}`}
              key={i}
            >
              <span>{i === 2 ? "Desempat" : `Partida ${i + 1}`}</span>
              <input
                aria-label={`Futbolí ${table} partida ${i + 1} local`}
                required
                type="number"
                inputMode="numeric"
                min="0"
                max="999"
                step="1"
                placeholder="–"
                value={scores[i * 2]}
                disabled={!match || !controls || busy || confirming}
                onChange={(e) => write(i * 2, e.target.value)}
              />
              <b>–</b>
              <input
                aria-label={`Futbolí ${table} partida ${i + 1} visitant`}
                required
                type="number"
                inputMode="numeric"
                min="0"
                max="999"
                step="1"
                placeholder="–"
                value={scores[i * 2 + 1]}
                disabled={!match || !controls || busy || confirming}
                onChange={(e) => write(i * 2 + 1, e.target.value)}
              />
            </label>
          ))}
          {controls && match && (
            <div className="board-submit">
              <button
                className={confirming ? "confirm-result" : ""}
                disabled={busy}
                type="submit"
              >
                {confirming ? (
                  <>
                    <Check />
                    CONFIRMAR {pointsA}–
                    {pointsA !== null ? gameCount - pointsA : "–"}
                  </>
                ) : (
                  <>
                    <Check />
                    GUARDAR RESULTAT
                  </>
                )}
              </button>
              {confirming && (
                <button
                  type="button"
                  className="edit-again"
                  onClick={() => setConfirming(false)}
                  aria-label={`Tornar a editar futbolí ${table}`}
                >
                  <X />
                </button>
              )}
            </div>
          )}
          {!match && (
            <div className="idle-caption">
              {s.phase === "CHAMPION"
                ? "TORNEIG FINALITZAT"
                : "PREPARAT PER A LA SEGÜENT RONDA"}
            </div>
          )}
        </div>
        <Table3D
          active={!!match}
          table={table}
          matchKey={matchId}
          impact={impact}
        />
        {error && (
          <div className="board-inline-error" role="alert">
            {error}
          </div>
        )}
      </form>
      <div className="board-next">
        <span>
          PRÒXIM <ChevronRight />
        </span>
        <b>
          {q[1]
            ? `${teamName(s, q[1].a)} vs ${teamName(s, q[1].b)}`
            : match
              ? "Últim enfrontament de la fase"
              : s.phase === "CHAMPION"
                ? "Gràcies per participar!"
                : "Esperant la següent fase"}
        </b>
      </div>
      {!bigDetail && (
        <div className="board-information">
          {view === "upcoming" ? (
            <>
              <div className="board-section-title">
                <CalendarDays /> PRÒXIMS ENFRONTAMENTS
              </div>
              <div className="board-queue">
                {q.slice(0, 6).map((m, i) => (
                  <div key={m.id} className={i === 0 ? "now" : ""}>
                    <span>
                      {i === 0 ? "EN JOC" : i === 1 ? "PRÒXIM" : "DESPRÉS"}
                    </span>
                    <b>{teamName(s, m.a)}</b>
                    <i>vs</i>
                    <b>{teamName(s, m.b)}</b>
                  </div>
                ))}
                {!q.length && <p>Fase completada. Bona partida!</p>}
              </div>
            </>
          ) : (
            <>
              <Standings s={s} table={table} full />
              <div className="board-qualified">
                <Trophy />
                <span>
                  {rows
                    .slice(0, 6)
                    .map((r) => teamName(s, r.id))
                    .join(" · ")}
                </span>
              </div>
            </>
          )}
        </div>
      )}
      {!bigDetail && (
        <div className="board-progress">
          <FlagIcon />
          <span>
            {progressDone}/{progressTotal} enfrontaments
          </span>
          <div>
            <i
              style={{
                width: `${progressTotal ? (progressDone / progressTotal) * 100 : 0}%`,
              }}
            />
          </div>
          <b>
            {progressTotal
              ? Math.round((progressDone / progressTotal) * 100)
              : 0}
            %
          </b>
        </div>
      )}
      {bigDetail && lastMatch && (
        <div className="board-last-result">
          <span>ÚLTIM</span>
          {teamName(s, lastMatch.a)}{" "}
          <b>{lastMatch.games.map((g) => `${g.a}–${g.b}`).join(" / ")}</b>{" "}
          {teamName(s, lastMatch.b)}
        </div>
      )}
      <AnimatePresence>
        {celebrating && (
          <motion.div
            className="board-result-fx"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
          >
            <Check />
            <strong>RESULTAT GUARDAT</strong>
            <span>
              {match ? "SEGÜENT PARTIT EN JOC" : "ENFRONTAMENTS COMPLETATS"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" className="flag-icon" aria-hidden="true">
      <path d="m3 22 5-20 13 3-4 13-12-3" fill="white" />
      <path
        d="m8 2 5 1-1 5-5-1zm8 7 5 1-2 4-4-1zM6 11l5 1-1 5-5-1zm6-3 5 1-1 5-5-1z"
        fill="#102749"
      />
    </svg>
  );
}
function FinalScene({ s }: { s: State }) {
  const match = s.matches.find((m) => m.phase === "FINAL");
  return (
    <div className="arena-final">
      <div className="final-team">
        <span>FINALISTA</span>
        <h2>{match ? teamName(s, match.a) : "Qui arribarà a la final?"}</h2>
        <p>La copa vos espera</p>
      </div>
      <div className="final-cup">
        <span>LA GRAN FINAL</span>
        <TrophyArt />
        <b>VS</b>
      </div>
      <div className="final-team">
        <span>FINALISTA</span>
        <h2>{match ? teamName(s, match.b) : "El torneig ho decidirà"}</h2>
        <p>Bona partida!</p>
      </div>
    </div>
  );
}
function Champion({ s }: { s: State }) {
  return (
    <div className="arena-champion">
      <div className="champion-confetti">
        {Array.from({ length: 40 }, (_, i) => (
          <i
            key={i}
            style={{ "--i": i, left: `${i * 2.6}%` } as CSSProperties}
          />
        ))}
      </div>
      <MascotActor mood="celebrate" />
      <div>
        <span>TORNEIG FUTBOLÍ 2027</span>
        <h2>{s.champion ? "CAMPEONS!" : "LA COPA VOS ESPERA"}</h2>
        <h3>
          {s.champion ? teamName(s, s.champion) : "Qui guanyarà el torneig?"}
        </h3>
        <p>Joc net. Bona companyia. Gran falla!</p>
      </div>
      <TrophyArt />
    </div>
  );
}
function Ceremony({
  event,
  s,
  onClose,
}: {
  event: State["events"][number];
  s: State;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setIndex((i) => (i + 1) % event.teams.length),
      1500,
    );
    return () => clearInterval(t);
  }, [event]);
  const id = event.teams[index];
  return (
    <motion.aside
      className="arena-ceremony"
      initial={{ y: 180, opacity: 0, rotate: 2 }}
      animate={{ y: 0, opacity: 1, rotate: 0 }}
      exit={{ y: 180, opacity: 0 }}
      transition={{ type: "spring", damping: 22, stiffness: 150 }}
    >
      <div className="ceremony-rays" />
      <MascotActor mood="celebrate" />
      <div className="ceremony-copy">
        <span>LA MASCOTA ANUNCIA</span>
        <h2>{event.title}</h2>
        <AnimatePresence mode="wait">
          <motion.div
            key={id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <small>
              PARELLA {index + 1} DE {event.teams.length}
            </small>
            <strong>{teamName(s, id)}</strong>
            <p>Parella classificada</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <TrophyArt />
      <button onClick={onClose} aria-label="Tancar anunci">
        <X />
      </button>
      <div className="ceremony-progress">
        <i style={{ animationDuration: `${event.teams.length * 1500}ms` }} />
      </div>
    </motion.aside>
  );
}
