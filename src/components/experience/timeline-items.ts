import { getProject, type Project } from "@/content/projects";
import { education, experience } from "@/content/site";

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
  summary?: string;
  projects: readonly Project[];
  cgpa?: string;
};

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
    summary: role.summary,
    projects: role.projects
      .map((slug) => getProject(slug))
      .filter((project): project is Project => Boolean(project)),
  })),
  {
    id: "education",
    kind: "education",
    title: education.degree,
    org: education.school,
    place: education.city,
    start: education.start,
    end: education.end,
    startISO: education.startISO,
    endISO: education.endISO,
    projects: [],
    cgpa: education.cgpa,
  },
];

export const startYear = (item: TimelineItem) => item.startISO.slice(0, 4);

/** "2019–Present": earliest start to the open-ended (current) entry. */
export function timelineSpan(items: readonly TimelineItem[]) {
  const first = items.map(startYear).sort()[0];
  const current = items.find((item) => !item.endISO);
  const last = current ? current.end : items.map((item) => item.endISO?.slice(0, 4) ?? "").sort().at(-1);
  return `${first}–${last}`;
}

/** Unique organisations in timeline order. */
export const timelineOrgs = (items: readonly TimelineItem[]) => [...new Set(items.map((item) => item.org))];
