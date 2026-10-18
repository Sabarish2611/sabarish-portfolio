"use client";

import { useRef } from "react";
import { CopyEmail } from "@/components/ui/copy-email";
import { Magnetic } from "@/components/ui/magnetic";
import { site } from "@/content/site";
import { useLocalTime } from "@/hooks/use-local-time";
import { cn } from "@/lib/cn";
import { DURATION, EASE, gsap, SplitText, useGSAP } from "@/lib/gsap";

const MAILTO = `mailto:${site.email}`;

const LINKS = [
  { label: "LinkedIn", href: site.links.linkedin },
  { label: "Résumé", href: site.links.resume },
] as const;

// Line masks get room for ascenders/descenders (padding) without moving the text (negative margin).
// Adjacent negative margins collapse instead of adding up, so each later mask pulls up by twice the
// pad, and every phrase is its own block formatting context: split and unsplit layouts match exactly.
const HEADING_MASKS =
  "[&_.contact-line-mask]:-my-[0.14em] [&_.contact-line-mask]:py-[0.14em] [&_.contact-line-mask+.contact-line-mask]:-mt-[0.28em]";

export function Contact() {
  const root = useRef<HTMLElement>(null);
  const time = useLocalTime(site.location.timeZone);

  useGSAP(
    () => {
      const section = root.current;
      if (!section) return;
      const q = gsap.utils.selector(section);
      const heading = q("[data-contact-heading]")[0];
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(q("[data-reveal]"), { autoAlpha: 1 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (!heading) return;
        // Fresh vars per tween: ScrollTrigger writes its defaults into the object it is given.
        const enter = () => ({ trigger: heading, start: "top 80%", once: true });

        gsap.from(q("[data-contact-eyebrow]"), { autoAlpha: 0, duration: 0.3, ease: EASE.out, scrollTrigger: enter() });

        // Each phrase is split on its own (a block child would otherwise be sliced per word).
        // Lines keep whole words, so the heading stays readable without aria rewriting.
        SplitText.create(q("[data-contact-phrase]"), {
          type: "lines",
          mask: "lines",
          linesClass: "contact-line",
          aria: "none",
          autoSplit: true,
          onSplit: (self) => {
            gsap.set(heading, { autoAlpha: 1 });
            return gsap.from(self.lines, {
              yPercent: 118,
              duration: DURATION.slow,
              ease: EASE.out,
              stagger: 0.09,
              scrollTrigger: enter(),
            });
          },
        });

        // The circle fades in once the heading has risen.
        gsap.from(q("[data-contact-cta]"), {
          autoAlpha: 0,
          duration: 0.3,
          ease: EASE.out,
          delay: 0.35,
          scrollTrigger: enter(),
        });

        // Email row, then the links row: a hairline draws in first, items fade in after it.
        q("[data-contact-group]").forEach((group) => {
          const groupEnter = () => ({ trigger: group, start: "top 90%", once: true });
          const rule = group.querySelector("[data-contact-rule]");
          if (rule) {
            gsap.from(rule, { scaleX: 0, autoAlpha: 0, duration: DURATION.slow, ease: EASE.inOut, scrollTrigger: groupEnter() });
          }
          gsap.from(group.querySelectorAll("[data-contact-item]"), {
            autoAlpha: 0,
            duration: 0.3,
            ease: EASE.out,
            stagger: 0.06,
            delay: rule ? 0.2 : 0,
            scrollTrigger: groupEnter(),
          });
        });
      });
    },
    { scope: root },
  );

  return (
    <section id="contact" ref={root} aria-labelledby="contact-title" className="section-pad relative overflow-hidden">
      <div className="container-page">
        <p data-contact-eyebrow data-reveal className="eyebrow flex items-center gap-3 text-fg-muted">
          <span className="text-accent-ink">(05)</span>
          <span aria-hidden className="h-px w-8 bg-line-strong" />
          Contact
        </p>

        <div className="mt-6 grid grid-cols-12 gap-x-6 gap-y-10">
          <h2
            id="contact-title"
            data-contact-heading
            data-reveal
            className={cn(
              "col-span-12 col-start-1 row-start-1 -ml-[0.04em] font-serif text-[length:clamp(3.25rem,18.5vw,5.5rem)] leading-[0.9] tracking-[-0.03em] md:text-[length:clamp(5rem,11vw,12rem)]",
              HEADING_MASKS,
            )}
          >
            <span data-contact-phrase className="flow-root">
              Have a noisy problem?
            </span>{" "}
            <span data-contact-phrase className="flow-root text-fg italic">
              Let&rsquo;s find the signal.
            </span>
          </h2>

          {/* Offset lives on this wrapper: GSAP owns the transform of the [data-contact-cta] child. */}
          <div className="col-span-12 row-start-2 -mt-4 justify-self-end lg:col-span-3 lg:col-start-10 lg:row-start-1 lg:mt-0 lg:translate-y-[30%] lg:self-end">
            <div data-contact-cta data-reveal>
              <Magnetic strength={0.3}>
                <a
                  href={MAILTO}
                  className="group grid size-36 place-items-center rounded-full bg-accent text-on-accent transition-[scale,background-color,color] duration-700 ease-out hover:scale-[1.06] light:bg-fg light:text-bg light:hover:bg-accent light:hover:text-on-accent lg:size-40 xl:size-44"
                >
                  <span className="flex items-center gap-2 text-lg font-medium xl:text-xl">
                    Say hello
                    <span className="sr-only"> by email</span>
                    <span aria-hidden className="transition-[rotate] duration-500 ease-out group-hover:-rotate-45">
                      →
                    </span>
                  </span>
                </a>
              </Magnetic>
            </div>
          </div>
        </div>

        <div
          data-contact-group
          className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-5 md:mt-20 lg:mt-[clamp(6rem,9vw,9rem)]"
        >
          {/* Padded up to a 44px touch target on phones; the underline stays on the text (content box). */}
          <a
            href={MAILTO}
            data-contact-item
            data-reveal
            className="link-draw bg-origin-content py-[max(0px,calc((2.75rem_-_1lh)/2))] font-sans text-[length:clamp(1.375rem,6.2vw,2rem)] leading-tight tracking-[-0.025em] md:text-headline md:leading-[1.08]"
          >
            {site.email}
          </a>
          <div data-contact-item data-reveal>
            <CopyEmail email={site.email} />
          </div>
        </div>

        <div data-contact-group className="mt-16 md:mt-24">
          <div data-contact-rule data-reveal className="h-px origin-left bg-line" />
          <div className="flex flex-col gap-4 pt-5 md:flex-row md:items-center md:justify-between">
            <ul className="flex flex-wrap items-center gap-x-8 gap-y-1">
              {LINKS.map((link) => (
                <li key={link.label} data-contact-item data-reveal>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex h-11 items-center gap-2 text-lg"
                  >
                    <span className="link-draw">{link.label}</span>
                    <span
                      aria-hidden
                      className="text-fg-muted transition-[translate,color] duration-500 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent-ink"
                    >
                      ↗
                    </span>
                    <span className="sr-only">(opens in new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
            <p data-contact-item data-reveal className="eyebrow flex items-center gap-2 text-fg-muted">
              {site.location.city}, {site.location.country}
              <span aria-hidden className="text-fg-subtle">
                ·
              </span>
              <span data-qa-mask>
                <time suppressHydrationWarning>{time ?? "--:--"}</time> {site.location.timeZoneLabel}
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
