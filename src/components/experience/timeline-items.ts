import { getProject } from "@/content/projects";
import { education, experience } from "@/content/site";

/** A case study linked under its role: /work/<slug>, labelled with the project's short title. */
export type TimelineLink = { slug: string; label: string };

/** One stop on the Experience timeline — roles and education share a shape (facts from content/site). */
export type TimelineItem = {
  id: string;
  kind: "role" | "education";
  title: string;
  org: string;
  place?: string;
  start: string;
  end: string;
  startISO: string;
  endISO?: string;
  cgpa?: string;
  /** The role's case studies, in content order (none for education). */
  projects: readonly TimelineLink[];
};

/** A role's project slugs as links; an unknown slug fails the build rather than linking to a 404. */
function caseStudies(title: string, slugs: readonly string[]): TimelineLink[] {
  return slugs.map((slug) => {
    const project = getProject(slug);
    if (!project) throw new Error(`Experience: "${title}" lists the project "${slug}", which projects.ts doesn't have.`);
    return { slug, label: project.shortTitle };
  });
}

/** Oldest first: the path reads left to right (top to bottom on phones) and ends at the present. */
export const timelineItems: readonly TimelineItem[] = [
  ...experience.map((role, i) => ({
    id: `role-${i + 1}`,
    kind: "role" as const,
    title: role.title,
    org: role.org,
    start: role.start,
    end: role.end,
    startISO: role.startISO,
    endISO: role.endISO,
    place: role.place,
    projects: caseStudies(role.title, role.projects),
  })),
  {
    id: "education",
    kind: "education" as const,
    title: education.degreeShort,
    org: education.school,
    place: education.city,
    start: education.start,
    end: education.end,
    startISO: education.startISO,
    endISO: education.endISO,
    cgpa: education.cgpa,
    projects: [],
  },
].sort((a, b) => a.startISO.localeCompare(b.startISO));

export const startYear = (item: TimelineItem) => item.startISO.slice(0, 4);

/** "2023-07" → 2023.5: a date as a year with a fraction, for placing it on the time axis. */
export const toYear = (iso: string) => Number(iso.slice(0, 4)) + (Number(iso.slice(5, 7) || 1) - 1) / 12;

/**
 * The time axis from tablets up: January of the first start year to a few months past `now` (a year
 * with a fraction), so "Now" has room. `at` maps a year to its position along the axis, in percent.
 */
export function timeAxis(items: readonly TimelineItem[], now: number) {
  const from = Math.floor(Math.min(...items.map((item) => toYear(item.startISO))));
  const span = now + 0.4 - from;
  return { from, at: (year: number) => ((year - from) / span) * 100 };
}

/** "2019–Present": earliest start to the open-ended (current) entry. */
export function timelineSpan(items: readonly TimelineItem[]) {
  const first = items.map(startYear).sort()[0];
  const current = items.find((item) => !item.endISO);
  const last = current ? current.end : items.map((item) => item.endISO?.slice(0, 4) ?? "").sort().at(-1);
  return `${first}–${last}`;
}

/** Unique organisations in timeline order. */
export const timelineOrgs = (items: readonly TimelineItem[]) => [...new Set(items.map((item) => item.org))];
