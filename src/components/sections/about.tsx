import portrait from "@/assets/photos/portrait.jpg";
import { DecodeText } from "@/components/ui/decode-text";
import { Marquee, MarqueeGroup } from "@/components/ui/marquee";
import { RevealImage } from "@/components/ui/reveal-image";
import { RevealText } from "@/components/ui/reveal-text";
import { methodSkills, site, skillGroups } from "@/content/site";
import { SKILL_ICONS, TOOL_ICONS, type ToolIconSlug } from "@/content/tool-icons";

// One role per line, as in the hero's label: data scientist, AI engineer, forward-deployed engineer.
// The spaces before each <br> keep the phrases apart in the heading's accessible name.
const HEADING = (
  <>
    {"Insight from data. "}
    <br />
    {"Intelligence in code. "}
    <br />
    {"Impact at the "}
    <span data-hl className="hl italic">
      frontlines.
    </span>
  </>
);

// The result gets the highlighter, bound to its full stop (nowrap). Each run of words is one text node:
// the line splitter splits text nodes separately, and Chrome drops a lone {" "} from accessible names.
const STATEMENT = (
  <>
    {`I’m ${site.shortName}, a ${site.role} and AI Engineer who builds intelligent systems for real-world ` +
      `operations. At ${site.company}, I design endpoint security models and daily retraining pipelines that ` +
      "automate threat detection and slash false positives from "}
    <span className="whitespace-nowrap">
      <span data-hl className="hl">
        70% down to 30%
      </span>
      .
    </span>
    {" Simply put: I build models that ship, scale, and save human sanity."}
  </>
);

/** The tools line opens with the languages, the most recognisable logos; the other groups keep their order. */
const LEAD_GROUP = "Languages & tools";

/** Every skill once ("AWS EMR" = "EMR"), in group order. */
const SKILLS = [
  ...skillGroups.filter((group) => group.label === LEAD_GROUP),
  ...skillGroups.filter((group) => group.label !== LEAD_GROUP),
]
  .flatMap((group) => group.items)
  .filter((skill, index, all) => {
    const key = (name: string) => name.toLowerCase().replace(/^aws\s+/, "");
    return all.findIndex((other) => key(other) === key(skill)) === index;
  });

const unknownMethods = methodSkills.filter((skill) => !SKILLS.includes(skill));
if (unknownMethods.length) {
  throw new Error(`methodSkills names skills that aren't in skillGroups: ${unknownMethods.join(", ")}`);
}

/**
 * The ticker's lines: the methods as words, then the tools that have a logo, as logos alone (the
 * Toolkit section lists every tool by name).
 */
const METHODS = SKILLS.filter((skill) => methodSkills.includes(skill));
const TOOLS = SKILLS.flatMap((skill) => {
  const slug = SKILL_ICONS[skill];
  return slug && !methodSkills.includes(skill) ? [{ label: skill, slug }] : [];
});
const TOOL_LOGOS = TOOLS.map(({ label, slug }) => ({
  label,
  mark: (
    <svg aria-hidden viewBox="0 0 24 24" focusable="false" className="size-full fill-current">
      <use href={`#tool-${slug}`} />
    </svg>
  ),
}));

/** Each logo once, as a symbol: the ticker renders its list twice (the loop's copy), and both reuse these. */
function ToolSprite({ slugs }: { slugs: readonly ToolIconSlug[] }) {
  return (
    <svg aria-hidden focusable="false" className="absolute size-0 overflow-hidden">
      {slugs.map((slug) => (
        <symbol key={slug} id={`tool-${slug}`} viewBox="0 0 24 24">
          <path d={TOOL_ICONS[slug].path} />
        </symbol>
      ))}
    </svg>
  );
}

export function About() {
  return (
    <section
      id="about"
      aria-labelledby="about-title"
      // From tablets up the whole section, title to ticker, fits one screen under the header: type and
      // gaps follow the screen's height as well as its width (svh), and the content sits centred.
      className="section-pad md:flex md:min-h-[calc(100svh-var(--header-h))] md:flex-col md:justify-center md:py-[clamp(0.75rem,2svh,2rem)]"
    >
      <div className="container-page grid grid-cols-12 gap-x-3 gap-y-10 sm:gap-x-6 md:gap-y-[clamp(1.25rem,4svh,3rem)]">
        <div className="col-span-12 md:col-span-8">
          <p className="eyebrow flex items-center gap-3 text-fg-muted">
            <span className="text-accent-ink">(01)</span>
            <span aria-hidden className="h-px w-8 bg-line-strong" />
            <DecodeText>About</DecodeText>
          </p>
          <RevealText
            as="h2"
            id="about-title"
            className="mt-[clamp(1rem,2.6svh,2rem)] font-serif text-[length:clamp(2.75rem,min(6vw,8svh),6.5rem)] leading-[0.92] tracking-[-0.03em]"
          >
            {HEADING}
          </RevealText>
        </div>

        {/* Phones: between the heading and the paragraph. Wider: beside both, its top level with the eyebrow. */}
        <RevealImage
          src={portrait}
          alt={`Portrait of ${site.name}`}
          sizes="(min-width: 1600px) 340px, (min-width: 1024px) 22vw, (min-width: 768px) 30vw, (min-width: 640px) 42vw, 58vw"
          // Graded "mono" (scripts/grade-photo.mjs) and framed wide, under a lighter grain than the other
          // photos. Its width (so its height) follows the screen's height: never taller than the text.
          className="col-span-7 aspect-3/5 [--cut:0.875rem] [--grain:0.12] sm:col-span-5 md:col-span-4 md:col-start-9 md:row-span-2 md:row-start-1 md:w-full md:max-w-[30svh] md:self-start md:justify-self-end lg:col-span-3 lg:col-start-10 xl:[--cut:1.125rem]"
        />

        <RevealText className="col-span-12 max-w-[54ch] font-serif text-[length:clamp(1.125rem,min(1.75vw,2.7svh),1.625rem)] leading-[1.4] text-fg md:col-span-8 md:row-start-2">
          {STATEMENT}
        </RevealText>
      </div>

      <ToolSprite slugs={TOOLS.map(({ slug }) => slug)} />
      {/* The ticker band: a hairline with the pause control, the methods, then the logos. Static lists
          (reduced motion) take smaller type, so the section still fits one screen. */}
      <MarqueeGroup
        label="scrolling skills"
        className="mt-[clamp(2.5rem,5svh,3.5rem)] flex flex-col gap-[clamp(0.75rem,1.8svh,1.25rem)] md:mt-[clamp(1.75rem,6svh,4.5rem)]"
      >
        <Marquee
          items={METHODS}
          ariaLabel="Methods"
          speed={50}
          className="font-serif text-[length:clamp(2rem,min(3.6vw,4.6svh),3.5rem)] leading-[1.1] motion-reduce:text-[length:clamp(1.25rem,min(2vw,3svh),1.75rem)]"
        />
        <Marquee
          items={TOOL_LOGOS}
          ariaLabel="Tools"
          logos
          repeat={6}
          reverse
          speed={110}
          className="text-[length:clamp(1.5rem,min(2.4vw,3.4svh),2.25rem)] leading-none text-fg-muted"
        />
      </MarqueeGroup>
    </section>
  );
}
