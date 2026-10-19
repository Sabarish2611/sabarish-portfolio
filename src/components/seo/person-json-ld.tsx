import portrait from "@/assets/photos/portrait.jpg";
import { projects } from "@/content/projects";
import { education, site, siteUrl, skillGroups } from "@/content/site";

// Picked by name, so only terms that exist in the content files are ever emitted.
const TOP_SKILLS = ["Machine Learning", "Deep Learning", "NLP", "Transformers", "LLMs", "PyTorch", "LightGBM"];
const TOP_DOMAINS = ["Threat detection", "Anomaly detection", "MLOps"];

const skills = new Set(skillGroups.flatMap((group) => group.items));
const domains = new Set(projects.flatMap((project) => project.domains));

/**
 * schema.org Person for search engines and AI crawlers. Render once, on the home page.
 * `<` is escaped so a string in the data can never close the script element.
 */
export function PersonJsonLd() {
  const url = new URL("/", siteUrl).href;
  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${url}#person`,
    name: site.name,
    url,
    image: new URL(portrait.src, siteUrl).href,
    jobTitle: site.role,
    description: `${site.role} at ${site.company}, building production machine learning for cybersecurity.`,
    worksFor: { "@type": "Organization", name: site.company },
    address: {
      "@type": "PostalAddress",
      addressLocality: site.location.city,
      addressRegion: site.location.region,
      addressCountry: "IN",
    },
    email: `mailto:${site.email}`,
    sameAs: [site.links.linkedin],
    alumniOf: { "@type": "CollegeOrUniversity", name: education.school },
    knowsAbout: [
      ...TOP_SKILLS.filter((skill) => skills.has(skill)),
      ...TOP_DOMAINS.filter((domain) => domains.has(domain)),
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(person).replace(/</g, "\\u003c") }}
    />
  );
}
