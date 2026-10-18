import type { Metadata } from "next";
import Link from "next/link";
import { CaseStudyIndex } from "@/components/seo/case-study-index";
import { PILL_PRIMARY, SystemPage } from "@/components/seo/system-page";
import { Magnetic } from "@/components/ui/magnetic";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <SystemPage
      eyebrow="Error 404"
      title={
        <>
          Signal <span className="text-fg-muted italic">lost.</span>
        </>
      }
      lead={
        <>
          <p className="text-fg">This page drifted out of the dataset.</p>
          <p className="mt-3">The link may be broken, or the page may have moved.</p>
        </>
      }
      actions={
        <Magnetic>
          <Link href="/" transitionTypes={["nav-back"]} className={PILL_PRIMARY}>
            Back to home
            <span aria-hidden className="transition-transform duration-500 ease-out group-hover:translate-x-1">
              →
            </span>
          </Link>
        </Magnetic>
      }
      aside={<CaseStudyIndex />}
    />
  );
}
