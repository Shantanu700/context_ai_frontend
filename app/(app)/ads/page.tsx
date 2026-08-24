"use client";

import { useMemo, useRef, useState } from "react";
import {
  ChevronDownIcon,
  Loader2,
  PlusIcon,
  SearchIcon,
  TriangleAlertIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";

import { AdGrid } from "@/components/ad-grid";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAds } from "@/hooks/use-ads";
import {
  IAB_CATEGORIES,
  adTypeFor,
  categoriesOf,
  createAd,
  replaceAdAsset,
  type AdResult,
} from "@/lib/ads";
import type { Ad, AdTypeEnum } from "@/lib/api";

const AD_TYPES: AdTypeEnum[] = ["video", "overlay"];
const FILTERS = ["all", "video", "overlay", "not embedded"] as const;

/** One predicate for both the grid and the count on each filter chip. */
function matchesFilter(ad: Ad, filter: (typeof FILTERS)[number]): boolean {
  if (filter === "all") return true;
  if (filter === "not embedded") return !ad.is_embedded;
  return ad.ad_type === filter;
}

export default function AdsPage() {
  const { ads, tones, count, refresh, remove, loadMore } = useAds();

  const [asset, setAsset] = useState<File | null>(null);
  const [adType, setAdType] = useState<AdTypeEnum>("video");
  const [categories, setCategories] = useState<string[]>([]);
  const [tone, setTone] = useState("");
  // Tones typed here but not yet saved — /tones only learns them on create.
  const [newTones, setNewTones] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [replacing, setReplacing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [query, setQuery] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const brands = useMemo(
    () => new Set((ads ?? []).map((ad) => ad.brand)).size,
    [ads],
  );

  /*
   * The chips to offer: the fixed IAB vocabulary, plus anything the catalog is
   * already using, plus whatever has been added by hand this session.
   *
   * ponytail: a custom category is inert for matching — `core/gemini.py` only
   * ever tags a scene from IAB_CATEGORIES, and `core/matching.py` boosts on the
   * intersection, so a value off that list can never overlap with a scene's.
   * It still reaches the embedding text. Give categories their own table and
   * endpoint if they need to be genuinely extensible.
   */
  const [added, setAdded] = useState<string[]>([]);
  const categoryOptions = useMemo(
    () => [
      ...new Set([
        ...IAB_CATEGORIES,
        ...(ads ?? []).flatMap(categoriesOf),
        ...added,
      ]),
    ],
    [ads, added],
  );

  const toneOptions = useMemo(
    () => [...new Set([...tones, ...newTones])].sort(),
    [tones, newTones],
  );

  /*
   * ponytail: search is over the pages already loaded, not the whole catalog —
   * PAGE_SIZE is 50, so it covers everything until someone catalogues more than
   * that. Give /ads a `search` query param when it stops.
   */
  const shown = useMemo(() => {
    if (ads === null) return null;
    const needle = query.trim().toLowerCase();
    return ads.filter(
      (ad) =>
        matchesFilter(ad, filter) &&
        (!needle ||
          [ad.brand, ad.title, ad.target_tone ?? "", ...categoriesOf(ad)]
            .join(" ")
            .toLowerCase()
            .includes(needle)),
    );
  }, [ads, filter, query]);

  function toggleCategory(value: string) {
    setCategories((current) =>
      current.includes(value)
        ? current.filter((c) => c !== value)
        : [...current, value],
    );
  }

  function chooseAsset(file: File | undefined) {
    if (!file) return;
    setAsset(file);
    setAdType(adTypeFor(file));
    setError(null);
  }

  function settle(result: AdResult): boolean {
    if (result.ok) {
      refresh();
      return true;
    }
    setError(result.message);
    return false;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const read = (name: string) => String(values.get(name) ?? "").trim();

    setPending(true);
    setError(null);
    const result = await createAd(
      {
        brand: read("brand"),
        title: read("title"),
        description: read("description"),
        ad_type: adType,
        iab_categories: categories,
        // The backend get_or_creates by name and lowercases; match that here so
        // the picker doesn't offer "Calm" and "calm" as two separate tones.
        target_tone: tone.trim().toLowerCase(),
      },
      asset,
    );
    setPending(false);

    if (settle(result)) {
      form.reset();
      setAsset(null);
      setCategories([]);
      setAdType("video");
      setTone("");
    }
  }

  async function onReplaceAsset(id: number, file: File) {
    setReplacing(id);
    setError(null);
    settle(await replaceAdAsset(id, file));
    setReplacing(null);
  }

  return (
    // Laptop: a fixed form column, the catalog scrolling beside it.
    // Narrow: form then catalog, in DOM order.
    <div className="grid min-w-0 flex-1 gap-2 lg:grid-cols-[24rem_minmax(0,1fr)]">
      <section className="panel flex flex-col overflow-y-auto p-4 lg:max-h-full">
        <h1 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          New creative
        </h1>

        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              chooseAsset(event.dataTransfer.files[0]);
            }}
            className={`well flex flex-col items-center justify-center gap-2 px-4 py-8 text-center transition-colors ${
              dragging ? "ring-1 ring-signal" : ""
            }`}
          >
            <UploadIcon className="size-5 text-muted-foreground" />
            <p className="text-sm">
              {asset ? asset.name : "Drop the ad video or overlay PNG"}
            </p>
            <p className="text-xs text-muted-foreground">
              Optional — an ad can be catalogued before its creative exists.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-1"
              disabled={pending}
              onClick={() => fileInput.current?.click()}
            >
              {asset ? "Choose another" : "Choose file"}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="video/*,image/*"
              hidden
              onChange={(event) => {
                chooseAsset(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>

          <Field label="Type">
            <Chips
              label="Type"
              options={AD_TYPES}
              selected={[adType]}
              disabled={pending}
              onToggle={(value) => setAdType(value as AdTypeEnum)}
            />
          </Field>

          <Field id="brand" label="Brand">
            <Input
              id="brand"
              name="brand"
              required
              maxLength={128}
              placeholder="Northwind Outdoors"
              disabled={pending}
              aria-describedby={error ? "ads-error" : undefined}
            />
          </Field>

          <Field id="title" label="Title">
            <Input
              id="title"
              name="title"
              required
              maxLength={256}
              placeholder="Trailhead 15s cutdown"
              disabled={pending}
              aria-describedby={error ? "ads-error" : undefined}
            />
          </Field>

          <Field id="description" label="Description">
            <textarea
              id="description"
              name="description"
              required
              rows={3}
              placeholder="What happens in the ad, and what it is selling."
              disabled={pending}
              aria-describedby={error ? "ads-error" : undefined}
              className="well resize-y px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50"
            />
          </Field>

          <Field label="IAB categories">
            <Picker
              label="IAB categories"
              placeholder="Choose categories"
              options={categoryOptions}
              selected={categories}
              disabled={pending}
              onToggle={toggleCategory}
              onAdd={(value) => {
                setAdded((current) =>
                  categoryOptions.includes(value) ? current : [...current, value],
                );
                if (!categories.includes(value)) toggleCategory(value);
              }}
            />
          </Field>

          <Field label="Target tone">
            <Picker
              label="Target tone"
              placeholder="Choose a tone"
              options={toneOptions}
              selected={tone ? [tone] : []}
              single
              disabled={pending}
              onToggle={(value) => setTone(value === tone ? "" : value)}
              onAdd={(value) => {
                setNewTones((current) => [...current, value]);
                setTone(value);
              }}
            />
          </Field>

          <Button type="submit" variant="signal" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <PlusIcon />}
            {pending ? "Adding…" : "Add to catalog & embed"}
          </Button>

          {error && (
            <p
              id="ads-error"
              role="alert"
              className="flex gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive"
            >
              <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <p className="text-xs leading-relaxed text-muted-foreground">
            Embedding runs in a worker; the creative becomes matchable shortly
            after it lands.
          </p>
        </form>
      </section>

      <section className="panel flex min-h-80 min-w-0 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Ad catalog
            </h2>
            <p data-numeric className="text-xs text-muted-foreground">
              <span className="text-foreground">{count}</span> creative
              {count === 1 ? "" : "s"}
              <span className="mx-1.5 opacity-40">/</span>
              <span className="text-foreground">{brands}</span> brand
              {brands === 1 ? "" : "s"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="relative min-w-40 flex-1 sm:max-w-64">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Search the catalog"
                placeholder="Search brand, title, tone"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Chips
              className="ml-auto"
              label="Filter the catalog"
              options={FILTERS}
              selected={[filter]}
              count={(option) =>
                (ads ?? []).filter((ad) =>
                  matchesFilter(ad, option as (typeof FILTERS)[number]),
                ).length
              }
              onToggle={(value) =>
                setFilter(value as (typeof FILTERS)[number])
              }
            />
          </div>
        </div>

        <AdGrid
          ads={shown}
          replacing={replacing}
          filtered={filter !== "all" || query.trim().length > 0}
          onRemove={remove}
          onReplaceAsset={onReplaceAsset}
        />

        {ads && ads.length < count && (
          <Button
            variant="secondary"
            size="sm"
            className="mx-auto"
            onClick={loadMore}
          >
            Load more
          </Button>
        )}
      </section>
    </div>
  );
}

/** A labelled row. Chip groups pass no `id` — they label themselves. */
function Field({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
}) {
  const className = "text-xs font-medium text-muted-foreground";
  return (
    <div className="flex flex-col gap-2">
      {id ? (
        <label htmlFor={id} className={className}>
          {label}
        </label>
      ) : (
        <p className={className}>{label}</p>
      )}
      {children}
    </div>
  );
}

/** Toggle chips — for the short, fixed sets (ad type, catalog filter). */
function Chips({
  label,
  options,
  selected,
  disabled,
  className,
  count,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  selected: readonly string[];
  disabled?: boolean;
  className?: string;
  /** How many rows the option would show — omitted where a chip picks a value. */
  count?: (option: string) => number;
  onToggle: (value: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex flex-wrap gap-1.5 ${className ?? ""}`}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={selected.includes(option)}
          disabled={disabled}
          onClick={() => onToggle(option)}
          className={`${CHIP} ${
            selected.includes(option)
              ? "bg-raised text-foreground ring-1 ring-signal"
              : "bg-raised/60 text-muted-foreground hover:bg-raised"
          }`}
        >
          {option}
          {count && (
            <span data-numeric className="ml-1.5 text-[11px] opacity-50">
              {count(option)}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

const CHIP =
  "cursor-pointer rounded-full px-2.5 py-1 text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50";

/**
 * A dropdown over a list that grows: checkboxes by default, radios when
 * `single`. Picked values stay visible as chips beneath the trigger, so a
 * multi-select doesn't hide what it holds behind a closed menu.
 *
 * The "add new" input sits outside the menu on purpose — base-ui runs typeahead
 * on an open popup, which would eat the keystrokes.
 */
function Picker({
  label,
  placeholder,
  options,
  selected,
  single,
  disabled,
  onToggle,
  onAdd,
}: {
  label: string;
  placeholder: string;
  options: readonly string[];
  selected: readonly string[];
  single?: boolean;
  disabled?: boolean;
  onToggle: (value: string) => void;
  onAdd: (value: string) => void;
}) {
  const [adding, setAdding] = useState(false);

  function commit(value: string) {
    const trimmed = value.trim();
    if (trimmed) onAdd(trimmed);
    setAdding(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="secondary"
                size="sm"
                disabled={disabled}
                aria-label={label}
                className="min-w-0 flex-1 justify-between rounded-lg font-normal"
              />
            }
          >
            <span
              className={`truncate ${selected.length ? "" : "text-muted-foreground"}`}
            >
              {single ? selected[0] || placeholder : placeholder}
              {!single && selected.length > 0 && ` · ${selected.length}`}
            </span>
            <ChevronDownIcon className="opacity-60" />
          </DropdownMenuTrigger>

          <DropdownMenuContent className="max-h-72">
            {options.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Nothing saved yet — use New.
              </p>
            )}
            {single ? (
              <DropdownMenuRadioGroup
                value={selected[0] ?? ""}
                onValueChange={(value) => onToggle(String(value))}
              >
                {options.map((option) => (
                  <DropdownMenuRadioItem key={option} value={option}>
                    {option}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            ) : (
              options.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option}
                  checked={selected.includes(option)}
                  onCheckedChange={() => onToggle(option)}
                  closeOnClick={false}
                >
                  {option}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {adding ? (
          <Input
            autoFocus
            aria-label={`New ${label}`}
            placeholder="Name it, then Enter"
            disabled={disabled}
            className="h-8 flex-1 text-xs"
            // Enter would otherwise submit the surrounding form.
            onKeyDown={(event) => {
              if (event.key === "Escape") setAdding(false);
              if (event.key !== "Enter") return;
              event.preventDefault();
              commit(event.currentTarget.value);
            }}
            onBlur={(event) => commit(event.currentTarget.value)}
          />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => setAdding(true)}
            className="rounded-lg text-muted-foreground"
          >
            <PlusIcon /> New
          </Button>
        )}
      </div>

      {!single && selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((value) => (
            <li key={value}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onToggle(value)}
                aria-label={`Remove ${value}`}
                className={`${CHIP} flex items-center gap-1 bg-raised text-foreground ring-1 ring-signal`}
              >
                {value}
                <XIcon className="size-3 opacity-60" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
