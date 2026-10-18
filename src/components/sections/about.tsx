"use client";

import { useRef } from "react";
import { Marquee, MarqueeGroup } from "@/components/ui/marquee";
import { RevealText } from "@/components/ui/reveal-text";
import { SectionHeader } from "@/components/ui/section-header";
import { site, skillGroups } from "@/content/site";
import { cn } from "@/lib/cn";
import { DURATION, EASE, gsap, useGSAP } from "@/lib/gsap";

// The no-break space keeps the dash on the name's line.
const STATEMENT = `I’m ${site.shortName}\u00A0— a data scientist at ${site.company}. I design machine-learning systems for endpoint security: models that replace manually managed detection rules, a pipeline that retrains a malware classifier every day, and alert scoring that cut false positives from 70% to 30%.`;

const PRINCIPLES = [
  {
    title: "Start from the data",
    body: "Reconcile conflicting labels, split by time to avoid leakage, and engineer features that capture behavior — before touching the model.",
  },
  {
    title: "Ship to production",
    body: "Pipelines on Vertex AI and Kubeflow, models on SageMaker, infrastructure in Terraform, scheduled retrains. A model only matters while it keeps running.",
  },
  {
    title: "Make it explainable",
    body: "SHAP to validate what a model learned; LLM-generated insights mapped to MITRE ATT&CK so analysts can act on a detection.",
  },
] as const;

/** One list per row from the named skill groups; each skill appears once overall ("AWS EMR" = "EMR"). */
function skillRows(rows: readonly (readonly string[])[]) {
  const seen = new Set<string>();
  return rows.map((labels) =>
    labels
      .flatMap((label) => skillGroups.find((group) => group.label === label)?.items ?? [])
      .filter((skill) => {
        const key = skill.toLowerCase().replace(/^aws\s+/, "");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
  );
}

const [PRIMARY_SKILLS, PLATFORM_SKILLS] = skillRows([
  ["Machine learning & AI", "Languages & tools"],
  ["Cloud & MLOps", "Big data", "Statistics & analysis"],
]);

export function About() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = root.current;
      if (!section) return;
      const principles = section.querySelector<HTMLElement>("[data-about-principles]");
      const items = section.querySelectorAll<HTMLElement>("[data-about-principle]");
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (principles) {
          gsap
            .timeline({
              defaults: { ease: EASE.out },
              scrollTrigger: { trigger: principles, start: "top 82%", once: true },
            })
            .from(principles.querySelectorAll("[data-rule-x]"), { scaleX: 0, duration: DURATION.slower, stagger: 0.12 }, 0)
            .from(principles.querySelectorAll("[data-rule-y]"), { scaleY: 0, duration: DURATION.slower, stagger: 0.12 }, 0.2)
            .from(items, { autoAlpha: 0, duration: 0.3, stagger: 0.08 }, 0.15);
        }
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(items, { autoAlpha: 1 });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="about" aria-labelledby="about-title" className="section-pad">
      <div className="container-page">
        <SectionHeader
          index="01"
          label="About"
          headingId="about-title"
          heading={
            <>
              Signal from <span className="italic">noise.</span>
            </>
          }
        />

        <div className="grid grid-cols-12 gap-x-6">
          <RevealText className="col-span-12 font-serif text-statement text-fg md:col-span-10 md:col-start-3 lg:col-span-8 lg:col-start-5">
            {STATEMENT}
          </RevealText>
        </div>

        <div data-about-principles className="mt-[clamp(5rem,2.5rem+9vw,12rem)]">
          <p id="about-principles-label" className="eyebrow mb-6 text-fg-muted">
            How I work
          </p>
          <div className="relative">
            <span aria-hidden data-rule-x className="absolute inset-x-0 top-0 hidden h-px origin-left bg-line lg:block" />
            <ol role="list" aria-labelledby="about-principles-label" className="grid lg:grid-cols-3 lg:gap-x-6">
              {PRINCIPLES.map((principle, index) => (
                <li key={principle.title} className="relative">
                  <span aria-hidden data-rule-x className="absolute inset-x-0 top-0 h-px origin-left bg-line lg:hidden" />
                  {index > 0 ? (
                    <span aria-hidden data-rule-y className="absolute inset-y-0 left-0 hidden w-px origin-top bg-line lg:block" />
                  ) : null}
                  {/* Stacked on phones, title | body on tablets, a column each on desktop. */}
                  <div
                    data-about-principle
                    data-reveal
                    className={cn(
                      "flex flex-col pt-6 pb-12 md:grid md:grid-cols-12 md:items-baseline md:gap-x-6",
                      "lg:flex lg:items-stretch lg:pt-8 lg:pb-4",
                      index > 0 && "lg:pl-6",
                    )}
                  >
                    <h3 className="font-serif text-title md:col-span-5">{principle.title}</h3>
                    <p className="mt-3 max-w-[38ch] text-fg-muted md:col-span-7 md:mt-0 lg:mt-3">{principle.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <MarqueeGroup
        label="scrolling skills"
        className="mt-[clamp(5rem,2rem+10vw,13rem)] flex flex-col gap-[clamp(0.75rem,0.4rem+1vw,1.5rem)]"
      >
        <Marquee
          items={PRIMARY_SKILLS}
          ariaLabel="Skills: machine learning, AI, languages and tools"
          speed={70}
          className="font-serif text-headline"
        />
        <Marquee
          items={PLATFORM_SKILLS}
          ariaLabel="Skills: cloud, MLOps, big data and statistics"
          reverse
          speed={60}
          className="font-mono text-lead uppercase text-fg-muted"
        />
      </MarqueeGroup>
    </section>
  );
}
