import { useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  GitBranch,
  ListTodo,
  LoaderCircle,
  Search,
  Terminal,
  User,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Findings, TimelineEvent } from "@/lib/engine";
import { cn } from "@/lib/utils";

type Cluster =
  | { key: string; kind: "skills"; items: Extract<TimelineEvent, { kind: "skill" }>[] }
  | { key: string; kind: "single"; event: TimelineEvent };

function clusterEvents(events: TimelineEvent[]): Cluster[] {
  const clusters: Cluster[] = [];
  for (const event of events) {
    const last = clusters[clusters.length - 1];
    if (event.kind === "skill" && last?.kind === "skills") {
      last.items.push(event);
    } else if (event.kind === "skill") {
      clusters.push({ key: event.id, kind: "skills", items: [event] });
    } else {
      clusters.push({ key: event.id, kind: "single", event });
    }
  }
  return clusters;
}

export function Timeline({
  events,
  onFollowUp,
}: {
  events: TimelineEvent[];
  onFollowUp: (text: string) => void;
}) {
  const clusters = useMemo(() => clusterEvents(events), [events]);

  return (
    <ol className="flex flex-col gap-4 pb-8">
      {clusters.map((cluster, index) => (
        <li
          key={cluster.key}
          className="lumen-enter"
          style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
        >
          {cluster.kind === "skills" ? (
            <SkillsBlock items={cluster.items} />
          ) : (
            <EventCard event={cluster.event} onFollowUp={onFollowUp} />
          )}
        </li>
      ))}
    </ol>
  );
}

function EventCard({
  event,
  onFollowUp,
}: {
  event: TimelineEvent;
  onFollowUp: (text: string) => void;
}) {
  switch (event.kind) {
    case "user":
      return <UserCard event={event} />;
    case "tool-search":
      return <ToolSearchCard event={event} />;
    case "tool":
      return <ToolCard event={event} />;
    case "recalls":
      return <RecallsCard event={event} />;
    case "todos":
      return <TodosCard event={event} />;
    case "agent":
      return <AgentCard event={event} />;
    case "code":
      return <CodeCard event={event} />;
    case "steer":
      return <SteerCard event={event} />;
    case "system":
      return (
        <p className="px-1 text-sm text-muted-foreground">{event.text}</p>
      );
    case "findings":
      return <FindingsCard data={event.data} onFollowUp={onFollowUp} />;
    default:
      return null;
  }
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      <Icon className="size-3.5" />
      {children}
    </div>
  );
}

