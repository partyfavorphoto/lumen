import { create } from "zustand";

export type SessionStatus =
  | "idle"
  | "running"
  | "paused"
  | "complete"
  | "interrupted"
  | "background";

export type ModelOption = {
  id: string;
  name: string;
  provider: string;
  note: string;
};

export const MODELS: ModelOption[] = [
  {
    id: "openrouter:free",
    name: "OpenRouter Free",
    provider: "OpenRouter",
    note: "Free router with automatic fallback",
  },
  {
    id: "ollama:gpt-oss:20b",
    name: "Ollama Cloud · GPT-OSS 20B",
    provider: "Ollama Cloud",
    note: "Hosted open-weight model",
  },
];

export type SkillDef = {
  id: string;
  name: string;
  blurb: string;
  keywords: string[];
};

export const SKILLS: SkillDef[] = [
  {
    id: "relay-host",
    name: "Relay host",
    blurb: "How the live relay is wired",
    keywords: ["relay", "server", "host", "cascade"],
  },
  {
    id: "fleet",
    name: "Fleet agents",
    blurb: "XMRT DAO fleet chat roles",
    keywords: ["fleet", "agent", "xmrt", "dao"],
  },
  {
    id: "inspect",
    name: "Code inspection",
    blurb: "Read source without changing it",
    keywords: ["code", "source", "js", "read"],
  },
  {
    id: "hermes",
    name: "Agent runtime",
    blurb: "Hermes loop, tools, and memory",
    keywords: ["hermes", "agent", "runtime", "tool"],
  },
  {
    id: "api-debug",
    name: "API debugging",
    blurb: "Local stack and inference keys",
    keywords: ["api", "debug", "key", "provider"],
  },
  {
    id: "sys-debug",
    name: "Systematic debug",
    blurb: "Trace a path end to end",
    keywords: ["debug", "trace", "investigate"],
  },
  {
    id: "review",
    name: "Code review",
    blurb: "Flag risky inference defaults",
    keywords: ["review", "risk", "fallback"],
  },
  {
    id: "github",
    name: "GitHub",
    blurb: "Repository state and history",
    keywords: ["git", "github", "repo"],
  },
];

export type CascadeRung = {
  provider: string;
  model: string;
  role: string;
  file: string;
};

export type Findings = {
  summary: string;
  cascade: CascadeRung[];
  files: { path: string; note: string }[];
  notes: string[];
};

export type TimelineEvent =
  | { id: string; kind: "user"; text: string; verbatim: string }
  | {
      id: string;
      kind: "skill";
      skillId: string;
      name: string;
      blurb: string;
      durationLabel: string;
      status: "loading" | "ready";
    }
  | {
      id: string;
      kind: "tool-search";
      query: string;
      status: "running" | "done";
    }
  | {
      id: string;
      kind: "tool";
      name: string;
      detail: string;
      status: "running" | "done";
    }
  | {
      id: string;
      kind: "recalls";
      items: { name: string; detail: string }[];
    }
  | {
      id: string;
      kind: "todos";
      items: { id: string; text: string; done: boolean }[];
    }
  | {
      id: string;
      kind: "agent";
      name: string;
      text: string;
      streaming?: boolean;
    }
  | {
      id: string;
      kind: "code";
      title: string;
      file: string;
      lang: string;
      snippet: string;
      status: "running" | "done";
    }
  | { id: string; kind: "steer"; text: string }
  | { id: string; kind: "system"; text: string }
  | { id: string; kind: "findings"; data: Findings };

export type QueuedMessage = { id: string; text: string };

export type Session = {
  id: string;
  title: string;
  isDemo: boolean;
  modelId: string;
  status: SessionStatus;
  events: TimelineEvent[];
  queue: QueuedMessage[];
  playhead: number;
  appliedOps: number;
  elapsedMs: number;
};

export const DEMO_ID = "demo-relay";

export const DEMO_PROMPT =
  "Which AI models and providers sit in the inference cascade — and where do the fleet agents pick them up?";

export const DEMO_VERBATIM =
  "investigate what models and which providers are in the ai inference source cascade for the relay.js and the various agents we need to read the full server.js and any other code related to AI in the xmrtdao relay and fleet chat systems";

