import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Clock3,
  Compass,
  Layers,
  Menu,
  Pause,
  Play,
  Plus,
  SkipForward,
  Square,
  TimerReset,
  X,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { Timeline } from "@/components/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { askLumen, type ChatTurn } from "@/lib/ask";
import {
  activeSession,
  MODELS,
  modelById,
  pickSkills,
  useEngine,
  type Session,
  type TimelineEvent,
} from "@/lib/engine";
import { cn, formatElapsed } from "@/lib/utils";

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isBusy(status: Session["status"]) {
  return status === "running" || status === "background";
}

export function Workspace() {
  const engine = useEngine();
  const session = activeSession(engine);
  const liveAbort = useRef(false);
  const playheadRef = useRef(session.playhead);
  const scroller = useRef<HTMLDivElement>(null);
  const draining = useRef(false);

  useEffect(() => {
    playheadRef.current = session.playhead;
  }, [session.id, session.status]);

  useEffect(() => {
    if (!isBusy(session.status)) return;
    let raf = 0;
    let last = performance.now();
    let local = activeSession(useEngine.getState()).playhead;
    playheadRef.current = local;
    const loop = (now: number) => {
      local += now - last;
      last = now;
      playheadRef.current = local;
      useEngine.getState().tickTo(local);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      useEngine.getState().flushPlayhead(playheadRef.current);
    };
  }, [session.status, session.id]);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [session.events.length, session.elapsedMs, session.status]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        const active = activeSession(useEngine.getState());
        if (isBusy(active.status)) {
          event.preventDefault();
          liveAbort.current = true;
          useEngine.getState().interrupt();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (session.status !== "complete" && session.status !== "interrupted") return;
    if (session.queue.length === 0) return;
    if (draining.current) return;
    draining.current = true;
    const timer = window.setTimeout(() => {
      const state = useEngine.getState();
      const current = activeSession(state);
      const queued = current.queue[0];
      if (!queued) {
        draining.current = false;
        return;
      }
      useEngine.setState({
        sessions: state.sessions.map((item) =>
          item.id === current.id ? { ...item, queue: item.queue.slice(1) } : item,
        ),
      });
      draining.current = false;
      void submit(queued.text);
    }, 400);
    return () => {
      window.clearTimeout(timer);
      draining.current = false;
    };
  }, [session.status, session.queue.length]);

  async function runLive(prompt: string) {
    liveAbort.current = false;
    const { pushEvent, updateEvent, finishLive } = useEngine.getState();
    const skills = pickSkills(prompt);
    for (const [index, skill] of skills.entries()) {
      if (liveAbort.current) return;
      const id = `live-sk-${Date.now()}-${index}`;
      pushEvent({
        id,
        kind: "skill",
        skillId: skill.id,
        name: skill.name,
        blurb: skill.blurb,
        durationLabel: "0.4s",
        status: "loading",
      });
      await wait(320);
      if (liveAbort.current) return;
      updateEvent(id, { status: "ready" });
    }

    const searchId = `live-ts-${Date.now()}`;
    pushEvent({
      id: searchId,
      kind: "tool-search",
      query: "relevant tools for this question",
      status: "running",
    });
    await wait(420);
    if (liveAbort.current) return;
    updateEvent(searchId, { status: "done" });

    const agentId = `live-ag-${Date.now()}`;
    pushEvent({
      id: agentId,
      kind: "agent",
      name: "Lumen",
      text: "",
      streaming: true,
    });

    const snapshot = activeSession(useEngine.getState());
    const history: ChatTurn[] = [];
    for (const event of snapshot.events) {
      if (event.kind === "user") history.push({ role: "user", content: event.text });
      if (event.kind === "agent" && event.text) {
        history.push({ role: "assistant", content: event.text });
      }
    }

    try {
      const result = await askLumen({ data: { prompt, history: history.slice(0, -1) } });
      if (liveAbort.current) return;
      if (result.ok && result.text) {
        updateEvent(agentId, { text: result.text, streaming: false });
      } else {
        updateEvent(agentId, {
          streaming: false,
          text: "I couldn’t reach a live model just now. Replay the relay investigation for a full walkthrough, or send the question again in a moment.",
        });
      }
    } catch {
      if (liveAbort.current) return;
      updateEvent(agentId, {
        streaming: false,
        text: "Something went wrong talking to the model. The timeline is intact — try again, or replay the sample investigation.",
      });
    }
    if (!liveAbort.current) finishLive();
  }

  function submit(text: string) {
    const state = useEngine.getState();
    const current = activeSession(state);
    const result = state.enqueueOrStart(text);
    if (result === "queued") {
      toast("Queued until this pass finishes");
      return;
    }
    const after = activeSession(useEngine.getState());
    const demoStillScripted = after.isDemo && after.appliedOps < 8;
    if (!demoStillScripted) {
      void runLive(text);
    }
  }

  return (
    <div className="flex h-dvh min-h-0 bg-background text-foreground">
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          className: "bg-card text-foreground border-border",
        }}
      />
      <Sidebar />
      {engine.navOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-background/60 lg:hidden"
          aria-label="Close menu"
          onClick={() => engine.setNavOpen(false)}
        />
      ) : null}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="h-px bg-live/35" />
        <Header
          session={session}
          onInterrupt={() => {
            liveAbort.current = true;
            engine.interrupt();
          }}
        />
        {engine.background ? <BackgroundBar elapsed={session.elapsedMs} /> : null}
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
            {session.events.length === 0 ? (
              <EmptyState onPick={submit} />
            ) : (
              <Timeline events={session.events} onFollowUp={submit} />
            )}
          </div>
        </div>
        <Composer
          session={session}
          onSubmit={submit}
          onInterrupt={() => {
            liveAbort.current = true;
            engine.interrupt();
          }}
        />
      </main>
      <SteerDialog />
    </div>
  );
}

