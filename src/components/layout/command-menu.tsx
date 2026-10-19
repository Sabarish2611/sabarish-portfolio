"use client";

import { Command, defaultFilter, useCommandState } from "cmdk";
import { useLenis } from "lenis/react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { projects } from "@/content/projects";
import { site } from "@/content/site";
import { WORDMARK } from "./logo";
import { useAccent, useTheme } from "@/hooks/use-preferences";
import { cn } from "@/lib/cn";
import { focusSection } from "@/lib/focus-section";
import { glideTo } from "@/lib/glide";
import { ACCENTS, setAccent, setTheme, THEMES, type Accent, type Theme } from "@/lib/preferences";
import { SECTIONS, type SectionId } from "@/lib/ui-events";
import { ACCENT_SWATCHES } from "./mobile-menu";

// Radix waits only for CSS animations (not transitions) before unmounting, so open/close are
// keyframes, scoped to cmdk's own attributes; React hoists this into <head> once.
const MOTION_CSS = `
@keyframes cmdk-fade-in{from{opacity:0}}
@keyframes cmdk-fade-out{to{opacity:0}}
@keyframes cmdk-pop-in{from{opacity:0;transform:translateY(-12px) scale(.97)}}
@keyframes cmdk-pop-out{to{opacity:0;transform:translateY(-6px) scale(.98)}}
[cmdk-overlay][data-state=open]{animation:cmdk-fade-in .3s cubic-bezier(.16,1,.3,1)}
[cmdk-overlay][data-state=closed]{animation:cmdk-fade-out .18s cubic-bezier(.7,0,.84,0) forwards}
[cmdk-dialog]{transform-origin:50% 0}
[cmdk-dialog][data-state=open]{animation:cmdk-pop-in .42s cubic-bezier(.16,1,.3,1)}
[cmdk-dialog][data-state=closed]{animation:cmdk-pop-out .18s cubic-bezier(.7,0,.84,0) forwards}
@media (prefers-reduced-motion:reduce){
[cmdk-dialog][data-state=open]{animation:cmdk-fade-in .16s linear}
[cmdk-dialog][data-state=closed]{animation:cmdk-fade-out .12s linear forwards}
}`;

const SECTION_LABELS: Partial<Record<SectionId, string>> = { work: "Selected work" };

const SECTION_KEYWORDS: Record<SectionId, string[]> = {
  about: ["bio", "introduction", "summary"],
  work: ["projects", "portfolio", "case studies"],
  experience: ["career", "roles", "timeline", "trellix"],
  toolkit: ["skills", "stack", "tools"],
  contact: ["hire", "reach out", "get in touch"],
};

const THEME_OPTIONS: Record<Theme, { label: string; icon: IconName; keywords: string[] }> = {
  dark: { label: "Dark theme", icon: "moon", keywords: ["mode", "appearance", "night"] },
  light: { label: "Light theme", icon: "sun", keywords: ["mode", "appearance", "day"] },
};

const TOAST_MS = 2400;
/** Lets typing settle before the result count is announced. */
const ANNOUNCE_DELAY_MS = 300;
const pad = (n: number) => String(n).padStart(2, "0");
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * command-score minus its long tail: below ~0.2 it is mostly letters scattered across keywords
 * ("theme" → "EDR threat detection"), so those survive only when every typed word really appears.
 */
function paletteFilter(value: string, search: string, keywords?: string[]) {
  const score = defaultFilter(value, search, keywords);
  if (score >= 0.2) return score;
  const haystack = normalize([value, ...(keywords ?? [])].join(" "));
  const words = normalize(search).split(/\s+/).filter(Boolean);
  return words.every((word) => haystack.includes(word)) ? score : 0;
}

