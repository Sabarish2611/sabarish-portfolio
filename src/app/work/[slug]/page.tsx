import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CaseStudy } from "@/components/work/case-study/case-study";
import { PageTransition } from "@/components/work/page-transition";
import { getAdjacentProject, getProject, projects } from "@/content/projects";
import { site } from "@/content/site";

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: PageProps<"/work/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return { title: "Not found" };
  const url = `/work/${project.slug}`;
  return {
    title: project.title,
    description: project.oneLiner,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: project.title,
      description: project.oneLiner,
      siteName: site.name,
      locale: "en_US",
    },
    // Otherwise the root layout's home-page card text would be inherited.
    twitter: { card: "summary_large_image", title: project.title, description: project.oneLiner },
  };
}

// Blocking on purpose: the whole page is the slug's content, so there is no useful shell to show
// first, and the listed slugs are static (a client navigation waits only for a prerendered payload).
export const instant = false;

export default async function CaseStudyPage({ params }: PageProps<"/work/[slug]">) {
  // Awaited outside any Suspense boundary, so the listed slugs prerender with the article in the
  // HTML itself, not in a streamed segment that only JavaScript can reveal.
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) {
    return (
      <Suspense>
        <MissingCaseStudy params={params} />
      </Suspense>
    );
  }

  return (
    <PageTransition>
      <main id="main">
        <CaseStudy project={project} next={getAdjacentProject(slug)} total={projects.length} />
      </main>
    </PageTransition>
  );
}

/**
 * Unknown slugs: notFound() from inside a boundary, after the shell. Thrown in the shell, Next (in
 * development) re-renders the whole document on the client, and React flags the layout's inline
 * head script.
 */
async function MissingCaseStudy({ params }: Pick<PageProps<"/work/[slug]">, "params">) {
  await params;
  return notFound();
}