function UserCard({ event }: { event: Extract<TimelineEvent, { kind: "user" }> }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="rounded-xl bg-card p-4 hairline sm:p-5">
      <SectionLabel icon={User}>You asked</SectionLabel>
      <p className="font-display text-xl leading-snug tracking-tight text-foreground sm:text-2xl">
        {event.text}
      </p>
      {event.verbatim !== event.text ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform duration-150",
                open && "rotate-180",
              )}
            />
            Original wording
          </button>
          {open ? (
            <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {event.verbatim}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function SkillsBlock({
  items,
}: {
  items: Extract<TimelineEvent, { kind: "skill" }>[];
}) {
  const ready = items.filter((s) => s.status === "ready").length;
  return (
    <section>
      <SectionLabel icon={BookOpen}>
        Skills {ready}/{items.length}
      </SectionLabel>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((skill) => (
          <li
            key={skill.id}
            className="flex items-start gap-3 rounded-lg bg-card px-3 py-3 hairline"
          >
            <span
              className={cn(
                "mt-0.5 grid size-8 shrink-0 place-items-center rounded-md",
                skill.status === "ready" ? "bg-live/15 text-live" : "bg-muted text-subtle",
              )}
            >
              {skill.status === "ready" ? (
                <Check className="size-4" />
              ) : (
                <LoaderCircle className="size-4 animate-spin" />
              )}
            </span>
            <span className="min-w-0">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{skill.name}</span>
                <span className="font-mono text-xs text-subtle">{skill.durationLabel}</span>
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{skill.blurb}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ToolSearchCard({
  event,
}: {
  event: Extract<TimelineEvent, { kind: "tool-search" }>;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-card px-3 py-3 hairline">
      <span className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
        {event.status === "done" ? (
          <Search className="size-4" />
        ) : (
          <LoaderCircle className="size-4 animate-spin" />
        )}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">Looking up tools</p>
        <p className="text-xs text-muted-foreground">{event.query}</p>
      </div>
      <Badge variant={event.status === "done" ? "live" : "outline"} className="ml-auto">
        {event.status === "done" ? "Ready" : "Searching"}
      </Badge>
    </div>
  );
}

function ToolCard({ event }: { event: Extract<TimelineEvent, { kind: "tool" }> }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-card px-3 py-3 hairline">
      <span className="grid size-8 place-items-center rounded-md bg-muted text-warn">
        <Zap className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{event.name}</p>
        <p className="text-xs text-muted-foreground">{event.detail}</p>
      </div>
    </div>
  );
}

function RecallsCard({ event }: { event: Extract<TimelineEvent, { kind: "recalls" }> }) {
  return (
    <section>
      <SectionLabel icon={Search}>Remembered tools</SectionLabel>
      <ul className="flex flex-col gap-2">
        {event.items.map((item) => (
          <li
            key={item.name}
            className="flex flex-col gap-1 rounded-lg bg-card px-3 py-2.5 hairline sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          >
            <span className="font-mono text-sm text-foreground">{item.name}</span>
            <span className="text-xs text-muted-foreground">{item.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TodosCard({ event }: { event: Extract<TimelineEvent, { kind: "todos" }> }) {
  const done = event.items.filter((i) => i.done).length;
  return (
    <section className="rounded-xl bg-card p-4 hairline">
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel icon={ListTodo}>Plan</SectionLabel>
        <span className="text-xs tabular-nums text-muted-foreground">
          {done}/{event.items.length}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {event.items.map((item) => (
          <li key={item.id} className="flex items-start gap-2.5 text-sm">
            <span
              className={cn(
                "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                item.done
                  ? "border-live bg-live text-live-fg"
                  : "border-border-strong text-transparent",
              )}
            >
              <Check className="size-2.5" />
            </span>
            <span className={item.done ? "text-muted-foreground line-through" : "text-foreground"}>
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AgentCard({ event }: { event: Extract<TimelineEvent, { kind: "agent" }> }) {
  return (
    <article className="border-l-2 border-live/70 pl-4">
      <p className="mb-1 text-xs font-medium tracking-wide text-live uppercase">{event.name}</p>
      {event.streaming && !event.text ? (
        <p className="lumen-shimmer text-sm">Reading the source…</p>
      ) : (
        <p className="max-w-prose text-sm leading-relaxed text-foreground/90">{event.text}</p>
      )}
    </article>
  );
}

function CodeCard({ event }: { event: Extract<TimelineEvent, { kind: "code" }> }) {
  return (
    <figure className="overflow-hidden rounded-xl bg-card hairline">
      <figcaption className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Terminal className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">{event.title}</span>
        <span className="font-mono text-xs text-subtle">{event.file}</span>
        <span className="ml-auto">
          {event.status === "running" ? (
            <LoaderCircle className="size-3.5 animate-spin text-live" />
          ) : (
            <Check className="size-3.5 text-live" />
          )}
        </span>
      </figcaption>
      <pre className="overflow-x-auto px-3 py-3 font-mono text-xs leading-relaxed text-primary/90">
        <code>{event.snippet}</code>
      </pre>
    </figure>
  );
}

function SteerCard({ event }: { event: Extract<TimelineEvent, { kind: "steer" }> }) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-card-2 px-3 py-3">
      <p className="text-xs font-medium tracking-wide text-warn uppercase">Steer</p>
      <p className="mt-1 text-sm">{event.text}</p>
    </div>
  );
}

const FOLLOW_UPS = [
  "What happens if OpenRouter is down?",
  "Which environment keys does server.js read?",
  "Do fleet agents ever skip the cascade?",
];

function FindingsCard({
  data,
  onFollowUp,
}: {
  data: Findings;
  onFollowUp: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const body = [
      data.summary,
      "",
      "Cascade",
      ...data.cascade.map((r) => `${r.provider} · ${r.model} — ${r.role}`),
      "",
      "Files",
      ...data.files.map((f) => `${f.path} — ${f.note}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="rounded-2xl bg-card p-4 hairline sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-live uppercase">Findings</p>
          <h2 className="mt-1 font-display text-2xl tracking-tight">The cascade, in order</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={copy} className="shrink-0">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
        {data.summary}
      </p>

      <ol className="mt-6">
        {data.cascade.map((rung, i) => (
          <li key={rung.model} className="relative flex gap-4 pb-5 last:pb-0">
            {i < data.cascade.length - 1 ? (
              <span className="absolute top-7 left-[11px] h-[calc(100%-16px)] w-px bg-border" />
            ) : null}
            <span className="relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-live/15 font-mono text-xs text-live">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 rounded-lg bg-card-2 px-3 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{rung.provider}</p>
                <p className="font-mono text-xs text-subtle">{rung.file}</p>
              </div>
              <p className="mt-1 font-mono text-sm text-live">{rung.model}</p>
              <p className="mt-1 text-xs text-muted-foreground">{rung.role}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4">
        <SectionLabel icon={GitBranch}>Where it lives</SectionLabel>
        <ul className="flex flex-col gap-1.5">
          {data.files.map((file) => (
            <li
              key={file.path}
              className="flex flex-col gap-0.5 rounded-md px-1 py-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
            >
              <span className="font-mono text-sm text-primary">{file.path}</span>
              <span className="text-xs text-muted-foreground">{file.note}</span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="mt-4 flex flex-col gap-1.5">
        {data.notes.map((note) => (
          <li key={note} className="flex gap-2 text-xs text-muted-foreground">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-live" />
            {note}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-col gap-2">
        <p className="text-xs text-subtle">Ask a follow-up</p>
        <div className="flex flex-wrap gap-2">
          {FOLLOW_UPS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onFollowUp(q)}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