export const DEMO_FINDINGS: Findings = {
  summary:
    "The relay does not pin a single model. Chat requests walk a four-rung cascade: a free OpenRouter default, then xAI for tool-heavy agent turns, Groq for routing, and Anthropic only when the review skill is on.",
  cascade: [
    {
      provider: "OpenRouter",
      model: "nex-n2.5-pro:free",
      role: "Default for fleet chat",
      file: "relay.js",
    },
    {
      provider: "xAI",
      model: "grok-4.5",
      role: "Hermes agent, tools, long traces",
      file: "agents/hermes.js",
    },
    {
      provider: "Groq",
      model: "llama-3.3-70b-versatile",
      role: "Fast skill routing",
      file: "relay.js",
    },
    {
      provider: "Anthropic",
      model: "claude-sonnet-4",
      role: "Code review skill only",
      file: "agents/review.js",
    },
  ],
  files: [
    {
      path: "relay.js",
      note: "INFERENCE_CASCADE array and selectProvider()",
    },
    {
      path: "server.js",
      note: "HTTP entry, env keys, per-provider rate limits",
    },
    {
      path: "agents/hermes.js",
      note: "modelOverride → xAI when tools are required",
    },
    {
      path: "agents/fleet-chat.js",
      note: "Inherits the OpenRouter default",
    },
    {
      path: "agents/review.js",
      note: "Hard-pins Claude Sonnet",
    },
  ],
  notes: [
    "Read-only pass — no relay edits or restarts.",
    "Free OpenRouter is first so fleet chat stays cheap; paid rungs only fire on fallback or skill pin.",
    "Missing keys skip a rung rather than failing the request.",
  ],
};

export type DemoOp =
  | { at: number; op: "push"; event: TimelineEvent }
  | { at: number; op: "update"; id: string; patch: Record<string, unknown> }
  | { at: number; op: "complete" };

function skill(
  at: number,
  id: string,
  skillId: string,
  name: string,
  blurb: string,
  durationLabel: string,
  readyAt: number,
): DemoOp[] {
  return [
    {
      at,
      op: "push",
      event: {
        id,
        kind: "skill",
        skillId,
        name,
        blurb,
        durationLabel,
        status: "loading",
      },
    },
    { at: readyAt, op: "update", id, patch: { status: "ready" } },
  ];
}

