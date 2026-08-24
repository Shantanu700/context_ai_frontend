import {
  AudioLines,
  ChevronDown,
  Clapperboard,
  CircleHelp,
  Folder,
  House,
  Layers,
  Maximize2,
  Mic,
  Music,
  Plus,
  Redo2,
  Scissors,
  Search,
  Send,
  Settings,
  Share2,
  SkipBack,
  SkipForward,
  Sparkles,
  Star,
  Type,
  Undo2,
  Play,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { FRAME } from "@/lib/frame";

export default function DesignSystem() {
  return (
    <main className="stage-ambient min-h-screen text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-16 md:px-10">
        <Masthead />

        <Section n="The stage" title="Shell">
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Regions float on the ground as solid panels. The gap between them is
            the divider — no rules, no outlines. Depth comes from four surface
            steps and nothing else.
          </p>
          <Shell />
        </Section>

        <Section n="The rule" title="Glass only over media">
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Glass is a lens. Over footage it refracts and the control reads as an
            object resting on the image. Over the flat stage it has nothing to
            bend and reads as dirty plastic — so over the stage, controls are
            solid.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Demo label="Over media" verdict="glass">
              <div
                className="flex h-40 items-center justify-center gap-3 rounded-xl"
                style={{ backgroundImage: FRAME }}
              >
                <Button variant="glass" size="icon-lg" aria-label="Previous clip">
                  <SkipBack />
                </Button>
                <Button variant="glass" size="icon-xl" aria-label="Play">
                  <Play />
                </Button>
                <Button variant="glass" size="icon-lg" aria-label="Next clip">
                  <SkipForward />
                </Button>
              </div>
            </Demo>
            <Demo label="Over the stage" verdict="solid">
              <div className="flex h-40 items-center justify-center gap-3 rounded-xl bg-panel">
                <Button variant="secondary" size="icon-lg" aria-label="Previous clip">
                  <SkipBack />
                </Button>
                <Button variant="signal" size="icon-xl" aria-label="Play">
                  <Play />
                </Button>
                <Button variant="secondary" size="icon-lg" aria-label="Next clip">
                  <SkipForward />
                </Button>
              </div>
            </Demo>
          </div>
        </Section>

        <Section n="Surfaces" title="Four steps of depth">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Swatch name="ground" role="The stage. Shows through every gap." className="bg-ground" />
            <Swatch name="panel" role="A floating region." className="bg-panel" />
            <Swatch name="raised" role="A control resting on a panel." className="bg-raised" />
            <Swatch name="well" role="Recessed: inputs, tracks, scrub areas." className="bg-well" />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Swatch
              name="glass"
              role="Over media only. 20px blur, 180% saturate, lit top edge."
              className="glass"
              over
            />
            <Swatch
              name="glass-strong"
              role="Glass carrying body copy. 40px blur, denser tint."
              className="glass-strong"
              over
            />
          </div>
        </Section>

        <Section n="Accent" title="Two colors, two authors">
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Cyan is the operator: export, render, play, confirm. Violet is the
            model: prompt, generate, suggest. A person should be able to tell who
            did a thing from across the room. Never mix them on one control.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="panel p-5">
              <Eyebrow>Signal — you</Eyebrow>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button variant="signal">Export</Button>
                <Button variant="signal" size="sm">Render</Button>
                <Button variant="outline">Cancel</Button>
              </div>
            </div>
            <div className="panel p-5">
              <Eyebrow>Synth — the model</Eyebrow>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button variant="synth">
                  <Sparkles /> Generate
                </Button>
                <Button variant="synth" size="sm">Extend clip</Button>
                <Button variant="ghost">Dismiss</Button>
              </div>
            </div>
          </div>
        </Section>

        <Section n="Numerals" title="Numbers that don't jitter">
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Timecode, duration and resolution are content in an editor, and they
            update while playing. Mark them{" "}
            <code className="rounded bg-well px-1.5 py-0.5 text-xs">data-numeric</code>{" "}
            and they take the mono face with tabular figures.
          </p>
          <div className="panel flex flex-wrap items-center gap-6 p-5 text-lg">
            <span data-numeric>01:38 / 01:40</span>
            <span data-numeric>3840×2160</span>
            <span data-numeric>23.976 fps</span>
            <span data-numeric>-14.0 LUFS</span>
          </div>
        </Section>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------- */

function Masthead() {
  return (
    <header className="mb-20">
      <Eyebrow>Context — design system</Eyebrow>
      <h1 className="mt-4 max-w-3xl text-5xl leading-[0.95] font-semibold tracking-tight md:text-6xl">
        A dark stage,
        <br />
        <span className="text-muted-foreground">lit only by the work.</span>
      </h1>
    </header>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-20">
      <div className="mb-5 flex items-baseline gap-3">
        <Eyebrow>{n}</Eyebrow>
        <h2 className="text-xl font-medium tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
      {children}
    </span>
  );
}

function Demo({
  label,
  verdict,
  children,
}: {
  label: string;
  verdict: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="panel p-3">
      {children}
      <figcaption className="flex items-center justify-between px-1 pt-3 pb-1">
        <span className="text-sm">{label}</span>
        <span className="text-xs text-muted-foreground">{verdict}</span>
      </figcaption>
    </figure>
  );
}

function Swatch({
  name,
  role,
  className,
  over = false,
}: {
  name: string;
  role: string;
  className: string;
  over?: boolean;
}) {
  return (
    <div className="panel overflow-hidden p-3">
      <div
        className="rounded-lg p-1"
        style={over ? { backgroundImage: FRAME } : undefined}
      >
        <div className={`h-16 rounded-lg ${className}`} />
      </div>
      <p className="mt-3 px-1 text-sm">{name}</p>
      <p className="mt-1 px-1 pb-1 text-xs leading-relaxed text-muted-foreground">
        {role}
      </p>
    </div>
  );
}

/* The shell, at reading size. Rail, panels, media plate, timeline. */
function Shell() {
  return (
    <div className="rounded-2xl bg-ground p-2">
      <div className="flex gap-2">
        <Rail />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <TopBar />
          <div className="flex min-w-0 gap-2">
            <StylePanel />
            <Stage />
            <PromptPanel />
          </div>
          <Timeline />
        </div>
      </div>
    </div>
  );
}

function Rail() {
  const items = [
    { icon: House, label: "Home" },
    { icon: Folder, label: "Projects" },
    { icon: Clapperboard, label: "Templates" },
    { icon: Star, label: "Starred" },
  ];
  return (
    <nav className="hidden w-20 shrink-0 flex-col items-center gap-1 py-3 sm:flex">
      <div className="mb-4 grid size-9 place-items-center rounded-xl bg-linear-to-b from-signal to-synth text-sm font-semibold text-signal-foreground">
        C
      </div>
      {items.map(({ icon: Icon, label }) => (
        <button
          key={label}
          className="flex w-full flex-col items-center gap-1 rounded-lg py-2 text-[10px] text-sidebar-foreground transition-colors hover:bg-panel hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
      <div className="mt-auto flex flex-col items-center gap-1">
        <button
          aria-label="Settings"
          className="grid size-9 place-items-center rounded-lg text-sidebar-foreground hover:bg-panel hover:text-foreground"
        >
          <Settings className="size-4" />
        </button>
        <button
          aria-label="Help"
          className="grid size-9 place-items-center rounded-lg text-sidebar-foreground hover:bg-panel hover:text-foreground"
        >
          <CircleHelp className="size-4" />
        </button>
      </div>
    </nav>
  );
}

function TopBar() {
  const tools = [
    { icon: Type, label: "Text" },
    { icon: Layers, label: "Layers" },
    { icon: Music, label: "Audio" },
    { icon: Sparkles, label: "Effects" },
  ];
  return (
    <div className="panel flex items-center gap-3 px-3 py-2">
      <span className="text-sm font-medium">First project</span>
      <ChevronDown className="size-4 text-muted-foreground" />
      <div className="mx-auto flex items-center gap-1">
        {tools.map(({ icon: Icon, label }) => (
          <button
            key={label}
            aria-label={label}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-raised hover:text-foreground"
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="Share">
        <Share2 />
      </Button>
      <Button variant="signal" size="sm">
        Export
      </Button>
    </div>
  );
}

function StylePanel() {
  const styles = ["Movie of the '90s", "Knitted world", "Realistic 3D", "Live sketch"];
  return (
    <div className="panel hidden w-52 shrink-0 flex-col gap-4 p-3 lg:flex">
      <div className="well flex items-center gap-2 px-3 py-2">
        <Search className="size-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Search</span>
      </div>
      <div>
        <Eyebrow>Style</Eyebrow>
        <ul className="mt-2 space-y-0.5">
          {styles.map((s, i) => (
            <li key={s}>
              <button
                className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                  i === 1
                    ? "bg-raised text-foreground"
                    : "text-muted-foreground hover:bg-raised/60 hover:text-foreground"
                }`}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* The media plate. Everything floating here is glass — this is the only
   place in the shell where that material appears. */
function Stage() {
  const overlayTools = [
    { icon: Clapperboard, label: "Scenes" },
    { icon: Mic, label: "Voice" },
    { icon: Music, label: "Music" },
    { icon: Type, label: "Captions" },
  ];
  return (
    <div
      className="relative aspect-video min-w-0 flex-1 overflow-hidden rounded-xl"
      style={{ backgroundImage: FRAME }}
    >
      <div className="absolute top-3 left-3 flex flex-col gap-2">
        {overlayTools.map(({ icon: Icon, label }, i) => (
          <button
            key={label}
            aria-label={label}
            aria-pressed={i === 0}
            className={`glass glass-interactive grid size-9 place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none ${
              i === 0 ? "bg-white/90 text-neutral-900" : ""
            }`}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>

      <div className="glass-strong absolute top-3 right-3 hidden w-56 rounded-2xl p-3 md:block">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5" />
          <span className="text-xs font-medium">Prompt</span>
          <X className="ml-auto size-3.5 opacity-70" />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-white/85">
          A diver suspended in a bloom of pink jellyfish, shafts of light from
          above, slow drift.
        </p>
        <div className="mt-3 flex items-center gap-1.5">
          <button aria-label="Add reference" className="glass glass-interactive grid size-7 place-items-center rounded-full">
            <Plus className="size-3.5" />
          </button>
          <button aria-label="Dictate" className="glass glass-interactive grid size-7 place-items-center rounded-full">
            <Mic className="size-3.5" />
          </button>
          <button
            aria-label="Send prompt"
            className="ml-auto grid size-7 place-items-center rounded-full bg-white text-neutral-900"
          >
            <Send className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="glass absolute right-3 bottom-3 left-3 flex items-center gap-3 rounded-full px-3 py-2">
        <Play className="size-4" />
        <span data-numeric className="text-[11px]">
          01:38 / 01:40
        </span>
        <div className="h-1 flex-1 rounded-full bg-white/25">
          <div className="h-full w-2/3 rounded-full bg-white" />
        </div>
        <Maximize2 className="size-3.5 opacity-80" />
      </div>
    </div>
  );
}

function PromptPanel() {
  return (
    <div className="panel hidden w-56 shrink-0 flex-col gap-4 p-3 xl:flex">
      <div className="well grid h-24 place-items-center px-3 py-2 text-xs text-muted-foreground">
        Type your script here…
      </div>
      <Button variant="synth" size="sm" className="w-full">
        <Sparkles /> Generate
      </Button>
      <div>
        <Eyebrow>Format</Eyebrow>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {["9:16", "3:4", "1:1", "4:3"].map((f, i) => (
            <button
              key={f}
              data-numeric
              aria-pressed={i === 3}
              className={`rounded-lg px-2 py-1.5 text-[11px] transition-colors ${
                i === 3
                  ? "bg-raised text-foreground ring-1 ring-signal/60"
                  : "bg-well text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Timeline() {
  const clips = [
    { w: "28%", g: "linear-gradient(120deg,oklch(0.7 0.11 200),oklch(0.6 0.09 250))" },
    { w: "34%", g: "linear-gradient(120deg,oklch(0.78 0.12 330),oklch(0.66 0.1 20))" },
    { w: "22%", g: "linear-gradient(120deg,oklch(0.72 0.1 160),oklch(0.6 0.09 210))" },
  ];
  return (
    <div className="panel p-3">
      <div className="mb-3 flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label="Undo">
          <Undo2 />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Redo">
          <Redo2 />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Split clip">
          <Scissors />
        </Button>
        <div className="mx-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Previous clip">
            <SkipBack />
          </Button>
          <Button variant="signal" size="icon-lg" aria-label="Play">
            <Play />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Next clip">
            <SkipForward />
          </Button>
        </div>
        <span data-numeric className="text-xs text-muted-foreground">
          00:01:40
        </span>
      </div>

      <div className="well space-y-1.5 p-2">
        <div className="flex items-center gap-2">
          <Clapperboard className="size-3.5 shrink-0 text-muted-foreground" />
          <div className="flex flex-1 gap-1">
            {clips.map((c) => (
              <div
                key={c.w}
                className="h-9 rounded-md ring-1 ring-white/10"
                style={{ width: c.w, backgroundImage: c.g }}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AudioLines className="size-3.5 shrink-0 text-muted-foreground" />
          <div className="h-7 flex-1 rounded-md bg-raised ring-1 ring-signal/25" />
        </div>
      </div>
    </div>
  );
}
