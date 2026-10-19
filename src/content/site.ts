/**
 * Single source of truth for personal facts. Everything here comes from the résumé —
 * edit this file (and projects.ts) to update the site; components never hard-code facts.
 */

/** Set NEXT_PUBLIC_SITE_URL to the production domain; Vercel's production URL is the fallback. */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const site = {
  name: "Sabarishwaran G",
  shortName: "Sabarish",
  monogram: "SG",
  role: "Data Scientist",
  company: "Trellix",
  /** Current address, confirmed by Sabarish; the résumé PDF still lists an older one until it's updated. */
  email: "sabarishwaran.ganesan@gmail.com",
  location: {
    city: "Trichy",
    region: "Tamil Nadu",
    country: "India",
    timeZone: "Asia/Kolkata",
    timeZoneLabel: "IST",
    /** IST has no daylight saving: always five and a half hours ahead of UTC. */
    utcOffset: "UTC+5:30",
  },
  /** Not on the résumé: confirmed by Sabarish, who will work wherever a role needs. */
  openTo: "Relocation & travel",
  links: {
    /** Confirmed by Sabarish (the earlier /in/sabarishwaran-g was wrong). */
    linkedin: "https://www.linkedin.com/in/sabarish2611/",
    resume: "/Sabarishwaran_G_Resume.pdf",
  },
} as const;

export type SkillGroup = { label: string; items: readonly string[] };

export const skillGroups: readonly SkillGroup[] = [
  {
    label: "Machine learning & AI",
    items: [
      "Machine Learning",
      "Deep Learning",
      "Transformers",
      "Autoencoders",
      "NLP",
      "Computer Vision",
      "Reinforcement Learning",
      "LLMs",
      "LightGBM",
      "XGBoost",
      "PyTorch",
      "Scikit-learn",
    ],
  },
  {
    label: "Cloud & MLOps",
    items: [
      "AWS SageMaker",
      "EC2",
      "S3",
      "EMR",
      "Athena",
      "Vertex AI Pipelines",
      "BigQuery",
      "Cloud Run",
      "GCS",
      "Cloud Scheduler",
      "IAM",
      "Kubeflow Pipelines",
      "Terraform",
    ],
  },
  { label: "Big data", items: ["PySpark", "AWS EMR", "BigQuery Storage API", "Apache Arrow"] },
  {
    label: "Statistics & analysis",
    items: [
      "SHAP",
      "Statistical Modeling",
      "Linear Algebra",
      "A/B Testing",
      "Exploratory Data Analysis",
      "Data Wrangling",
      "Feature Engineering",
    ],
  },
  {
    label: "Languages & tools",
    items: ["Python", "SQL", "MySQL", "BigQuery", "Git", "GitHub", "Docker", "REST APIs", "Bash"],
  },
  { label: "Visualization", items: ["Matplotlib", "Seaborn", "Plotly"] },
];

/**
 * The skills above that are fields or methods rather than tools. About's ticker sets these as words
 * on its first line; every other skill is a tool, on the second line with its logo where it has one.
 */
export const methodSkills: readonly string[] = [
  "Machine Learning",
  "Deep Learning",
  "Transformers",
  "Autoencoders",
  "NLP",
  "Computer Vision",
  "Reinforcement Learning",
  "LLMs",
  "Statistical Modeling",
  "Linear Algebra",
  "A/B Testing",
  "Exploratory Data Analysis",
  "Data Wrangling",
  "Feature Engineering",
];

export type Role = {
  title: string;
  org: string;
  start: string;
  end: string;
  /** ISO-ish dates for <time dateTime>. */
  startISO: string;
  endISO?: string;
  /** The office's city. Not on the résumé: confirmed by Sabarish. */
  place?: string;
  summary: string;
  projects: readonly string[]; // project slugs
};

export const experience: readonly Role[] = [
  {
    title: "Data Scientist",
    org: "Trellix",
    start: "Jul 2023",
    end: "Present",
    startISO: "2023-07",
    place: "Bangalore",
    summary:
      "Production ML for endpoint security — threat detection on EDR telemetry, an end-to-end MLOps pipeline for malware classification on GCP, and autoencoder-based alert prioritization for the SOC.",
    projects: ["edr-threat-detection", "malware-mlops-pipeline", "alert-prioritization"],
  },
  {
    title: "Data Science Intern",
    org: "Trellix",
    start: "Mar 2023",
    end: "Jun 2023",
    startISO: "2023-03",
    endISO: "2023-06",
    place: "Bangalore",
    summary:
      "Built an automated URL categorization pipeline with multilingual transformer embeddings, XGBoost, and SHAP-based interpretation.",
    projects: ["url-categorization"],
  },
];

export const education = {
  degree: "B.Tech in Computer Science Engineering (Artificial Intelligence)",
  degreeShort: "B.Tech, CSE (Artificial Intelligence)",
  school: "Amrita Vishwa Vidyapeetham",
  city: "Coimbatore",
  start: "Sep 2019",
  end: "May 2023",
  startISO: "2019-09",
  endISO: "2023-05",
  cgpa: "8.02 / 10",
} as const;