export const DEMO_OPS: DemoOp[] = [
  {
    at: 0,
    op: "push",
    event: {
      id: "user-1",
      kind: "user",
      text: DEMO_PROMPT,
      verbatim: DEMO_VERBATIM,
    },
  },
  ...skill(420, "sk-1", "relay-host", "Relay host", "How the live relay is wired", "1.9s", 1900),
  ...skill(720, "sk-2", "fleet", "Fleet agents", "XMRT DAO fleet chat roles", "2.0s", 2200),
  ...skill(980, "sk-3", "inspect", "Code inspection", "Read source without changing it", "1.9s", 2500),
  ...skill(1200, "sk-4", "hermes", "Agent runtime", "Hermes loop, tools, and memory", "0.2s", 1600),
  {
    at: 2800,
    op: "push",
    event: {
      id: "ts-1",
      kind: "tool-search",
      query: "shell, python, database",
      status: "running",
    },
  },
  { at: 3400, op: "update", id: "ts-1", patch: { status: "done" } },
  {
    at: 3500,
    op: "push",
    event: {
      id: "rec-1",
      kind: "recalls",
      items: [
        { name: "shell-exec", detail: "Repository layout and live process" },
        { name: "python-exec", detail: "Parse configs and cascade arrays" },
        { name: "db-query", detail: "Agent runtime records" },
      ],
    },
  },
  ...skill(4100, "sk-5", "api-debug", "API debugging", "Local stack and inference keys", "2.4s", 5600),
  ...skill(4300, "sk-6", "sys-debug", "Systematic debug", "Trace a path end to end", "2.5s", 5900),
  ...skill(4500, "sk-7", "review", "Code review", "Flag risky inference defaults", "2.5s", 6100),
  ...skill(4700, "sk-8", "github", "GitHub", "Repository state and history", "2.5s", 6200),
  {
    at: 6400,
    op: "push",
    event: {
      id: "todo-1",
      kind: "todos",
      items: [
        { id: "t1", text: "Confirm the live relay repository state", done: false },
        { id: "t2", text: "Read server.js end to end", done: false },
        { id: "t3", text: "Collect every model and provider reference", done: false },
        { id: "t4", text: "Cross-check agent runtime configs", done: false },
        { id: "t5", text: "Verify routes against the cascade", done: false },
      ],
    },
  },
  {
    at: 7200,
    op: "push",
    event: {
      id: "agent-1",
      kind: "agent",
      name: "Lumen",
      text: "I’ll start with the live relay: repository state, then the full server.js, then every model and provider mention. After that, agent configs and a route check. Read-only — no edits, no restarts.",
    },
  },
  {
    at: 8200,
    op: "push",
    event: {
      id: "code-1",
      kind: "code",
      title: "Reading the cascade",
      file: "relay.js",
      lang: "js",
      snippet: `const INFERENCE_CASCADE = [
  { provider: "openrouter", model: "nex-n2.5-pro:free" },
  { provider: "xai",        model: "grok-4.5" },
  { provider: "groq",       model: "llama-3.3-70b-versatile" },
  { provider: "anthropic",  model: "claude-sonnet-4", skill: "review" },
];`,
      status: "running",
    },
  },
  {
    at: 9000,
    op: "update",
    id: "todo-1",
    patch: {
      items: [
        { id: "t1", text: "Confirm the live relay repository state", done: true },
        { id: "t2", text: "Read server.js end to end", done: false },
        { id: "t3", text: "Collect every model and provider reference", done: false },
        { id: "t4", text: "Cross-check agent runtime configs", done: false },
        { id: "t5", text: "Verify routes against the cascade", done: false },
      ],
    },
  },
  { at: 9800, op: "update", id: "code-1", patch: { status: "done" } },
  {
    at: 10200,
    op: "push",
    event: {
      id: "code-2",
      kind: "code",
      title: "HTTP entry and keys",
      file: "server.js",
      lang: "js",
      snippet: `function selectProvider(req) {
  const cascade = INFERENCE_CASCADE.filter((rung) =>
    hasKey(rung.provider) && skillAllows(req, rung),
  );
  return cascade[0] ?? failClosed(req);
}`,
      status: "running",
    },
  },
  {
    at: 11000,
    op: "update",
    id: "todo-1",
    patch: {
      items: [
        { id: "t1", text: "Confirm the live relay repository state", done: true },
        { id: "t2", text: "Read server.js end to end", done: true },
        { id: "t3", text: "Collect every model and provider reference", done: false },
        { id: "t4", text: "Cross-check agent runtime configs", done: false },
        { id: "t5", text: "Verify routes against the cascade", done: false },
      ],
    },
  },
  { at: 11800, op: "update", id: "code-2", patch: { status: "done" } },
  {
    at: 12200,
    op: "push",
    event: {
      id: "code-3",
      kind: "code",
      title: "Agent overrides",
      file: "agents/hermes.js",
      lang: "js",
      snippet: `export const hermes = {
  modelOverride: "xai:grok-4.5",
  tools: ["shell-exec", "python-exec", "db-query"],
  fallback: "openrouter:nex-n2.5-pro:free",
};`,
      status: "running",
    },
  },
  { at: 13800, op: "update", id: "code-3", patch: { status: "done" } },
  {
    at: 14200,
    op: "update",
    id: "todo-1",
    patch: {
      items: [
        { id: "t1", text: "Confirm the live relay repository state", done: true },
        { id: "t2", text: "Read server.js end to end", done: true },
        { id: "t3", text: "Collect every model and provider reference", done: true },
        { id: "t4", text: "Cross-check agent runtime configs", done: true },
        { id: "t5", text: "Verify routes against the cascade", done: true },
      ],
    },
  },
  {
    at: 15000,
    op: "push",
    event: { id: "find-1", kind: "findings", data: DEMO_FINDINGS },
  },
  { at: 15200, op: "complete" },
];

export const DEMO_DURATION = 15200;

function applyOp(events: TimelineEvent[], op: DemoOp): TimelineEvent[] {
  if (op.op === "push") return [...events, op.event];
  if (op.op === "update") {
    return events.map((event) =>
      event.id === op.id ? ({ ...event, ...op.patch } as TimelineEvent) : event,
    );
  }
  return events;
}

