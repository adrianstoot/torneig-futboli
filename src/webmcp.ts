import { getState } from "./store";
import { queue, standings } from "./engine/tournament";
import { tables } from "./engine/types";
interface Registry {
  registerTool(
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options: { signal: AbortSignal },
  ): void | Promise<void>;
}
export function registerTools() {
  const context = (document as Document & { modelContext?: Registry })
    .modelContext;
  if (!context) return;
  const lifecycle = new AbortController();
  void Promise.resolve(
    context.registerTool(
      {
        name: "read_tournament_status",
        description:
          "Read the current tournament phase, the active and next match at each table, and group standings. Team names are user-entered.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(input) {
          if (!input || typeof input !== "object" || Object.keys(input).length)
            throw Error("Expected an empty object.");
          const s = getState();
          return {
            phase: s.phase,
            revision: s.revision,
            tables: tables.map((table) => ({
              table,
              matches: queue(s, table).slice(0, 2),
              standings: standings(s, table),
            })),
            teams: s.teams,
          };
        },
      },
      { signal: lifecycle.signal },
    ),
  ).catch(() => {});
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
}