const ICONS = {
  search: "M7.25 12.5a5.25 5.25 0 1 0 0-10.5 5.25 5.25 0 0 0 0 10.5ZM14 14l-3-3",
  top: "M8 13.5V3M3.5 7.5 8 3l4.5 4.5",
  section: "M3.5 2.5v6a2 2 0 0 0 2 2h7.5M10 7.5l3 3-3 3",
  project: "M9.25 1.75H4.5A1.5 1.5 0 0 0 3 3.25v9.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5V5.5L9.25 1.75Zm0 0V5.5H13M5.75 9h4.5M5.75 11.5h3",
  moon: "M13.6 9.9A6 6 0 0 1 6.1 2.4a6 6 0 1 0 7.5 7.5Z",
  sun: "M8 10.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5ZM8 1.25v1.5M8 13.25v1.5M3.23 3.23l1.06 1.06M11.71 11.71l1.06 1.06M1.25 8h1.5M13.25 8h1.5M3.23 12.77l1.06-1.06M11.71 4.29l1.06-1.06",
  copy: "M5.5 5.5h7.25v7.25H5.5zM10.5 5.5V3.25H3.25v7.25H5.5",
  external: "M5 11 11 5M5.75 5H11v5.25",
  download: "M8 2.25v8.5M4.5 7.25 8 10.75l3.5-3.5M2.75 13.75h10.5",
  check: "M3 8.5 6.5 12 13 4.5",
} as const;

type IconName = keyof typeof ICONS;

function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4 shrink-0", className)}
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

function Swatch({ hex }: { hex: string }) {
  return <span className="size-3.5 rounded-full ring-1 ring-black/15 ring-inset" style={{ backgroundColor: hex }} />;
}

function GroupHeading({ children }: { children: ReactNode }) {
  return <span className="eyebrow text-fg-muted">{children}</span>;
}

type PaletteItemProps = {
  value: string;
  keywords?: string[];
  icon: ReactNode;
  hint?: ReactNode;
  /** The active preference: check mark + "(current)" for screen readers. */
  current?: boolean;
  onSelect: () => void;
  children: ReactNode;
};

function PaletteItem({ value, keywords, icon, hint, current, onSelect, children }: PaletteItemProps) {
  return (
    <Command.Item
      value={value}
      keywords={keywords}
      onSelect={onSelect}
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9375rem] leading-snug text-fg select-none data-[selected=true]:bg-fg/[0.07]",
        // The tint alone is ~1.2:1; this accent-ink bar is the state mark (≥ 5:1 in every theme/accent).
        "before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-accent-ink before:opacity-0 data-[selected=true]:before:opacity-100",
      )}
    >
      <span
        data-icon
        className="grid size-5 shrink-0 place-items-center text-fg-muted transition-colors duration-200 group-data-[selected=true]:text-accent-ink"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint ? <span className="eyebrow shrink-0 text-fg-muted">{hint}</span> : null}
      {current ? (
        <>
          <Icon name="check" className="text-accent-ink" />
          <span className="sr-only">(current)</span>
        </>
      ) : null}
    </Command.Item>
  );
}

type PaletteEntry = Omit<PaletteItemProps, "children"> & { label: ReactNode };
type PaletteGroup = { id: string; heading: string; entries: PaletteEntry[] };

/** Best match first. Array sort is stable, so ties (and the empty query) keep the authored order. */
function rankGroups(groups: PaletteGroup[], search: string) {
  if (!search.trim()) return groups;
  const best = (group: PaletteGroup) =>
    Math.max(0, ...group.entries.map((entry) => paletteFilter(entry.value, search, entry.keywords)));
  return groups
    .map((group) => ({ group, score: best(group) }))
    .sort((a, b) => b.score - a.score)
    .map(({ group }) => group);
}

/**
 * cmdk 1.1 sorts items inside a group but never reorders the groups themselves, so a weak hit in
 * an early group would outrank (and be pre-selected over) the real answer further down. It also
 * leaves its last sort in the DOM when the query is cleared, hence the remount between modes.
 */
