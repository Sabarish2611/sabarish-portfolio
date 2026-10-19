import { BentoGrid } from "@/components/toolkit/bento";
import { ResumeLink } from "@/components/toolkit/resume-link";
import { ScaleFigure } from "@/components/toolkit/scale-figure";
import { ChipList, InlineList, Tile } from "@/components/toolkit/tile";
import { SectionHeader } from "@/components/ui/section-header";
import { getProject } from "@/content/projects";
import { skillGroups } from "@/content/site";

function skills(label: string) {
  return skillGroups.find((group) => group.label === label)?.items ?? [];
}

const allSkills = new Set(skillGroups.flatMap((group) => group.items));

// Cloud skills grouped by provider. Names are matched against site.ts, so nothing here can drift
// from the résumé: a renamed or removed skill simply drops out.
const AWS = new Set(["AWS SageMaker", "EC2", "S3", "EMR", "Athena"]);
const GCP = new Set(["Vertex AI Pipelines", "BigQuery", "Cloud Run", "GCS", "Cloud Scheduler", "IAM"]);
const cloudSkills = skills("Cloud & MLOps");
const clouds = [
  { name: "AWS", services: cloudSkills.filter((s) => AWS.has(s)).map((s) => s.replace(/^AWS /, "")) },
  { name: "GCP", services: cloudSkills.filter((s) => GCP.has(s)) },
];
const delivery = ["Terraform", "Kubeflow Pipelines", "Docker"].filter((s) => allSkills.has(s));

// Languages get their own tile; big data and visualization share one, a line each. Anything the
// Clouds tile already lists (BigQuery, EMR, Docker…) is left out so no tool appears twice.
const normalize = (skill: string) => skill.replace(/^AWS /, "");
const shownElsewhere = new Set([...clouds.flatMap((cloud) => cloud.services), ...delivery].map(normalize));
const toolGroups = ["Languages & tools", "Big data", "Visualization"].map((label) => ({
  label,
  items: skills(label).filter((skill) => !shownElsewhere.has(normalize(skill))),
}));
// The tile is titled "Machine learning", so the generic chip would only repeat it.
const mlSkills = skills("Machine learning & AI").filter((skill) => skill !== "Machine Learning");

const trainingRows =
  getProject("malware-mlops-pipeline")?.metrics.find((metric) => metric.label === "Rows per training set")?.value ??
  "120M+";

export function Toolkit() {
  return (
    <section id="toolkit" aria-labelledby="toolkit-title" className="section-pad">
      <div className="container-page">
        <SectionHeader
          index="04"
          label="Toolkit"
          headingId="toolkit-title"
          heading="Raw data to production."
          aside={
            <p className="max-w-xs text-fg-muted lg:pb-3">
              What I use to take models from raw data to production, on AWS and GCP.
            </p>
          }
        />

        <BentoGrid>
          <Tile title="Machine learning" className="md:col-span-6 lg:col-span-7 lg:row-span-2">
            <p className="max-w-[24ch] font-serif text-statement text-fg-muted">
              <span className="text-fg">Transformers</span> to read endpoint behavior{", "}
              <span className="text-fg">gradient boosting</span> to classify it{", "}
              <span className="text-fg">autoencoders</span> to decide which alerts come first.
            </p>
            <div className="mt-auto flex flex-col gap-8">
              <ChipList items={mlSkills} />
              <div className="flex flex-col gap-4">
                <h4 className="eyebrow text-fg-muted">Statistics &amp; analysis</h4>
                <ChipList items={skills("Statistics & analysis")} />
              </div>
            </div>
          </Tile>

          <Tile title="Scale" className="md:col-span-3 lg:col-span-5">
            <ScaleFigure
              value={trainingRows}
              label="Rows in a single training set — streamed with Apache Arrow from BigQuery"
              className="mt-auto"
            />
          </Tile>

          <Tile title="Clouds" className="md:col-span-3 lg:col-span-5">
            {/* GCP's service names run longer, so it gets the wider column until there is room for halves. */}
            <div className="mt-auto grid grid-cols-[2fr_3fr] gap-x-6 xl:grid-cols-2">
              {clouds.map((cloud) => (
                <div key={cloud.name}>
                  <h4 className="eyebrow border-b border-line pb-3 text-fg-muted">{cloud.name}</h4>
                  <ul className="mt-3 flex flex-col gap-2.5 leading-snug text-fg">
                    {cloud.services.map((service) => (
                      <li key={service}>{service}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {/* Spans both providers; named so screen readers don't file it under "GCP". */}
            <InlineList
              items={delivery}
              label="MLOps tooling"
              className="eyebrow border-t border-line pt-4 text-fg-muted"
            />
          </Tile>

          <Tile title="Explainability" className="md:col-span-6 lg:col-span-7">
            <p className="mt-auto max-w-[44ch] text-lead text-fg-muted">
              <span className="text-fg">SHAP</span>
              {" to validate feature importance in a 60-category "}
              <span className="text-fg">XGBoost</span>
              {" classifier. "}
              <span className="text-fg">LLM-generated detection insights</span>
              {" with "}
              <span className="text-fg">MITRE ATT&amp;CK</span> mappings.
            </p>
          </Tile>

          <Tile
            title="Résumé"
            meta={<span className="eyebrow text-fg-muted">PDF</span>}
            className="md:col-span-6 lg:col-span-5"
          >
            <div className="mt-auto flex items-end justify-between gap-6">
              <p className="max-w-[11ch] font-serif text-title">The full story, one page.</p>
              <ResumeLink />
            </div>
          </Tile>

          <Tile title="Languages & tools" className="md:col-span-3 lg:col-span-7">
            <InlineList
              items={toolGroups[0].items}
              separator="/"
              label="Languages & tools"
              className="mt-auto font-sans text-base text-fg"
            />
          </Tile>

          <Tile title="Big data & visualization" className="md:col-span-3 lg:col-span-5">
            <div className="mt-auto flex flex-col gap-3 font-sans text-base text-fg">
              {toolGroups.slice(1).map((group) => (
                <InlineList key={group.label} items={group.items} separator="/" label={group.label} />
              ))}
            </div>
          </Tile>
        </BentoGrid>
      </div>
    </section>
  );
}
