import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { State, Event } from "../engine/types";
export function Presenter({ s, event }: { s: State; event: Event }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % Math.max(1, event.teams.length)),
      1600,
    );
    return () => clearInterval(timer);
  }, [event.id]);
  const team = s.teams.find((t) => t.id === event.teams[index]);
  return (
    <div className="presenter">
      <div className="presenter-sweep" />
      <img
        src="/assets/mascota.png"
        alt="Mascota oficial presentant les parelles"
      />
      <div className="presenter-copy">
        <span>LA FALLA AMB VOSALTRES!</span>
        <h2>{event.title}</h2>
        <p>{event.detail}</p>
        {team && (
          <AnimatePresence mode="wait">
            <motion.div
              className="spotlight-team"
              key={team.id}
              initial={{ x: 45, opacity: 0, filter: "blur(5px)" }}
              animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ x: -35, opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <small>
                {index + 1} / {event.teams.length} · FUTBOLÍ {team.group}
              </small>
              <strong>{team.name}</strong>
              <b>
                {team.player1} / {team.player2}
              </b>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
      <div className="presenter-progress">
        <i
          key={event.id}
          style={{
            animationDuration: `${Math.max(12000, event.teams.length * 1600)}ms`,
          }}
        />
      </div>
    </div>
  );
}