function RankedGroups({ groups }: { groups: PaletteGroup[] }) {
  const search = useCommandState((state) => state.search);
  const mode = search.trim() ? "results" : "browse";
  return rankGroups(groups, search).map((group) => (
    <Command.Group key={`${mode}:${group.id}`} value={group.id} heading={<GroupHeading>{group.heading}</GroupHeading>}>
      {group.entries.map(({ label, ...entry }) => (
        <PaletteItem key={entry.value} {...entry}>
          {label}
        </PaletteItem>
      ))}
    </Command.Group>
  ));
}

function EmptyState() {
  const search = useCommandState((state) => state.search);
  return (
    <Command.Empty className="px-4 py-12 text-center">
      <p className="text-fg">No results for “{search}”</p>
      <p className="mt-1 text-sm text-fg-muted">Try “work”, “theme”, or “email”.</p>
    </Command.Empty>
  );
}

/**
 * cmdk's Empty is role="presentation" and the listbox just goes quiet, so the outcome of a query is
 * spoken from here (inside the dialog: Radix aria-hides everything outside it).
 */
function ResultsStatus() {
  const search = useCommandState((state) => state.search.trim());
  const count = useCommandState((state) => state.filtered.count);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!search) setMessage("");
      else if (count === 0) setMessage(`No results for “${search}”`);
      else setMessage(`${count} ${count === 1 ? "result" : "results"}`);
    }, ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search, count]);

  return (
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </p>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-grid h-5 min-w-5 place-items-center rounded-[0.3rem] border border-line px-1 font-mono text-[0.6875rem] text-fg-muted">
      {children}
    </kbd>
  );
}

/** Keyboard hints: no use on touch screens, where the rows need the height more. */
function PaletteFooter() {
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-between gap-4 border-t border-line py-3 pr-4 pl-5 pointer-coarse:hidden"
    >
      <p className="eyebrow flex items-center gap-2 text-fg-muted">
        <span className="flex items-center gap-1.5 max-sm:hidden">
          <Kbd>↑↓</Kbd> navigate
        </span>
        <span className="max-sm:hidden">·</span>
        <span className="flex items-center gap-1.5">
          <Kbd>↵</Kbd> select
        </span>
        <span>·</span>
        <span className="flex items-center gap-1.5">
          <Kbd>esc</Kbd> close
        </span>
      </p>
      <p className="font-serif text-lg leading-none">
        {WORDMARK}
        <span className="text-accent-ink">.</span>
      </p>
    </div>
  );
}