function seedDemo(): Session {
  return {
    id: DEMO_ID,
    title: "Relay inference cascade",
    isDemo: true,
    modelId: MODELS[0].id,
    status: "running",
    events: [
      {
        id: "user-1",
        kind: "user",
        text: DEMO_PROMPT,
        verbatim: DEMO_VERBATIM,
      },
    ],
    queue: [],
    playhead: 0,
    appliedOps: 1,
    elapsedMs: 0,
  };
}


function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

type EngineState = {
  sessions: Session[];
  activeId: string;
  navOpen: boolean;
  steerOpen: boolean;
  background: boolean;
  setNavOpen: (open: boolean) => void;
  setSteerOpen: (open: boolean) => void;
  setBackground: (on: boolean) => void;
  selectSession: (id: string) => void;
  setModel: (id: string) => void;
  tickTo: (playhead: number) => void;
  flushPlayhead: (playhead: number) => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  replay: () => void;
  interrupt: () => void;
  enqueueOrStart: (text: string) => "queued" | "started";
  addSteer: (text: string) => void;
  pushEvent: (event: TimelineEvent) => void;
  updateEvent: (id: string, patch: Record<string, unknown>) => void;
  finishLive: () => void;
  startBlank: () => void;
};

function mapActive(sessions: Session[], activeId: string, fn: (s: Session) => Session): Session[] {
  return sessions.map((s) => (s.id === activeId ? fn(s) : s));
}

