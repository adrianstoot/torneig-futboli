import type { CSSProperties } from "react";
export function Foosball({
  active,
  table,
}: {
  active: boolean;
  table: number;
}) {
  return (
    <div
      className={`foosball ${active ? "playing" : "idle"}`}
      style={{ "--offset": `${table * -0.73}s` } as CSSProperties}
      aria-label={`Futbolí ${table}: ${active ? "animació decorativa del partit en joc" : "en espera"}`}
    >
      <div className="table-shadow" />
      <div className="wood">
        <div className="pitch">
          <div className="pitch-lines" />
          <div className="centre-circle" />
          <div className="goal goal-left" />
          <div className="goal goal-right" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
            <div
              className={`rod rod-${n} ${[0, 2, 4, 6].includes(n) ? "red" : "blue"}`}
              style={
                {
                  left: `${7 + n * 12.2}%`,
                  "--delay": `${n * -0.23 - table * 0.4}s`,
                } as CSSProperties
              }
              key={n}
            >
              <span className="rod-metal" />
              {Array.from(
                { length: n === 0 || n === 7 ? 1 : n === 1 || n === 6 ? 2 : 3 },
                (_, j) => (
                  <span
                    key={j}
                    className="foos-player"
                    style={{
                      top: `${((j + 1) * 100) / ((n === 0 || n === 7 ? 1 : n === 1 || n === 6 ? 2 : 3) + 1)}%`,
                    }}
                  >
                    <i />
                    <b />
                    <em />
                  </span>
                ),
              )}
            </div>
          ))}
          <div className="ball-track">
            <div className="ball" />
          </div>
          <div className="pitch-shine" />
        </div>
        <span className="table-logo">L’ALQUERIETA · FUTBOLÍ</span>
      </div>
    </div>
  );
}
