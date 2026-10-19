"use client";

import { useRef, type CSSProperties } from "react";
import { mulberry32 } from "@/components/seo/prng";
import { TOOL_ICONS, type ToolIconSlug } from "@/content/tool-icons";
import { cn } from "@/lib/cn";
import { EASE, gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { onIntroReveal } from "@/lib/intro";
import { readPaused, subscribePaused } from "@/lib/motion-pause";

/**
 * The hero's toolkit drawn as an embedding plot: the tools start as scattered noise and settle
 * into clusters (the way a t-SNE run converges), then a detection box locks onto the modeling
 * cluster — signal from noise. Left alone, a probe scans the plot once, locking onto one tool per
 * cluster; typing "signal" anywhere lights every tool up. Tools without a free brand mark show a short mono
 * code instead. Everything named here is on the résumé (site.ts skill groups).
 *
 * Decorative (aria-hidden): the Toolkit section lists the same tools as text.
 */

type Tool = { name: string; icon?: ToolIconSlug; code?: string };
type Cluster = {
  id: string;
  label: string;
  /** Cluster centre in % of the plot: desktop, then phones (a 2×2 grid). */
  at: readonly [number, number];
  atMobile: readonly [number, number];
  signal?: boolean;
  tools: readonly Tool[];
};

const CLUSTERS: readonly Cluster[] = [
  {
    id: "languages",
    label: "Languages & tools",
    at: [11, 40],
    atMobile: [24, 22],
    tools: [
      { name: "Python", icon: "python" },
      { name: "SQL", code: "SQL" },
      { name: "MySQL", icon: "mysql" },
      { name: "Bash", icon: "gnubash" },
      { name: "Git", icon: "git" },
      { name: "GitHub", icon: "github" },
      { name: "Plotly", icon: "plotly" },
    ],
  },
  {
    id: "data",
    label: "Big data",
    at: [35, 62],
    atMobile: [76, 22],
    tools: [
      { name: "PySpark", icon: "apachespark" },
      { name: "Apache Arrow", icon: "apachearrow" },
      { name: "GCS", icon: "googlecloudstorage" },
      { name: "AWS EMR", code: "EMR" },
      { name: "Athena", code: "ATH" },
    ],
  },
  {
    id: "cloud",
    label: "Cloud & MLOps",
    at: [60, 34],
    atMobile: [24, 70],
    tools: [
      { name: "Google Cloud", icon: "googlecloud" },
      { name: "BigQuery", icon: "googlebigquery" },
      { name: "Vertex AI Pipelines", code: "VTX" },
      { name: "Kubeflow Pipelines", code: "KFP" },
      { name: "Terraform", icon: "terraform" },
      { name: "Docker", icon: "docker" },
      { name: "AWS SageMaker", code: "AWS" },
    ],
  },
  {
    id: "models",
    label: "Modeling",
    signal: true,
    at: [85, 58],
    atMobile: [76, 70],
    tools: [
      { name: "PyTorch", icon: "pytorch" },
      { name: "scikit-learn", icon: "scikitlearn" },
      { name: "XGBoost", code: "XGB" },
      { name: "LightGBM", code: "LGBM" },
      { name: "SHAP", code: "SHAP" },
    ],
  },
];

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Sunflower spiral: evenly packed, never overlapping. Offsets in units of --spread. */
function spiral(count: number) {
  return Array.from({ length: count }, (_, k) => {
    const r = Math.sqrt(k + 0.5);
    return { dx: r * Math.cos(k * GOLDEN_ANGLE), dy: r * Math.sin(k * GOLDEN_ANGLE) };
  });
}

// Everything random is seeded at module scope: identical on the server, the client and every build.
const rand = mulberry32(20230701);
const LAYOUT = CLUSTERS.map((cluster) => {
  const points = spiral(cluster.tools.length);
  const xs = points.map((p) => p.dx);
  const ys = points.map((p) => p.dy);
  return {
    ...cluster,
    points,
    box: { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) },
    // Where each tool starts: a random spot anywhere in the plot (the noise it converges out of).
    origins: points.map(() => ({ x: rand(), y: rand() })),
    drift: points.map(() => ({ x: (rand() - 0.5) * 8, y: (rand() - 0.5) * 8, duration: 3 + rand() * 2.5 })),
  };
});
const NOISE = Array.from({ length: 70 }, () => ({
  x: rand() * 100,
  y: rand() * 100,
  size: 1.5 + rand() * 1.75,
  opacity: 0.2 + rand() * 0.4,
}));

/** Idle scan: one lock per cluster, each held this long (s), so a pass stays under WCAG 2.2.2's 5s. */
const SCAN_HOLD = 1.1;

