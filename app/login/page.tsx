"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Play, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_URL, basicAuth, loginCreate } from "@/lib/api";

/** Scene blocks as the pipeline segments them. Widths are shares of the clip. */
const SCENES = [
  { label: "01", width: "22%", tone: "bg-white/22" },
  { label: "02", width: "31%", tone: "bg-white/22" },
  { label: "03", width: "26%", tone: "bg-white/35" },
  { label: "04", width: "21%", tone: "bg-white/22" },
];

/** Deterministic — a random waveform would mismatch between server and client. */
const WAVEFORM = Array.from({ length: 72 }, (_, i) =>
  Math.round(24 + Math.abs(Math.sin(i * 1.7)) * 68),
);

const PLAYHEAD = "57%";

/**
 * Decorative editor timeline. It sits on the media plate, so by the system's
 * one rule it is glass — the only glass in this view.
 */
function Timeline() {
  return (
    <div className="glass absolute right-3 bottom-3 left-3 rounded-2xl p-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="glass grid size-7 shrink-0 place-items-center rounded-full"
        >
          <Play className="size-3" />
        </span>
        <span data-numeric className="text-[11px]">
          00:41 / 01:12
        </span>
        <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[10px]">
          4 scenes matched
        </span>
      </div>

      <div
        data-numeric
        className="mt-3 flex justify-between text-[9px] opacity-70"
      >
        {["0s", "15s", "30s", "45s", "60s"].map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>

      <div className="relative mt-1.5">
        <div className="flex gap-1">
          {SCENES.map((scene) => (
            <div
              key={scene.label}
              style={{ width: scene.width }}
              className={`flex h-8 items-center justify-center rounded-md text-[9px] tracking-wide ${scene.tone}`}
            >
              {scene.label}
            </div>
          ))}
        </div>

        <div className="mt-1 flex h-5 items-center justify-between overflow-hidden rounded-md bg-white/10 px-1.5">
          {WAVEFORM.map((height, i) => (
            <span
              key={i}
              style={{ height: `${height}%` }}
              className="w-px shrink-0 bg-white/55"
            />
          ))}
        </div>

        <div
          style={{ left: PLAYHEAD }}
          className="pointer-events-none absolute -top-1 bottom-0 w-px bg-white"
        >
          <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");

    setPending(true);
    setError(null);

    // Deliberately a browser fetch, not a server action: the API answers with
    // a Set-Cookie the *browser* has to keep. Run this on the server and the
    // session lands on the Next process instead of the person signing in.
    const { response } = await loginCreate({
      headers: { Authorization: basicAuth(username, password) },
    });

    if (response?.ok) {
      router.push("/projects");
      router.refresh();
      return;
    }

    setPending(false);
    if (!response) {
      // No response at all — DNS, a dead server, or an unaccepted certificate.
      setError(
        `Can't reach the API at ${API_URL}. If it's serving a self-signed certificate, open ${API_URL}/health in a tab and accept the warning, then try again.`,
      );
    } else if (response.status === 401) {
      setError("That username and password don't match an account.");
    } else {
      setError(`Sign-in failed with status ${response.status}. Try again.`);
    }
  }

  return (
    <main className="stage-ambient grid min-h-screen place-items-center p-4">
      <div className="panel grid w-full max-w-4xl gap-2 overflow-hidden p-2 md:grid-cols-2">
        {/* Media plate — the one surface in this view that earns glass. */}
        <div className="relative hidden min-h-[26rem] overflow-hidden rounded-xl md:block">
          <Image
            src="/sign_in.webp"
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 448px, 100vw"
            className="object-cover"
          />
          {/* The illustration is bright at the waterline. This scrim buys the
              timeline its contrast without darkening the whole picture. */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-ground/85 via-ground/40 to-transparent" />
          <Timeline />
        </div>

        {/* Form side — solid, because there is no media under it. */}
        <div className="flex flex-col justify-center px-6 py-10 sm:px-10">
          <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Context
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Scene-level ad matching for your video library.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="block text-xs font-medium text-muted-foreground"
              >
                Username
              </label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                autoFocus
                required
                disabled={pending}
                aria-invalid={error ? true : undefined}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-muted-foreground"
              >
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={pending}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "signin-error" : undefined}
              />
            </div>

            {error && (
              <p
                id="signin-error"
                role="alert"
                className="flex gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive"
              >
                <ShieldAlert className="mt-px size-3.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <Button
              type="submit"
              variant="signal"
              size="lg"
              disabled={pending}
              className="w-full"
            >
              {pending && <Loader2 className="animate-spin" />}
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
