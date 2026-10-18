import type { MetadataRoute } from "next";
import { projects } from "@/content/projects";
import { siteUrl } from "@/content/site";

/** Content date, not build time: bump it when the copy in src/content changes. */
const lastModified = new Date("2026-10-17");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: new URL("/", siteUrl).href, lastModified, changeFrequency: "monthly", priority: 1 },
    ...projects.map((project) => ({
      url: new URL(`/work/${project.slug}`, siteUrl).href,
      lastModified,
      changeFrequency: "yearly" as const,
      priority: 0.8,
    })),
  ];
}