/** Half a node plus breathing room (--pad), for the detection box and the cluster labels. */
const PAD = "var(--pad)";

type Vars = CSSProperties & Record<`--${string}`, string>;

export function ToolkitMap({ className }: { className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const plot = root.current;
      if (!plot) return;
      const q = gsap.utils.selector(plot);
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const nodes = (q("[data-map-node]") as HTMLElement[]);
        const movers = (q("[data-map-mover]") as HTMLElement[]);
        const labels = (q("[data-map-label]") as HTMLElement[]);
        const lock = (q("[data-map-lock]") as HTMLElement[]);

        // Converge from noise: each tool starts at its seeded random spot anywhere in the plot.
        const box = plot.getBoundingClientRect();
        const starts = nodes.map((node) => {
          const { cluster, index } = node.dataset;
          const origin = LAYOUT[Number(cluster)].origins[Number(index)];
          const r = node.getBoundingClientRect();
          return {
            x: origin.x * box.width - (r.left + r.width / 2 - box.left),
            y: origin.y * box.height - (r.top + r.height / 2 - box.top),
          };
        });
        gsap.set(movers, { x: (i) => starts[i].x, y: (i) => starts[i].y, scale: 0.6, autoAlpha: 0 });
        gsap.set(q("[data-map-noise]"), { autoAlpha: 0 });
        gsap.set(lock, { autoAlpha: 0, scale: 1.18 });
        const texts = labels.map((label) => label.textContent ?? "");
        gsap.set(labels, { autoAlpha: 0 });
        gsap.set(plot, { autoAlpha: 1 });

        // Idle scan: with nobody pointing at the plot, a probe locks onto one tool in each cluster in
        // turn, then rests, so the plot comes alive on touch screens and for anyone reading. One pass
        // per quiet spell (after the intro, scrolling back, the pointer leaving), never a loop.
        const order: number[] = [];
        const byCluster = LAYOUT.map((cluster, c) =>
          cluster.tools.map((_, t) => nodes.findIndex((n) => n.dataset.cluster === String(c) && n.dataset.index === String(t))),
        );
        for (let k = 0; k < Math.max(...byCluster.map((list) => list.length)); k++) {
          byCluster.forEach((list) => (k < list.length ? order.push(list[k]) : undefined));
        }
        let introDone = false;
        let visible = false;
        let idle = true;
        let paused = readPaused(); // the shared pause choice (lib/motion-pause.ts)
        let left = 0; // locks left in this pass
        let step = 0;
        let current: HTMLElement | null = null;
        let pending: gsap.core.Tween | null = null;
        let idleTimer: gsap.core.Tween | null = null;
        const clearScan = () => {
          if (current) delete current.dataset.scanned;
          current = null;
        };
        const scan = () => {
          clearScan();
          if (left-- <= 0) return;
          current = nodes[order[step++ % order.length]];
          current.dataset.scanned = "true";
          pending = gsap.delayedCall(SCAN_HOLD, scan);
        };
        const syncScan = () => {
          pending?.kill();
          pending = null;
          clearScan();
          if (!introDone || !idle || !visible || paused) return;
          left = LAYOUT.length;
          pending = gsap.delayedCall(0.8, scan);
        };

        const drift: gsap.core.Tween[] = [];
        const syncDrift = () => drift.forEach((tween) => tween.paused(paused || !visible));
        const intro = gsap
          .timeline({ paused: true, defaults: { ease: EASE.out } })
          .to(q("[data-map-noise]"), { autoAlpha: 1, duration: 0.6, stagger: { each: 0.008, from: "random" } }, 0)
          .to(movers, { autoAlpha: 1, scale: 1, duration: 0.4, stagger: { each: 0.02, from: "random" } }, 0.1)
          .to(movers, { x: 0, y: 0, duration: 1.7, ease: EASE.inOut, stagger: { each: 0.025, from: "random" } }, 0.35)
          .add(() => {
            // The cluster names decode in, like a classifier labelling what it found.
            labels.forEach((label, i) => {
              gsap.set(label, { autoAlpha: 1 });
              gsap.fromTo(
                label,
                { scrambleText: { text: " ", chars: "01" } },
                { duration: 0.9, delay: i * 0.08, scrambleText: { text: texts[i], chars: "upperCase", speed: 0.5 } },
              );
            });
          }, 1.7)
          .to(lock, { autoAlpha: 1, scale: 1, duration: 0.55, ease: EASE.out }, 2.2)
          .add(() => {
            introDone = true;
            syncScan();
            // At rest the points breathe a little; paused off screen and when motion is paused.
            movers.forEach((mover, i) => {
              const { cluster, index } = nodes[i].dataset;
              const d = LAYOUT[Number(cluster)].drift[Number(index)];
              drift.push(
                gsap.to(mover, { x: d.x, y: d.y, duration: d.duration, ease: "sine.inOut", yoyo: true, repeat: -1 }),
              );
            });
            syncDrift();
          });

        const visibility = ScrollTrigger.create({
          trigger: plot,
          start: "top bottom",
          end: "bottom top",
          onToggle: (self) => {
            visible = self.isActive;
            syncDrift();
            syncScan();
          },
        });

        const stopPause = subscribePaused(() => {
          paused = readPaused();
          syncDrift();
          syncScan();
        });

        // Easter egg: type "signal" (outside a text field) and every tool lights up as detected.
        let typed = "";
        let foundTimers: gsap.core.Tween[] = [];
        const found = () => {
          if (!visible || !introDone) return;
          pending?.kill();
          clearScan();
          foundTimers.forEach((timer) => timer.kill());
          gsap.fromTo(lock, { scale: 1 }, { scale: 1.08, duration: 0.22, yoyo: true, repeat: 3, ease: "power2.inOut" });
          foundTimers = nodes.map((node, i) => gsap.delayedCall(i * 0.035, () => (node.dataset.found = "true")));
          foundTimers.push(
            gsap.delayedCall(3.8, () => {
              nodes.forEach((node) => delete node.dataset.found);
              syncScan();
            }),
          );
        };
        const onKey = (event: KeyboardEvent) => {
          if (event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) return;
          if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable]")) return;
          typed = (typed + event.key.toLowerCase()).slice(-6);
          if (typed === "signal") {
            typed = "";
            found();
          }
        };
        window.addEventListener("keydown", onKey);

        const stopReveal = onIntroReveal(() => intro.play());

        // Fine pointers: the points lean away from the cursor, as if it were a probe in the space.
        const cleanups: (() => void)[] = [];
        if (window.matchMedia("(pointer: fine)").matches) {
          const pushers = (q("[data-map-push]") as HTMLElement[]).map((el) => ({
            el,
            x: gsap.quickTo(el, "x", { duration: 0.6, ease: "power3.out" }),
            y: gsap.quickTo(el, "y", { duration: 0.6, ease: "power3.out" }),
          }));
          const RADIUS = 130;
          const PUSH = 22;
          // Rest centres relative to the plot, measured once (and on resize/refresh), never per move:
          // reading 24 rects on every pointer event would force a layout each time. The drift is a
          // few px, small enough to ignore here.
          let centres: { x: number; y: number }[] = [];
          const measure = () => {
            const box = plot.getBoundingClientRect();
            centres = (q("[data-map-node]") as HTMLElement[]).map((node) => {
              const r = node.getBoundingClientRect();
              return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
            });
          };
          measure();
          ScrollTrigger.addEventListener("refresh", measure);
          // One update per frame at most, from the latest pointer position.
          let pointer: { x: number; y: number } | null = null;
          const update = () => {
            if (!pointer) return;
            const { x: px, y: py } = pointer;
            pointer = null;
            pushers.forEach((p, i) => {
              const dx = centres[i].x - px;
              const dy = centres[i].y - py;
              const distance = Math.hypot(dx, dy);
              const force = distance < RADIUS ? (1 - distance / RADIUS) ** 2 * PUSH : 0;
              p.x(distance ? (dx / distance) * force : 0);
              p.y(distance ? (dy / distance) * force : 0);
            });
          };
          gsap.ticker.add(update);
          // Pointing at the plot hands it over to hover; the scan resumes after a quiet spell.
          const resumeAfter = (seconds: number) => {
            idleTimer?.kill();
            idleTimer = gsap.delayedCall(seconds, () => {
              idle = true;
              syncScan();
            });
          };
          const onMove = (event: PointerEvent) => {
            const box = plot.getBoundingClientRect();
            pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
            if (idle) {
              idle = false;
              syncScan();
            }
            resumeAfter(2.5);
          };
          const onLeave = () => {
            pointer = null;
            pushers.forEach((p) => (p.x(0), p.y(0)));
            resumeAfter(1.2);
          };
          plot.addEventListener("pointermove", onMove);
          plot.addEventListener("pointerleave", onLeave);
          cleanups.push(() => {
            plot.removeEventListener("pointermove", onMove);
            plot.removeEventListener("pointerleave", onLeave);
            ScrollTrigger.removeEventListener("refresh", measure);
            gsap.ticker.remove(update);
          });
        }

        return () => {
          window.removeEventListener("keydown", onKey);
          stopPause();
          pending?.kill();
          idleTimer?.kill();
          foundTimers.forEach((timer) => timer.kill());
          clearScan();
          nodes.forEach((node) => delete node.dataset.found);
          stopReveal();
          visibility.kill();
          drift.forEach((tween) => tween.kill());
          cleanups.forEach((cleanup) => cleanup());
        };
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(plot, { autoAlpha: 1 });
      });
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      aria-hidden
      data-reveal=""
      className={cn("[--pad:1.125rem] [--spread:1.25rem] md:[--pad:1.5rem] md:[--spread:2.375rem]", className ?? "relative")}
    >
      {NOISE.map((dot, i) => (
        <span
          key={i}
          data-map-noise
          className="absolute rounded-full bg-fg-subtle"
          style={{ left: `${dot.x}%`, top: `${dot.y}%`, width: dot.size, height: dot.size, opacity: dot.opacity }}
        />
      ))}

      {LAYOUT.map((cluster, c) => (
        <div
          key={cluster.id}
          className="absolute top-(--cy-m) left-(--cx-m) md:top-(--cy) md:left-(--cx)"
          style={
            {
              "--cx": `${cluster.at[0]}%`,
              "--cy": `${cluster.at[1]}%`,
              "--cx-m": `${cluster.atMobile[0]}%`,
              "--cy-m": `${cluster.atMobile[1]}%`,
            } as Vars
          }
        >
          {cluster.signal ? (
            <div
              data-map-lock
              className="pointer-events-none absolute"
              style={{
                left: `calc(var(--spread) * ${cluster.box.left} - ${PAD})`,
                top: `calc(var(--spread) * ${cluster.box.top} - ${PAD})`,
                width: `calc(var(--spread) * ${cluster.box.right - cluster.box.left} + 2 * ${PAD})`,
                height: `calc(var(--spread) * ${cluster.box.bottom - cluster.box.top} + 2 * ${PAD})`,
              }}
            >
              <span className="detect-brackets absolute inset-0 text-accent-ink" />
              <span className="absolute -top-5 left-0 bg-accent px-1.5 py-0.5 font-mono text-[0.625rem] leading-none tracking-[0.08em] text-on-accent uppercase">
                Signal
              </span>
            </div>
          ) : null}

          {cluster.tools.map((tool, i) => {
            const point = cluster.points[i];
            return (
              <div
                key={tool.name}
                data-map-node
                data-cluster={c}
                data-index={i}
                // Hovered or scanned, a point rises above its neighbours, so its name isn't painted under them.
                className="group absolute -translate-x-1/2 -translate-y-1/2 hover:z-10 data-[scanned=true]:z-10"
                style={{ left: `calc(var(--spread) * ${point.dx})`, top: `calc(var(--spread) * ${point.dy})` }}
              >
                <div data-map-mover>
                  <div
                    data-map-push
                    className={cn(
                      "relative grid size-5 place-items-center transition-colors duration-300 md:size-[30px]",
                      cluster.signal
                        ? "text-accent-ink"
                        : "text-fg-muted group-hover:text-fg group-data-[scanned=true]:text-fg group-data-[found=true]:text-accent-ink",
                    )}
                  >
                    {tool.icon ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="size-full">
                        <path d={TOOL_ICONS[tool.icon].path} />
                      </svg>
                    ) : (
                      <span className="font-mono text-[0.5625rem] leading-none font-medium tracking-[0.04em] md:text-[0.6875rem]">
                        {tool.code}
                      </span>
                    )}
                    {/* Hover: a small detection box locks on and names the point. */}
                    <span className="detect-brackets pointer-events-none absolute -inset-2 scale-125 text-fg opacity-0 transition-[opacity,scale] duration-300 ease-out group-hover:scale-100 group-hover:opacity-100 group-data-[found=true]:scale-100 group-data-[found=true]:text-accent-ink group-data-[found=true]:opacity-100 group-data-[scanned=true]:scale-100 group-data-[scanned=true]:opacity-100" />
                    <span className="pointer-events-none absolute top-full left-1/2 mt-2.5 -translate-x-1/2 bg-bg px-1 py-0.5 font-mono text-[0.625rem] leading-none tracking-[0.08em] whitespace-nowrap text-fg uppercase opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-data-[scanned=true]:opacity-100">
                      {tool.name}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          <p
            data-map-label
            className="absolute -translate-x-1/2 font-mono text-[0.625rem] tracking-[0.08em] whitespace-nowrap text-fg-subtle uppercase md:text-label"
            style={{ top: `calc(var(--spread) * ${cluster.box.bottom} + ${PAD} + 0.25rem)` }}
          >
            {cluster.label}
          </p>
        </div>
      ))}
    </div>
  );
}
