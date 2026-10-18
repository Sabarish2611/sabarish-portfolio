import type { Metadata } from "next";
import { site } from "@/content/site";

export const SITE_TITLE = `${site.name} — Data Scientist`;

/** ≤ 155 characters so search snippets aren't cut off. */
export const SITE_DESCRIPTION =
  "Data scientist at Trellix building production ML for cybersecurity: EDR threat detection, malware-classification MLOps, and alert prioritization.";

/** Shared Open Graph fields. Child segments replace `openGraph` wholesale, so spread this and add `url`. */
export const BASE_OPEN_GRAPH = {
  type: "website",
  siteName: site.name,
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  locale: "en_US",
} satisfies Metadata["openGraph"];
