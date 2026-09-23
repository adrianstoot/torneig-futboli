import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  Flag,
  History,
  Monitor,
  Plus,
  RotateCcw,
  Settings,
  Shuffle,
  Trash2,
  Trophy,
  Upload,
  Users,
  Volume2,
  X,
} from "lucide-react";
import {
  initialState,
  phaseNames,
  tables,
  uid,
  type Game,
  type Match,
  type State,
  type Team,
} from "../engine/types";
import {
  addTeam,
  advance,
  hasSeedTies,
  draw,
  event,
  qualifiers,
  queue,
  rewind,
  saveResult,
  standings,
  startGroups,
  validateGames,
  validateState,
} from "../engine/tournament";
import {
  commit,
  exportTournament,
  recoveryError,
  restoreBackup,
  undo,
} from "../store";
import {
  Header,
  Qualified,
  Standings,
  TableLiveCard,
  teamName,
  tvViews,
} from "./TV";
type Run = (fn: () => void | Promise<unknown>) => Promise<void>;
const tabs = [
  ["setup", "Inscripcions", Users],
  ["draw", "Sorteig", Shuffle],
  ["live", "En directe", Activity],
  ["groups", "Grups", ClipboardList],
  ["results", "Resultats", History],
  ["qualification", "Classificats", Flag],
  ["settings", "Ajustos", Settings],
] as const;
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} className="dialog">
      <div className="dialog-header">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Tancar" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Admin({ s }: { s: State }) {
  const initial = location.pathname.split("/")[2];
  const [tab, setTab] = useState(
    initial ||
      (["SETUP", "DRAW"].includes(s.phase) ? s.phase.toLowerCase() : "live"),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [confirmation, setConfirmation] = useState<{
    title: string;
    body: string;
    action: () => void | Promise<unknown>;
  } | null>(null);
  const [editor, setEditor] = useState<Match | null>(null);
  const run: Run = async (fn) => {
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
  };
  function navigate(v: string) {
    setTab(v);
    history.pushState({}, "", `/admin/${v}`);
  }
  useEffect(() => {
    const h = () => setTab(location.pathname.split("/")[2] || "live");
    window.addEventListener("popstate", h);
    return () => window.removeEventListener("popstate", h);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  const round = s.matches.filter((m) => m.phase === s.phase);
  const canAdvance =
    s.phase === "GROUP_STAGE_COMPLETE" ||
    s.phase === "QUALIFIED" ||
    (["PRELIMINARY", "ROUND_OF_16", "QUARTER_FINALS", "SEMI_FINALS"].includes(
      s.phase,
    ) &&
      round.length > 0 &&
      round.every((m) => m.status === "completed"));
  const confirm = (
    title: string,
    body: string,
    action: () => void | Promise<unknown>,
  ) => setConfirmation({ title, body, action });
  return (
    <div className="admin-app">
      <Header s={s} admin />
      <div className="admin-topbar">
        <span>
          <i className="saved-dot" />
          {recoveryError
            ? "Recuperació necessària"
            : "Guardat en este navegador"}{" "}
          <small>· Revisió {s.revision}</small>
        </span>
        <a
          className="button yellow"
          href="/tv"
          target="_blank"
          rel="noreferrer"
        >
          <Monitor size={17} /> OBRIR PANTALLA TV <ArrowUpRight size={17} />
        </a>
      </div>
      <div className="admin-layout">
        <aside className="sidebar">
          <span className="sidebar-label">ORGANITZACIÓ</span>
          <nav>
            {tabs.map(([id, label, Icon]) => (
              <button
                key={id}
                className={tab === id ? "active" : ""}
                onClick={() => navigate(id)}
              >
                <Icon size={19} />
                {label}
                {tab === id && <ChevronRight size={15} />}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <span>TORNEIG 2027</span>
            <strong>
              {s.teams.length} <small>/ 30 parelles</small>
            </strong>
            <p>
              3 futbolins
              <br />
              Una sola copa.
            </p>
            <button className="button subtle" onClick={() => run(undo)}>
              <RotateCcw size={15} /> Desfer última acció
            </button>
          </div>
        </aside>
        <main className="admin-main" aria-busy={busy}>
          {(error || recoveryError) && (
            <div role="alert" className="error-banner">
              <span>{error || recoveryError}</span>
              <button
                className="icon-button"
                aria-label="Tancar avís"
                onClick={() => setError("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {canAdvance && (
            <div className="advance-banner">
              <div>
                <span>SEGÜENT FASE PREPARADA</span>
                <strong>
                  {s.phase === "GROUP_STAGE_COMPLETE"
                    ? "Revisa els empats i confirma els classificats"
                    : s.phase === "QUALIFIED"
                      ? "Les parelles ja tenen el seu seed"
                      : "Tots els enfrontaments d’esta ronda han acabat"}
                </strong>
              </div>
              <button
                className="button yellow"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await commit(advance);
                    navigate(
                      s.phase === "GROUP_STAGE_COMPLETE"
                        ? "qualification"
                        : "live",
                    );
                  })
                }
              >
                AVANÇAR FASE <ChevronRight size={17} />
              </button>
            </div>
          )}
          {tab === "setup" ? (
            <Setup
              s={s}
              run={run}
              confirm={confirm}
              onDraw={() =>
                run(async () => {
                  await commit(draw);
                  navigate("draw");
                })
              }
            />
          ) : tab === "draw" ? (
            <Draw
              s={s}
              run={run}
              onStart={() =>
                run(async () => {
                  await commit(startGroups);
                  navigate("live");
                })
              }
            />
          ) : tab === "live" ? (
            <>
              <PageHeading
                eyebrow="EL TORNEIG, A LES TEUES MANS"
                title="Control en directe"
                detail="Confirma el resultat. El següent enfrontament comença automàticament."
              />
              <div className="admin-live-grid">
                {tables.map((t) => (
                  <div className="admin-table" key={t}>
                    <TableLiveCard s={s} table={t} compact />
                    <button
                      className="button yellow result-button"
                      disabled={!queue(s, t)[0]}
                      onClick={() => setEditor(queue(s, t)[0])}
                    >
                      <Plus size={18} /> INTRODUIR RESULTAT
                    </button>
                  </div>
                ))}
              </div>
              <div className="admin-bottom-grid">
                <section className="admin-panel">
                  <div className="panel-heading">
                    <h3>Últimes accions</h3>
                    <span>EN TEMPS REAL</span>
                  </div>
                  <div className="event-list">
                    {s.events
                      .slice(-6)
                      .reverse()
                      .map((e) => (
                        <div key={e.id}>
                          <span>
                            {new Date(e.at).toLocaleTimeString("ca-ES", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <div>
                            <b>{e.title}</b>
                            <p>{e.detail}</p>
                          </div>
                        </div>
                      ))}
                    {!s.events.length && (
                      <p className="hint">
                        Ací apareixeran els resultats i els canvis de fase.
                      </p>
                    )}
                  </div>
                </section>
                <section className="mascot-panel">
                  <img src="/assets/mascota.png" alt="Mascota oficial" />
                  <div>
                    <span>LA FALLA TAMBÉ JUGA</span>
                    <h3>
                      Joc net.
                      <br />
                      Bona companyia.
                    </h3>
                    <p>
                      Tu poses el resultat.
                      <br />
                      Nosaltres posem l’espectacle.
                    </p>
                  </div>
                </section>
              </div>
            </>
          ) : tab === "groups" ? (
            <>
              <PageHeading
                eyebrow="TOTS CONTRA TOTS"
                title="Classificació dels grups"
                detail="1 punt per partida guanyada. Passen fins a 6 parelles de cada grup."
              />
              <div className="admin-standings">
                {tables.map((t) => (
                  <section className={`content-panel table-${t}`} key={t}>
                    <h3>
                      FUTBOLÍ {t} ·{" "}
                      {s.teams.filter((x) => x.group === t).length} PARELLES
                    </h3>
                    <Standings s={s} table={t} full />
                  </section>
                ))}
              </div>
              <TieResolver s={s} run={run} />
            </>
          ) : tab === "results" ? (
            <>
              <PageHeading
                eyebrow="HISTORIAL DEL TORNEIG"
                title="Resultats i correccions"
                detail="Una correcció recalcula la classificació completa, sense sumar punts dues vegades."
              />
              <Results s={s} onEdit={setEditor} confirm={confirm} run={run} />
            </>
          ) : tab === "qualification" ? (
            <>
              <PageHeading
                eyebrow="EL CAMÍ CAP A LA COPA"
                title="Parelles classificades"
                detail={
                  s.settings.normalized
                    ? "Amb grups desiguals, el seed compara punts, diferència i gols per enfrontament."
                    : "El seed compara punts, diferència i gols totals."
                }
              />
              <div className="admin-qualified">
                <Qualified s={s} />
              </div>
              <TieResolver s={s} run={run} />
            </>
          ) : (
            <SettingsPanel
              s={s}
              run={run}
              confirm={confirm}
              onReset={() => navigate("setup")}
            />
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
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
                run(action);
              }}
            >
              CONFIRMAR
            </button>
          </div>
        </Dialog>
      )}
      {editor && (
        <ResultEditor
          key={editor.id}
          s={s}
          match={editor}
          onClose={() => setEditor(null)}
          onSave={async (games) => {
            await commit((x) => saveResult(x, editor.id, games));
            setEditor(null);
            setToast("Resultat guardat · TV actualitzada");
          }}
        />
      )}
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="page-heading">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{detail}</p>
    </div>
  );
}
type Confirm = (
  title: string,
  body: string,
  action: () => void | Promise<unknown>,
) => void;
export function Setup({
  s,
  run,
  confirm,
  onDraw,
}: {
  s: State;
  run: Run;
  confirm: Confirm;
  onDraw: () => void;
}) {
  const empty = (): Team => ({
    id: uid(),
    name: "",
    player1: "",
    player2: "",
    shortName: "",
    group: null,
  });
  const [form, setForm] = useState<Team>(empty);
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const locked = !["SETUP", "DRAW"].includes(s.phase);
  const field = (k: keyof Team, value: string) =>
    setForm({ ...form, [k]: value });
  const save = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await commit((x) =>
        addTeam(x, { ...form, player1: form.name, player2: form.name }),
      );
      setForm(empty());
    });
  };
  return (
    <>
      <div className="setup-heading">
        <PageHeading
          eyebrow="PREPAREM UN GRAN TORNEIG"
          title="Qui juga enguany?"
          detail="Apunta les parelles. El sorteig s’adapta al nombre final d’inscrits, també si és imparell."
        />
        <div className="count-badge">
          <strong>{String(s.teams.length).padStart(2, "0")}</strong>
          <span>PARELLES INSCRITES</span>
        </div>
      </div>
      {locked ? (
        <div className="info-banner">
          Les inscripcions estan tancades perquè el torneig ja ha començat.
        </div>
      ) : (
        <div className="setup-grid">
          <section className="admin-panel">
            <div className="panel-heading">
              <h3>
                {s.teams.some((t) => t.id === form.id)
                  ? "Editar parella"
                  : "Una nova parella"}
              </h3>
              <Users size={19} />
            </div>
            <form onSubmit={save} className="team-form">
              <label>
                Nom de la parella
                <input
                  autoComplete="off"
                  maxLength={80}
                  required
                  value={form.name}
                  onChange={(e) => field("name", e.target.value)}
                  placeholder="Com es diu el vostre equip?"
                />
              </label>
              <label>
                Nom curt per a la TV <small>Opcional</small>
                <input
                  maxLength={40}
                  value={form.shortName}
                  onChange={(e) => field("shortName", e.target.value)}
                  placeholder="Si el nom de l’equip és molt llarg"
                />
              </label>
              <button type="submit" className="button yellow">
                <Plus size={18} />
                {s.teams.some((t) => t.id === form.id)
                  ? "GUARDAR CANVIS"
                  : "AFEGIR PARELLA"}
              </button>
              {s.teams.some((t) => t.id === form.id) && (
                <button
                  type="button"
                  className="button subtle"
                  onClick={() => setForm(empty())}
                >
                  Cancel·lar edició
                </button>
              )}
            </form>
          </section>
          <section className="setup-promo">
            <img src="/assets/mascota.png" alt="Mascota oficial del torneig" />
            <div>
              <span>JA ESTEM A PUNT!</span>
              <h3>
                Vosaltres jugueu.
                <br />
                La falla vibra.
              </h3>
              <p>
                3 futbolins · Fase de grups · Eliminatòries
                <br />
                Fins a 30 parelles. Sense complicacions.
              </p>
            </div>
          </section>
        </div>
      )}
      <section className="admin-panel roster-panel">
        <div className="panel-heading">
          <h3>
            Parelles inscrites{" "}
            <span className="number-chip">{s.teams.length}</span>
          </h3>
          {!locked && (
            <button
              className="text-button"
              onClick={() => setShowBulk(!showBulk)}
            >
              <ClipboardList size={15} /> Afegir llista
            </button>
          )}
        </div>
        {showBulk && !locked && (
          <div className="bulk-form">
            <label>
              Una parella per línia: només el nom de l’equip
              <textarea
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                placeholder={"Els Esclatasangs\nLa Falla Valenta"}
                rows={4}
              />
            </label>
            <button
              className="button subtle"
              onClick={() =>
                run(async () => {
                  await commit((x) => {
                    for (const line of bulk
                      .split("\n")
                      .filter((l) => l.trim())) {
                      const name = line.trim();
                      if (!name) throw Error("Escriu el nom de cada parella.");
                      x = addTeam(x, {
                        ...empty(),
                        name,
                        player1: name,
                        player2: name,
                      });
                    }
                    return x;
                  });
                  setBulk("");
                  setShowBulk(false);
                })
              }
            >
              Afegir totes les parelles
            </button>
          </div>
        )}
        {s.teams.length ? (
          <div className="roster">
            {s.teams.map((t, i) => (
              <div className="roster-row" key={t.id}>
                <span className="roster-num">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <b>{t.name}</b>
                </div>
                {!locked && (
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      aria-label={`Pujar ${t.name}`}
                      disabled={i === 0}
                      onClick={() =>
                        run(() =>
                          commit((x) => {
                            const n = x.teams.findIndex((a) => a.id === t.id);
                            if (n > 0)
                              [x.teams[n - 1], x.teams[n]] = [
                                x.teams[n],
                                x.teams[n - 1],
                              ];
                            return x;
                          }),
                        )
                      }
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      className="text-button"
                      onClick={() => {
                        setForm(t);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Duplicar ${t.name}`}
                      onClick={() => {
                        setForm({ ...t, id: uid(), name: `${t.name} (còpia)` });
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      className="icon-button danger"
                      aria-label={`Eliminar ${t.name}`}
                      onClick={() =>
                        confirm(
                          "Eliminar parella",
                          `Vols retirar ${t.name} de la inscripció?`,
                          () =>
                            commit((x) => ({
                              ...x,
                              teams: x.teams.filter((a) => a.id !== t.id),
                            })),
                        )
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="roster-empty">
            <Users size={34} />
            <h3>La primera parella obri el torneig</h3>
            <p>Afegix-la amb el formulari de dalt o importa una llista.</p>
          </div>
        )}
        <div className="roster-footer">
          <span>
            {s.teams.length >= 6
              ? "Tot preparat per al sorteig."
              : "Calen almenys 6 parelles per a repartir els 3 grups."}
          </span>
          <button
            className="button yellow"
            disabled={s.teams.length < 6 || locked}
            onClick={onDraw}
          >
            <Shuffle size={18} /> REALITZAR SORTEIG
          </button>
        </div>
      </section>
    </>
  );
}
export function Draw({
  s,
  run,
  onStart,
}: {
  s: State;
  run: Run;
  onStart: () => void;
}) {
  return (
    <>
      <PageHeading
        eyebrow="TRES GRUPS · UNA MATEIXA PASSIÓ"
        title="El sorteig del torneig"
        detail="Els grups poden diferir en una parella. Per a canviar una parella, tria un altre futbolí abans de confirmar."
      />
      <div className="draw-grid">
        {tables.map((t) => (
          <section className={`admin-panel draw-column table-${t}`} key={t}>
            <div className="draw-title">
              <span>FUTBOLÍ</span>
              <b>{t}</b>
              <small>
                {s.teams.filter((x) => x.group === t).length} parelles
              </small>
            </div>
            {s.teams
              .filter((x) => x.group === t)
              .map((team, i) => (
                <div
                  className="draw-team"
                  key={team.id}
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <b>{team.name}</b>
                  </div>
                  {s.phase === "DRAW" && (
                    <select
                      aria-label={`Futbolí de ${team.name}`}
                      value={team.group!}
                      onChange={(e) =>
                        run(() =>
                          commit((x) => ({
                            ...x,
                            teams: x.teams.map((a) =>
                              a.id === team.id
                                ? {
                                    ...a,
                                    group: Number(e.target.value) as 1 | 2 | 3,
                                  }
                                : a,
                            ),
                          })),
                        )
                      }
                    >
                      {tables.map((g) => (
                        <option key={g} value={g}>
                          F{g}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
          </section>
        ))}
      </div>
      <div className="draw-actions">
        <p>
          Amb grups imparells, el calendari incorpora descansos sense donar
          punts.
        </p>
        <button
          className="button subtle"
          disabled={!["SETUP", "DRAW"].includes(s.phase) || s.teams.length < 6}
          onClick={() => run(() => commit(draw))}
        >
          <Shuffle size={18} /> REPETIR SORTEIG
        </button>
        <button
          className="button yellow"
          disabled={s.phase !== "DRAW"}
          onClick={onStart}
        >
          <Check size={18} /> CONFIRMAR I COMENÇAR
        </button>
      </div>
    </>
  );
}
export function ResultEditor({
  s,
  match,
  onClose,
  onSave,
}: {
  s: State;
  match: Match;
  onClose: () => void;
  onSave: (games: Game[]) => Promise<void>;
}) {
  const [scores, setScores] = useState<string[]>(
    [0, 1, 2].flatMap((i) => [
      match.games[i]?.a.toString() || "",
      match.games[i]?.b.toString() || "",
    ]),
  );
  const [confirm, setConfirm] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const split =
    scores.slice(0, 4).every((x) => x !== "") &&
    Number(scores[0]) > Number(scores[1]) !==
      Number(scores[2]) > Number(scores[3]);
  const count = match.phase !== "GROUP_STAGE" && split ? 3 : 2;
  const games = () =>
    Array.from({ length: count }, (_, i) => ({
      a: Number(scores[i * 2]),
      b: Number(scores[i * 2 + 1]),
    }));
  const wins = games().filter((g) => g.a > g.b).length;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (scores.slice(0, count * 2).some((x) => !x.trim()))
        throw Error("Completa tots els marcadors.");
      validateGames(games(), match.phase !== "GROUP_STAGE");
      if (!confirm) {
        setConfirm(true);
        return;
      }
      setBusy(true);
      await onSave(games());
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={`${confirm ? "Confirmar resultat" : "Introduir resultat"} · Futbolí ${match.table}`}
      onClose={onClose}
    >
      <div className="editor-teams">
        <strong>{teamName(s, match.a)}</strong>
        <span>VS</span>
        <strong>{teamName(s, match.b)}</strong>
      </div>
      <form onSubmit={submit}>
        {Array.from({ length: count }, (_, i) => (
          <div
            className={`score-input-row ${i === 2 ? "tiebreak" : ""}`}
            key={i}
          >
            <span>{i === 2 ? "DESEMPAT" : `PARTIDA ${i + 1}`}</span>
            <input
              aria-label={`Partida ${i + 1}, ${teamName(s, match.a)}`}
              autoFocus={i === 0}
              required
              type="number"
              min="0"
              max="999"
              step="1"
              value={scores[i * 2]}
              disabled={confirm}
              onChange={(e) =>
                setScores(
                  scores.map((v, j) => (j === i * 2 ? e.target.value : v)),
                )
              }
            />
            <b>—</b>
            <input
              aria-label={`Partida ${i + 1}, ${teamName(s, match.b)}`}
              required
              type="number"
              min="0"
              max="999"
              step="1"
              value={scores[i * 2 + 1]}
              disabled={confirm}
              onChange={(e) =>
                setScores(
                  scores.map((v, j) => (j === i * 2 + 1 ? e.target.value : v)),
                )
              }
            />
          </div>
        ))}
        {count === 3 && (
          <p className="hint">
            Empat 1–1: el guanyador de la tercera partida passa de ronda.
          </p>
        )}
        {confirm && (
          <div className="result-summary">
            <b>
              {match.phase === "GROUP_STAGE"
                ? `Punts: ${teamName(s, match.a)} +${wins} · ${teamName(s, match.b)} +${count - wins}`
                : `Passa: ${teamName(s, wins > count / 2 ? match.a : match.b)}`}
            </b>
            <p>
              El resultat es guardarà i el següent partit començarà a la TV.
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          {confirm && (
            <button
              type="button"
              className="button subtle"
              onClick={() => setConfirm(false)}
            >
              Tornar a editar
            </button>
          )}
          <button type="submit" disabled={busy} className="button yellow">
            <Check size={18} />
            {confirm ? "CONFIRMAR RESULTAT" : "REVISAR RESULTAT"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export function Results({
  s,
  onEdit,
  confirm,
  run,
}: {
  s: State;
  onEdit: (m: Match) => void;
  confirm: Confirm;
  run: Run;
}) {
  const [filter, setFilter] = useState("all");
  return (
    <section className="admin-panel">
      <div className="panel-heading">
        <h3>Historial de partits</h3>
        <select
          aria-label="Filtrar futbolí"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Tots els futbolins</option>
          {tables.map((t) => (
            <option key={t} value={t}>
              Futbolí {t}
            </option>
          ))}
        </select>
      </div>
      <div className="result-history">
        {s.matches
          .filter(
            (m) =>
              m.status === "completed" &&
              (filter === "all" || m.table === Number(filter)),
          )
          .reverse()
          .map((m) => (
            <div className="history-row" key={m.id}>
              <span className={`table-chip table-${m.table}`}>F{m.table}</span>
              <div>
                <b>
                  {teamName(s, m.a)} <small>vs</small> {teamName(s, m.b)}
                </b>
                <small>{phaseNames[m.phase]}</small>
              </div>
              <strong>{m.games.map((g) => `${g.a}–${g.b}`).join(" / ")}</strong>
              <button
                className="button subtle"
                onClick={() => {
                  if (
                    m.phase === s.phase ||
                    (m.phase === "GROUP_STAGE" &&
                      s.phase === "GROUP_STAGE_COMPLETE")
                  )
                    onEdit(m);
                  else
                    confirm(
                      "Reobrir una fase anterior",
                      `Corregir ${phaseNames[m.phase]} elimina els cruces i resultats de les fases posteriors. Exporta una còpia si vols conservar-los.`,
                      () =>
                        run(async () => {
                          await commit((x) => rewind(x, m.phase));
                          onEdit(m);
                        }),
                    );
                }}
              >
                Corregir
              </button>
            </div>
          ))}
        {!s.matches.some((m) => m.status === "completed") && (
          <div className="roster-empty">
            <History size={30} />
            <h3>Encara no hi ha resultats</h3>
            <p>Quan confirmes un partit, apareixerà ací.</p>
          </div>
        )}
      </div>
    </section>
  );
}
export function TieResolver({ s, run }: { s: State; run: Run }) {
  const rows = qualifiers(s);
  const [order, setOrder] = useState<string[]>([]);
  const ids =
    order.length === s.teams.length
      ? order
      : [
          ...rows.map((r) => r.id),
          ...s.teams
            .filter((t) => !rows.some((r) => r.id === t.id))
            .map((t) => t.id),
        ];
  const tied =
    tables.some((t) => standings(s, t).some((r) => r.tied)) || hasSeedTies(s);
  const editable = [
    "SETUP",
    "DRAW",
    "GROUP_STAGE",
    "GROUP_STAGE_COMPLETE",
  ].includes(s.phase);
  return (
    <details className="tie-resolver">
      <summary>
        {tied
          ? "≈ Hi ha empats pendents · Resolució manual"
          : "Criteris i ordre de desempat manual"}
      </summary>
      <p>
        Ordre: punts →{" "}
        {s.settings.tieRules
          .map(
            (k) =>
              ({
                diff: "diferència de gols",
                gf: "gols a favor",
                direct: "enfrontament directe",
              })[k],
          )
          .join(" → ")}{" "}
        → decisió de l’organització. L’ordre manual només s’aplica si persistix
        l’empat.
      </p>
      <div className="tie-order">
        {ids.map((id, i) => (
          <div key={id}>
            <span>{i + 1}</span>
            <b>{teamName(s, id)}</b>
            <button
              className="icon-button"
              disabled={!editable || i === 0}
              aria-label={`Prioritzar ${teamName(s, id)}`}
              onClick={() => {
                const a = [...ids];
                [a[i - 1], a[i]] = [a[i], a[i - 1]];
                setOrder(a);
              }}
            >
              <ArrowUp size={16} />
            </button>
            <button
              className="icon-button"
              disabled={!editable || i === ids.length - 1}
              aria-label={`Baixar ${teamName(s, id)}`}
              onClick={() => {
                const a = [...ids];
                [a[i + 1], a[i]] = [a[i], a[i + 1]];
                setOrder(a);
              }}
            >
              <ArrowDown size={16} />
            </button>
          </div>
        ))}
      </div>
      <button
        className="button yellow"
        disabled={!editable || !ids.length}
        onClick={() =>
          run(() =>
            commit((x) =>
              event(
                { ...x, settings: { ...x.settings, tieOrder: ids } },
                "info",
                "Empats resolts",
                "L’organització ha confirmat l’ordre de desempat.",
              ),
            ),
          )
        }
      >
        CONFIRMAR ESTE ORDRE DE DESEMPAT
      </button>
    </details>
  );
}
export function SettingsPanel({
  s,
  run,
  confirm,
  onReset,
}: {
  s: State;
  run: Run;
  confirm: Confirm;
  onReset: () => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [resetStep, setResetStep] = useState(false);
  const editable = [
    "SETUP",
    "DRAW",
    "GROUP_STAGE",
    "GROUP_STAGE_COMPLETE",
  ].includes(s.phase);
  const setting = <K extends keyof State["settings"]>(
    key: K,
    value: State["settings"][K],
  ) =>
    run(() =>
      commit((x) => ({ ...x, settings: { ...x.settings, [key]: value } })),
    );
  return (
    <>
      <PageHeading
        eyebrow="TOT SOTA CONTROL"
        title="Ajustos del torneig"
        detail="Tot el torneig es gestiona des d’esta pantalla. Les dades es guarden automàticament."
      />
      <div className="settings-grid">
        <section className="admin-panel settings-panel">
          <h3>
            <Monitor size={20} /> Pantalla TV
          </h3>
          <label className="toggle-label">
            Rotació automàtica
            <input
              type="checkbox"
              checked={s.settings.auto}
              onChange={(e) => setting("auto", e.target.checked)}
            />
          </label>
          <label>
            Segons per vista
            <input
              type="number"
              min={5}
              max={120}
              value={s.settings.seconds}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n >= 5 && n <= 120) setting("seconds", n);
              }}
            />
          </label>
          <label>
            Fixar una vista
            <select
              value={
                ["upcoming", "qualified", "bracket"].includes(s.settings.view)
                  ? "standings"
                  : s.settings.view
              }
              onChange={(e) =>
                run(() =>
                  commit((x) => ({
                    ...x,
                    settings: {
                      ...x.settings,
                      view: e.target.value,
                      auto: false,
                    },
                  })),
                )
              }
            >
              {[
                ...tvViews,
                { id: "final", label: "Gran final" },
                { id: "champion", label: "Campions" },
              ].map((v) => (
                <option value={v.id} key={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="toggle-label">
            <span>
              <Volume2 size={17} /> So de botons i resultats
            </span>
            <input
              type="checkbox"
              checked={s.settings.sound}
              onChange={(e) => setting("sound", e.target.checked)}
            />
          </label>
          <p className="hint">
            Efecte curt en cada botó actiu i xiulit en guardar resultats. El
            volum dels efectes queda per damunt de la música.
          </p>
          <button
            className="button subtle"
            onClick={() =>
              run(() =>
                commit((x) =>
                  event(
                    x,
                    "phase",
                    phaseNames[x.phase],
                    "Bona partida a totes les parelles!",
                    x.seeds,
                  ),
                ),
              )
            }
          >
            REPETIR ANUNCI DE FASE
          </button>
        </section>
        <section className="admin-panel settings-panel">
          <h3>
            <Flag size={20} /> Regles i desempats
          </h3>
          <label className="toggle-label">
            Normalitzar seeds entre grups desiguals
            <input
              disabled={!editable}
              type="checkbox"
              checked={s.settings.normalized}
              onChange={(e) => setting("normalized", e.target.checked)}
            />
          </label>
          <p className="hint">
            Quan els grups tenen mides distintes, compara punts, diferència i
            gols per enfrontament. Dins de cada grup s’utilitzen els totals.
          </p>
          <label>
            Desempats després dels punts
            <select
              disabled={!editable}
              value={s.settings.tieRules.join(",")}
              onChange={(e) =>
                setting(
                  "tieRules",
                  e.target.value.split(",") as State["settings"]["tieRules"],
                )
              }
            >
              <option value="diff,gf,direct">
                Diferència → Gols → Directe
              </option>
              <option value="direct,diff,gf">
                Directe → Diferència → Gols
              </option>
              <option value="gf,diff,direct">
                Gols → Diferència → Directe
              </option>
            </select>
          </label>
          <label>
            Format eliminatòries
            <select
              disabled={!editable}
              value={s.settings.knockout}
              onChange={(e) =>
                setting(
                  "knockout",
                  e.target.value as State["settings"]["knockout"],
                )
              }
            >
              <option value="two-tiebreak">2 partides + desempat si cal</option>
              <option value="best-of-three">Al millor de 3 (primer a 2)</option>
            </select>
          </label>
          <p className="hint">
            Amb estos dos formats es juguen dues partides i, només si hi ha
            empat 1–1, una tercera. El guanyador passa de ronda.
          </p>
        </section>
        <section className="admin-panel settings-panel">
          <h3>
            <Download size={20} /> Còpies i recuperació
          </h3>
          <p className="hint">
            Guardat automàtic després de cada acció. Còpia anterior i còpia
            periòdica cada minut. Exporta el JSON abans de canviar d’ordinador.
          </p>
          <button className="button yellow" onClick={exportTournament}>
            <Download size={16} /> EXPORTAR TORNEIG
          </button>
          <button
            className="button subtle"
            onClick={() => file.current?.click()}
          >
            <Upload size={16} /> IMPORTAR CÒPIA JSON
          </button>
          <input
            hidden
            type="file"
            accept=".json,application/json"
            ref={file}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              run(async () => {
                if (f.size > 5_000_000) throw Error("La còpia és massa gran.");
                const incoming = validateState(JSON.parse(await f.text()));
                confirm(
                  "Restaurar còpia de torneig",
                  `La còpia conté ${incoming.teams.length} parelles en ${phaseNames[incoming.phase]}. Substituirà el torneig actual.`,
                  () => commit(() => incoming, true, true),
                );
              });
              e.target.value = "";
            }}
          />
          <button
            className="button subtle"
            onClick={() =>
              confirm(
                "Recuperar còpia automàtica",
                "Es restaurarà l’estat anterior a l’última acció guardada.",
                restoreBackup,
              )
            }
          >
            RECUPERAR CÒPIA ANTERIOR
          </button>
          <button
            className="button subtle"
            onClick={() =>
              confirm(
                "Recuperar còpia periòdica",
                "Es restaurarà la còpia guardada automàticament cada minut.",
                () =>
                  commit(
                    () => {
                      const raw = localStorage.getItem(
                        "futboli-2027-v1-periodic",
                      );
                      if (!raw) throw Error("No hi ha còpia periòdica.");
                      return validateState(JSON.parse(raw));
                    },
                    false,
                    true,
                  ),
              )
            }
          >
            RECUPERAR CÒPIA PERIÒDICA
          </button>
        </section>
        <section className="admin-panel settings-panel">
          <h3>
            <RotateCcw size={20} /> Gestió del torneig
          </h3>
          <p className="hint">
            Desfer recupera l’estat de l’acció anterior, incloent resultats,
            fases i ajustos. Les últimes 12 accions es conserven en este
            navegador.
          </p>
          <button className="button subtle" onClick={() => run(undo)}>
            DESFER ÚLTIMA ACCIÓ
          </button>
          <button
            className="button danger-button"
            onClick={() =>
              confirm(
                "Reiniciar el torneig",
                "Primer avís: es retiraran totes les parelles i resultats del torneig actual. Exporta una còpia per conservar-los.",
                () => setResetStep(true),
              )
            }
          >
            REINICIAR TORNEIG
          </button>
          <p className="hint">
            La sincronització funciona entre pestanyes del mateix navegador i
            origen. Un altre dispositiu necessita un servei remot, que no està
            configurat en esta versió.
          </p>
        </section>
      </div>
      {resetStep && (
        <Dialog
          title="Segona confirmació: reiniciar"
          onClose={() => setResetStep(false)}
        >
          <p className="dialog-description">
            Segur que vols començar des de zero? Esta acció buidarà el torneig i
            tornarà a inscripcions.
          </p>
          <div className="dialog-actions">
            <button
              className="button subtle"
              onClick={() => setResetStep(false)}
            >
              Cancel·lar
            </button>
            <button
              className="button danger-button"
              onClick={() =>
                run(async () => {
                  await commit(() => initialState());
                  setResetStep(false);
                  onReset();
                })
              }
            >
              SÍ, REINICIAR TOT
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