function Sidebar() {
  const engine = useEngine();
  const session = activeSession(engine);
  const skills = session.events.filter(
    (event): event is Extract<TimelineEvent, { kind: "skill" }> => event.kind === "skill",
  );

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-card transition-transform duration-200 ease-out lg:static lg:translate-x-0",
        engine.navOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex h-14 items-center justify-between px-4">
        <Wordmark />
        <button
          type="button"
          className="rounded-md p-2 text-muted-foreground lg:hidden"
          onClick={() => engine.setNavOpen(false)}
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
      <div className="px-3">
        <Button className="w-full justify-start" onClick={() => engine.startBlank()}>
          <Plus className="size-4" />
          New investigation
        </Button>
      </div>
      <nav className="mt-4 min-h-0 flex-1 overflow-y-auto px-3">
        <p className="px-2 pb-2 text-xs tracking-wide text-subtle uppercase">Sessions</p>
        <ul className="flex flex-col gap-1">
          {engine.sessions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => engine.selectSession(item.id)}
                className={cn(
                  "flex w-full flex-col rounded-lg px-3 py-2.5 text-left transition-colors duration-150",
                  item.id === engine.activeId
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <span className="truncate text-sm font-medium">{item.title}</span>
                <span className="text-xs text-subtle">{statusLabel(item)}</span>
              </button>
            </li>
          ))}
        </ul>
        {skills.length > 0 ? (
          <div className="mt-6">
            <p className="px-2 pb-2 text-xs tracking-wide text-subtle uppercase">This pass</p>
            <ul className="flex flex-col gap-1 px-2">
              {skills.map((skill) => (
                <li key={skill.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{skill.name}</span>
                  <span className={skill.status === "ready" ? "text-live" : "text-subtle"}>
                    {skill.status === "ready" ? "Ready" : "Loading"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </nav>
      <div className="border-t border-border p-4">
        <p className="text-xs text-subtle">
          Live answers run on Grok 4.5. The sample replay uses the fleet’s default cascade.
        </p>
      </div>
    </aside>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative grid size-7 place-items-center rounded-md bg-card-2 hairline">
        <span className="size-2 rounded-full bg-live" />
      </span>
      <span className="font-display text-lg tracking-tight">Lumen</span>
    </div>
  );
}

function Header({
  session,
  onInterrupt,
}: {
  session: Session;
  onInterrupt: () => void;
}) {
  const engine = useEngine();
  const model = modelById(session.modelId);
  const busy = isBusy(session.status);

  return (
    <header className="flex h-14 items-center gap-2 border-b border-border px-3 sm:px-4">
      <button
        type="button"
        className="rounded-md p-2 text-muted-foreground lg:hidden"
        onClick={() => engine.setNavOpen(true)}
      >
        <Menu className="size-5" />
        <span className="sr-only">Open menu</span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{session.title}</p>
        <p className="hidden text-xs text-muted-foreground sm:block">{statusLabel(session)}</p>
      </div>
      <Clock />
      <Badge variant={busy ? "live" : session.status === "complete" ? "paper" : "outline"}>
        {busy ? "Live" : session.status === "complete" ? "Done" : session.status === "paused" ? "Paused" : "Idle"}
      </Badge>
      <span className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:inline">
        {formatElapsed(session.elapsedMs)}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="hidden max-w-44 truncate sm:inline-flex">
            <Layers className="size-3.5" />
            <span className="truncate">{model.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Session model</DropdownMenuLabel>
          {MODELS.map((item) => (
            <DropdownMenuItem key={item.id} onSelect={() => engine.setModel(item.id)}>
              <span className="flex flex-col">
                <span>{item.name}</span>
                <span className="text-xs text-muted-foreground">
                  {item.provider} · {item.note}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {session.isDemo && busy ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={() => engine.skip()}>
              <SkipForward className="size-4" />
              <span className="sr-only">Jump to findings</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Jump to findings</TooltipContent>
        </Tooltip>
      ) : null}
      {session.isDemo && session.status === "complete" ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={() => engine.replay()}>
              <TimerReset className="size-4" />
              <span className="sr-only">Replay</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Replay</TooltipContent>
        </Tooltip>
      ) : null}
      {busy ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="danger" size="icon-sm" onClick={onInterrupt}>
              <Square className="size-3.5 fill-current" />
              <span className="sr-only">Stop</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Stop · Ctrl+C</TooltipContent>
        </Tooltip>
      ) : null}
    </header>
  );
}

function Clock() {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const fmt = () =>
      new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
        new Date(),
      );
    setLabel(fmt());
    const id = window.setInterval(() => setLabel(fmt()), 30000);
    return () => window.clearInterval(id);
  }, []);
  if (!label) return null;
  return (
    <span className="hidden items-center gap-1 text-xs tabular-nums text-subtle md:inline-flex">
      <Clock3 className="size-3.5" />
      {label}
    </span>
  );
}

function BackgroundBar({ elapsed }: { elapsed: number }) {
  const engine = useEngine();
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-card-2 px-4 py-2 text-sm">
      <p className="text-muted-foreground">
        Working in the background ·{" "}
        <span className="font-mono tabular-nums text-foreground">{formatElapsed(elapsed)}</span>
      </p>
      <Button variant="ghost" size="sm" onClick={() => engine.setBackground(false)}>
        Show work
      </Button>
    </div>
  );
}

function Composer({
  session,
  onSubmit,
  onInterrupt,
}: {
  session: Session;
  onSubmit: (text: string) => void;
  onInterrupt: () => void;
}) {
  const engine = useEngine();
  const [draft, setDraft] = useState("");
  const busy = isBusy(session.status);

  function send() {
    const text = draft.trim();
    if (!text) return;
    onSubmit(text);
    setDraft("");
  }

  return (
    <div className="border-t border-border bg-background/90 px-3 py-3 sm:px-4">
      <div className="mx-auto w-full max-w-3xl">
        {session.queue.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {session.queue.map((item) => (
              <Badge key={item.id} variant="outline">
                Queued · {item.text.slice(0, 42)}
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="mb-2 flex flex-wrap gap-1.5">
          {busy ? (
            <>
              <Button variant="danger" size="sm" onClick={onInterrupt}>
                <Square className="size-3.5 fill-current" />
                Stop
              </Button>
              {session.status === "running" ? (
                <Button variant="ghost" size="sm" onClick={() => engine.pause()}>
                  <Pause className="size-3.5" />
                  Pause
                </Button>
              ) : null}
              {session.status === "paused" ? (
                <Button variant="ghost" size="sm" onClick={() => engine.resume()}>
                  <Play className="size-3.5" />
                  Resume
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => engine.setBackground(true)}>
                Hide
              </Button>
              <Button variant="ghost" size="sm" onClick={() => engine.setSteerOpen(true)}>
                <Compass className="size-3.5" />
                Steer
              </Button>
            </>
          ) : session.isDemo ? (
            <Button variant="ghost" size="sm" onClick={() => engine.replay()}>
              <TimerReset className="size-3.5" />
              Replay this pass
            </Button>
          ) : null}
        </div>
        <div className="flex items-end gap-2 rounded-xl bg-card p-2 hairline">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            placeholder={
              busy ? "Queue a follow-up, or steer the pass…" : "Ask Lumen to look into something…"
            }
            rows={2}
            className="min-h-12 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button
            size="icon"
            className="mb-0.5 shrink-0"
            onClick={send}
            disabled={!draft.trim()}
            aria-label={busy ? "Queue message" : "Send"}
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
        <p className="mt-2 px-1 text-xs text-subtle">
          Enter to send · Shift+Enter for a new line · Ctrl+C to stop
        </p>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const suggestions = [
    "Which model does fleet chat use first?",
    "Map every AI provider in the relay.",
    "Where are inference API keys loaded?",
  ];
  return (
    <div className="flex min-h-[60vh] flex-col justify-center">
      <p className="text-xs tracking-wide text-live uppercase">New investigation</p>
      <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
        What should we look into?
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        Lumen shows the work as it happens — skills, tools, and source — in language you can follow.
      </p>
      <div className="mt-6 flex flex-col gap-2">
        {suggestions.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onPick(item)}
            className="rounded-lg bg-card px-4 py-3 text-left text-sm hairline transition-colors hover:bg-card-2"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function SteerDialog() {
  const engine = useEngine();
  const [note, setNote] = useState("");

  return (
    <Dialog open={engine.steerOpen} onOpenChange={engine.setSteerOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Steer this pass</DialogTitle>
          <DialogDescription>
            Nudge the agent without stopping. It will treat this as a redirect for the rest of the work.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Focus on provider fallbacks, skip GitHub…"
          rows={4}
        />
        <div className="flex justify-end">
          <Button
            disabled={!note.trim()}
            onClick={() => {
              engine.addSteer(note.trim());
              setNote("");
              toast("Steering note added");
            }}
          >
            Send steer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function statusLabel(session: Session): string {
  if (session.status === "running") return "Investigating";
  if (session.status === "background") return "Working in the background";
  if (session.status === "paused") return "Paused";
  if (session.status === "complete") return "Complete";
  if (session.status === "interrupted") return "Stopped";
  return "Ready";
}