export const useEngine = create<EngineState>((set, get) => ({
  sessions: [seedDemo()],
  activeId: DEMO_ID,
  navOpen: false,
  steerOpen: false,
  background: false,
  setNavOpen: (open) => set({ navOpen: open }),
  setSteerOpen: (open) => set({ steerOpen: open }),
  setBackground: (on) =>
    set((state) => ({
      background: on,
      sessions: mapActive(state.sessions, state.activeId, (s) => ({
        ...s,
        status:
          s.status === "running" || s.status === "background"
            ? on
              ? "background"
              : "running"
            : s.status,
      })),
    })),
  selectSession: (id) => set({ activeId: id, navOpen: false }),
  setModel: (id) =>
    set((state) => ({
      sessions: mapActive(state.sessions, state.activeId, (s) => ({
        ...s,
        modelId: id,
      })),
    })),
  tickTo: (playhead: number) =>
    set((state) => {
      const session = state.sessions.find((s) => s.id === state.activeId);
      if (!session || (session.status !== "running" && session.status !== "background")) {
        return state;
      }
      if (!session.isDemo) {
        if (Math.floor(playhead / 250) === Math.floor(session.elapsedMs / 250)) {
          return state;
        }
        return {
          sessions: mapActive(state.sessions, state.activeId, (s) => ({
            ...s,
            playhead,
            elapsedMs: playhead,
          })),
        };
      }
      let events = session.events;
      let applied = session.appliedOps;
      let status: SessionStatus = session.status;
      let appliedAny = false;
      while (applied < DEMO_OPS.length && DEMO_OPS[applied].at <= playhead) {
        const op = DEMO_OPS[applied];
        if (op.op === "complete") {
          status = "complete";
        } else {
          events = applyOp(events, op);
        }
        applied += 1;
        appliedAny = true;
      }
      const elapsedBucket = Math.floor(playhead / 250);
      const prevBucket = Math.floor(session.elapsedMs / 250);
      if (!appliedAny && elapsedBucket === prevBucket && status === session.status) {
        return state;
      }
      return {
        sessions: mapActive(state.sessions, state.activeId, (s) => ({
          ...s,
          playhead,
          appliedOps: applied,
          events,
          status,
          elapsedMs: playhead,
        })),
      };
    }),
  flushPlayhead: (playhead: number) =>
    set((state) => ({
      sessions: mapActive(state.sessions, state.activeId, (s) => ({
        ...s,
        playhead,
        elapsedMs: playhead,
      })),
    })),
  pause: () =>
    set((state) => ({
      sessions: mapActive(state.sessions, state.activeId, (s) =>
        s.status === "running" ? { ...s, status: "paused" } : s,
      ),
    })),
  resume: () =>
    set((state) => ({
      background: false,
      sessions: mapActive(state.sessions, state.activeId, (s) =>
        s.status === "paused" || s.status === "background"
          ? { ...s, status: "running" }
          : s,
      ),
    })),
  skip: () =>
    set((state) => {
      let events: TimelineEvent[] = [];
      for (const op of DEMO_OPS) {
        if (op.op !== "complete") events = applyOp(events, op);
      }
      return {
        background: false,
        sessions: mapActive(state.sessions, state.activeId, (s) => ({
          ...s,
          events,
          appliedOps: DEMO_OPS.length,
          playhead: DEMO_DURATION,
          elapsedMs: DEMO_DURATION,
          status: "complete",
        })),
      };
    }),
  replay: () =>
    set((state) => ({
      background: false,
      sessions: mapActive(state.sessions, state.activeId, (s) =>
        s.isDemo
          ? {
              ...s,
              events: [],
              queue: [],
              playhead: 0,
              appliedOps: 0,
              elapsedMs: 0,
              status: "running",
            }
          : s,
      ),
    })),
  interrupt: () =>
    set((state) => ({
      background: false,
      sessions: mapActive(state.sessions, state.activeId, (s) => ({
        ...s,
        status: "interrupted",
        events: [
          ...s.events,
          {
            id: newId("sys"),
            kind: "system",
            text: "Stopped. Partial work is still on the timeline.",
          },
        ],
      })),
    })),
  enqueueOrStart: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return "queued";
    const { sessions, activeId } = get();
    const session = sessions.find((s) => s.id === activeId);
    if (!session) return "queued";
    if (session.status === "running" || session.status === "background") {
      set({
        sessions: mapActive(sessions, activeId, (s) => ({
          ...s,
          queue: [...s.queue, { id: newId("q"), text: trimmed }],
        })),
      });
      return "queued";
    }
    set({
      sessions: mapActive(sessions, activeId, (s) => ({
        ...s,
        title: s.events.length === 0 ? trimmed.slice(0, 42) : s.title,
        status: "running",
        elapsedMs: 0,
        events: [
          ...s.events,
          {
            id: newId("user"),
            kind: "user",
            text: trimmed,
            verbatim: trimmed,
          },
        ],
      })),
    });
    return "started";
  },
  addSteer: (text) =>
    set((state) => ({
      steerOpen: false,
      sessions: mapActive(state.sessions, state.activeId, (s) => ({
        ...s,
        events: [
          ...s.events,
          {
            id: newId("steer"),
            kind: "steer",
            text: text.trim(),
          },
        ],
      })),
    })),
  pushEvent: (event) =>
    set((state) => ({
      sessions: mapActive(state.sessions, state.activeId, (s) => ({
        ...s,
        events: [...s.events, event],
      })),
    })),
  updateEvent: (id, patch) =>
    set((state) => ({
      sessions: mapActive(state.sessions, state.activeId, (s) => ({
        ...s,
        events: s.events.map((event) =>
          event.id === id ? ({ ...event, ...patch } as TimelineEvent) : event,
        ),
      })),
    })),
  finishLive: () =>
    set((state) => ({
      background: false,
      sessions: mapActive(state.sessions, state.activeId, (s) => ({
        ...s,
        status: "complete",
      })),
    })),
  startBlank: () => {
    const id = newId("ses");
    const session: Session = {
      id,
      title: "New investigation",
      isDemo: false,
      modelId: MODELS[1].id,
      status: "idle",
      events: [],
      queue: [],
      playhead: 0,
      appliedOps: 0,
      elapsedMs: 0,
    };
    set((state) => ({
      sessions: [session, ...state.sessions],
      activeId: id,
      navOpen: false,
      background: false,
    }));
  },
}));

export function activeSession(state: EngineState): Session {
  return state.sessions.find((s) => s.id === state.activeId) ?? state.sessions[0];
}

export function pickSkills(prompt: string): SkillDef[] {
  const q = prompt.toLowerCase();
  const scored = SKILLS.map((skill) => ({
    skill,
    n: skill.keywords.filter((k) => q.includes(k)).length,
  })).sort((a, b) => b.n - a.n);
  const picked = scored.filter((s) => s.n > 0).map((s) => s.skill);
  const base = picked.length > 0 ? picked : SKILLS.slice(0, 4);
  const unique = [...base];
  for (const skill of SKILLS) {
    if (unique.length >= 5) break;
    if (!unique.some((s) => s.id === skill.id)) unique.push(skill);
  }
  return unique.slice(0, 5);
}

export function modelById(id: string): ModelOption {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}