function Toast({ message }: { message: string | null }) {
  return (
    <>
      <p role="status" className="sr-only">
        {message ?? ""}
      </p>
      <AnimatePresence>
        {message ? (
          <motion.div
            key="toast"
            aria-hidden
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", visualDuration: 0.35, bounce: 0.15 }}
            className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-(--z-dialog) mx-auto flex w-fit chamfer-fill items-center gap-2.5 py-2 pr-4 pl-2 text-bg drop-shadow-2xl [--cut:0.625rem] [--fill:var(--fg)]"
          >
            <span className="chamfer grid size-6 place-items-center bg-accent text-on-accent [--cut:0.375rem]">
              <Icon name="check" className="size-3.5" />
            </span>
            <span className="eyebrow">{message}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

/** Where the theme reveal grows from: the icon of the item that was just chosen. */
function selectedIconCenter() {
  const icon = document.querySelector("[cmdk-item][data-selected='true'] [data-icon]");
  if (!icon) return undefined;
  const rect = icon.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Hands focus back to whatever opened the palette, unless it is gone or focus already moved on. */
function restoreFocus(target: HTMLElement | null) {
  if (!target?.isConnected || target.closest("dialog:not([open]), [inert]")) return;
  if (document.activeElement && document.activeElement !== document.body) return;
  target.focus({ preventScroll: true });
}

type Pending = { action: () => void; movesFocus: boolean };

type CommandMenuProps = { open: boolean; onOpenChange: (open: boolean) => void };

/**
 * ⌘K / Ctrl+K palette: jump to sections and case studies, switch theme/accent, grab contact links.
 * Loaded on demand by <CommandMenuLauncher>, which owns the open state and the shortcut.
 */
export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const router = useRouter();
  const lenis = useLenis();
  const theme = useTheme();
  const accent = useAccent();
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<Pending | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open || !lenis) return;
    lenis.stop();
    return () => lenis.start();
  }, [open, lenis]);

  // cmdk renders no Dialog.Trigger, so on close Radix would drop focus on <body>. Note what had it
  // while that is still true: layout effects run before Radix moves focus into the dialog.
  useLayoutEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    returnFocus.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }, [open]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Deferred work runs once the palette has fully left the DOM (after its exit animation), so a
  // theme reveal or page transition never snapshots it mid-fade, and Lenis is running again.
  // Focus goes back to the opener, unless the action itself takes it somewhere else.
  const rootRef = useCallback((node: HTMLDivElement | null) => {
    if (node) return;
    const next = pending.current;
    pending.current = null;
    requestAnimationFrame(() => {
      if (!next?.movesFocus) restoreFocus(returnFocus.current);
      next?.action();
    });
  }, []);

  function afterClose(action: () => void, { movesFocus = false } = {}) {
    pending.current = { action, movesFocus };
    onOpenChange(false);
  }

  function showToast(message: string) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }

  /**
   * `null` = top of the home page. Same behaviour as <ScrollLink>: on "/" it glides and moves focus
   * to the section heading; elsewhere it navigates, and the home page lands focus on arrival.
   */
  function goTo(id: SectionId | null) {
    afterClose(
      () => {
        if (window.location.pathname !== "/") {
          router.push(id ? `/#${id}` : "/", { transitionTypes: ["nav-back"] });
          return;
        }
        const target = id ? document.getElementById(id) : 0;
        if (target === null) return;
        glideTo(lenis, target);
        focusSection(id ?? "hero");
        const { pathname, search } = window.location;
        window.history.replaceState(null, "", id ? `#${id}` : pathname + search);
      },
      { movesFocus: true },
    );
  }

  /** The case study moves focus to its own heading once it has arrived. */
  function openProject(slug: string) {
    afterClose(() => router.push(`/work/${slug}`, { transitionTypes: ["nav-forward"] }), { movesFocus: true });
  }

  function applyTheme(next: Theme) {
    const origin = selectedIconCenter();
    if (next === theme) onOpenChange(false);
    else afterClose(() => setTheme(next, origin));
  }

  function applyAccent(next: Accent) {
    const origin = selectedIconCenter();
    if (next === accent) onOpenChange(false);
    else afterClose(() => setAccent(next, origin));
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(site.email);
    } catch {
      onOpenChange(false);
      window.location.assign(`mailto:${site.email}`);
      return;
    }
    // Announced once the dialog is gone (Radix aria-hides everything else while it is open).
    afterClose(() => showToast("Email copied to clipboard"));
  }

  function openLinkedIn() {
    onOpenChange(false);
    window.open(site.links.linkedin, "_blank", "noopener,noreferrer");
  }

  function downloadResume() {
    onOpenChange(false);
    const link = document.createElement("a");
    link.href = site.links.resume;
    link.download = "";
    document.body.append(link);
    link.click();
    link.remove();
  }

  const groups: PaletteGroup[] = [
    {
      id: "navigate",
      heading: "Navigate",
      entries: [
        { value: "Home", label: "Home", keywords: ["top", "start", "intro"], icon: <Icon name="top" />, hint: "Top", onSelect: () => goTo(null) },
        ...SECTIONS.map((section, i) => {
          const label = SECTION_LABELS[section.id] ?? section.label;
          return {
            value: label,
            label,
            keywords: [section.id, "section", ...SECTION_KEYWORDS[section.id]],
            icon: <Icon name="section" />,
            hint: pad(i + 1),
            onSelect: () => goTo(section.id),
          };
        }),
      ],
    },
    {
      id: "case-studies",
      heading: "Case studies",
      entries: projects.map((project) => ({
        value: project.shortTitle,
        label: project.shortTitle,
        keywords: ["case study", "project", project.title, ...project.domains],
        icon: <Icon name="project" />,
        hint: project.index,
        onSelect: () => openProject(project.slug),
      })),
    },
    {
      id: "preferences",
      heading: "Preferences",
      entries: [
        ...THEMES.map((option) => ({
          value: THEME_OPTIONS[option].label,
          label: THEME_OPTIONS[option].label,
          keywords: THEME_OPTIONS[option].keywords,
          icon: <Icon name={THEME_OPTIONS[option].icon} />,
          current: option === theme,
          onSelect: () => applyTheme(option),
        })),
        ...ACCENTS.map((option) => ({
          value: `Accent: ${ACCENT_SWATCHES[option].label}`,
          label: `Accent: ${ACCENT_SWATCHES[option].label}`,
          keywords: ["colour", "color"],
          icon: <Swatch hex={ACCENT_SWATCHES[option].hex} />,
          current: option === accent,
          onSelect: () => applyAccent(option),
        })),
      ],
    },
    {
      id: "links",
      heading: "Links",
      entries: [
        {
          value: "Copy email",
          label: "Copy email",
          keywords: ["mail", "contact", "address", site.email],
          icon: <Icon name="copy" />,
          hint: <span className="tracking-normal normal-case max-sm:hidden">{site.email}</span>,
          onSelect: copyEmail,
        },
        { value: "LinkedIn", label: "LinkedIn", keywords: ["social", "profile", "connect"], icon: <Icon name="external" />, hint: "New tab", onSelect: openLinkedIn },
        { value: "Download résumé", label: "Download résumé", keywords: ["resume", "cv", "pdf"], icon: <Icon name="download" />, hint: "PDF", onSelect: downloadResume },
      ],
    },
  ];

  return (
    <>
      <style href="command-menu-motion" precedence="default">
        {MOTION_CSS}
      </style>
      <Command.Dialog
        ref={rootRef}
        open={open}
        onOpenChange={onOpenChange}
        label="Command menu"
        loop
        vimBindings={false}
        filter={paletteFilter}
        overlayClassName="fixed inset-0 z-(--z-dialog) bg-bg/60 backdrop-blur-sm"
        contentClassName="chamfer fixed inset-x-0 top-[14dvh] z-(--z-dialog) mx-auto w-[min(640px,92vw)] overflow-hidden bg-bg-elevated text-fg outline-none [--cut:1.25rem]"
        // Never taller than the space below its top offset (landscape phones): the list gives way.
        className="flex max-h-[calc(86dvh-1rem)] flex-col outline-none [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group][hidden]]:hidden [&_[cmdk-group]+[cmdk-group]]:mt-1.5"
      >
        <span aria-hidden className="chamfer-ring pointer-events-none absolute inset-0 z-10 bg-line-strong" />
        <div className="flex shrink-0 items-center gap-3 border-b border-line pr-3 pl-5">
          <Icon name="search" className="size-[1.125rem] text-fg-muted" />
          <Command.Input
            placeholder="Search or jump to…"
            className="h-16 min-w-0 flex-1 bg-transparent text-lg text-fg outline-none placeholder:text-fg-muted"
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            // Enter would otherwise also reach cmdk, which runs the highlighted command.
            onKeyDown={(event) => {
              if (event.key === "Enter") event.stopPropagation();
            }}
            aria-label="Esc, close command menu"
            className="eyebrow grid h-10 min-w-10 chamfer-outline place-items-center px-2.5 text-fg-muted transition-colors duration-300 [--cut:0.375rem] [--outline:var(--line)] hover:text-fg hover:[--outline:var(--line-strong)]"
          >
            esc
          </button>
        </div>

        <Command.List
          data-lenis-prevent
          className="max-h-[min(56dvh,460px)] min-h-0 flex-1 scroll-py-2 overflow-y-auto overscroll-contain p-2"
        >
          <EmptyState />
          <RankedGroups groups={groups} />
        </Command.List>
        <ResultsStatus />

        <PaletteFooter />
      </Command.Dialog>

      <Toast message={toast} />
    </>
  );
}
