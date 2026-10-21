/**
 * Case studies. Every number and claim is from the résumé — these were confidential systems at
 * Trellix, so the site shows illustrative visuals (see `visual`), never screenshots.
 */

export type Metric = {
  /** Display value, exactly as it should read: "94.5%", "120M+", "70% → 30%". */
  value: string;
  /** Sentence case, no trailing colon. */
  label: string;
};

export type ApproachStep = { title: string; body: string };

export type ProjectVisual = "clusters" | "pipeline" | "autoencoder" | "categories" | "agents";

export type Project = {
  slug: string;
  index: string;
  title: string;
  /** Short name for cards, menus and the command palette. */
  shortTitle: string;
  oneLiner: string;
  role: string;
  org: string;
  /** Only where the résumé dates the work itself (the internship); roles carry their own dates. */
  period?: string;
  domains: readonly string[];
  problem: string;
  approach: readonly ApproachStep[];
  /** First metric is the headline figure. */
  metrics: readonly Metric[];
  outcome: string;
  stack: readonly string[];
  visual: ProjectVisual;
};

export const projects: readonly Project[] = [
  {
    slug: "stream",
    index: "01",
    title: "STREAM: LLM agents for security escalations",
    shortTitle: "STREAM escalation agents",
    oneLiner:
      "A multi-agent LLM system that triages and investigates security escalations from Jira, then proposes a resolution or hands off to an analyst.",
    role: "Data Scientist",
    org: "Trellix",
    domains: ["Agentic AI", "Human-in-the-loop", "GraphRAG"],
    problem:
      "Every customer security escalation that lands in Jira has to be triaged, investigated, and either resolved or handed to an analyst — and LLM agents doing that work need guardrails.",
    approach: [
      {
        title: "Orchestrate and delegate",
        body: "LLM agents investigate each escalation: a LangGraph orchestrator agent, running on Claude, delegates to product-specific sub-agents.",
      },
      {
        title: "Triage and dedup",
        body: "Hybrid triage runs on regex with an LLM fallback, and duplicate tickets are caught with vector search, reciprocal rank fusion (RRF), and an LLM-as-judge.",
      },
      {
        title: "Context from a knowledge graph",
        body: "Tickets and indicators are modeled as a Neo4j knowledge graph with vector search, which gives the agents GraphRAG context.",
      },
      {
        title: "Guardrails by design",
        body: "Read-only agent tools, deterministic Jira actions, confidence gating, and LLM cost budgets keep the agents within bounds.",
      },
      {
        title: "A durable human in the loop",
        body: "When an escalation goes to an analyst, LangGraph interrupts pause the run and Postgres checkpoints hold its state, so it resumes on the analyst’s reply.",
      },
    ],
    // The résumé gives no figures for this project, so its results are the design's own terms. Values
    // after the first stay short (six characters or so): they share a two-column row on phones.
    metrics: [
      { value: "HITL", label: "Durable analyst review" },
      { value: "Neo4j", label: "Knowledge graph for GraphRAG" },
      { value: "Claude", label: "LangGraph orchestrator agent" },
    ],
    outcome:
      "Customer escalations go from Jira to a proposed resolution or an analyst hand-off — investigated by LLM agents within guardrails, with a durable human in the loop.",
    stack: ["Python", "LangGraph", "LangChain", "Claude", "AWS Bedrock", "Neo4j", "PostgreSQL", "LangSmith", "GCP"],
    visual: "agents",
  },
  {
    slug: "edr-threat-detection",
    index: "02",
    title: "ML-powered threat detection for EDR",
    shortTitle: "EDR threat detection",
    oneLiner:
      "Replacing hand-managed YARA rules with a supervised model that reads endpoint behavior and classifies it into 353 detection rule types.",
    role: "Data Scientist",
    org: "Trellix",
    domains: ["Threat detection", "NLP", "Classification"],
    problem:
      "Endpoint detection relied on a high volume of manually managed YARA rules, each one maintained by hand.",
    approach: [
      {
        title: "Behavior as language",
        body: "Built a feature pipeline that turns raw EDR telemetry into behavioral sentences, then encodes them as 384-dimensional transformer embeddings.",
      },
      {
        title: "One model, 353 rules",
        body: "Trained a supervised classifier with LightGBM and scikit-learn that maps telemetry to 353 rule types — replacing the manually managed rule set.",
      },
      {
        title: "Learn from the misses",
        body: "Targeted retraining on misclassified samples lifted 57 rules to 90% precision.",
      },
      {
        title: "Explainable detections",
        body: "Integrated an LLM that generates detection insights and MITRE ATT&CK mappings.",
      },
    ],
    metrics: [
      { value: "94.5%", label: "Weighted F1" },
      { value: "353", label: "Rule types classified" },
      { value: "57", label: "Rules lifted to 90% precision" },
      { value: "384-d", label: "Transformer embeddings" },
    ],
    outcome:
      "A supervised model replaced the hand-managed YARA rule set — 353 rule types at 94.5% weighted F1 — with LLM-generated insights and MITRE ATT&CK mappings alongside.",
    stack: ["Python", "LightGBM", "Scikit-learn", "Transformers", "AWS EC2", "SageMaker", "S3"],
    visual: "clusters",
  },
  {
    slug: "malware-mlops-pipeline",
    index: "03",
    title: "End-to-end MLOps for malware classification",
    shortTitle: "Malware MLOps pipeline",
    oneLiner:
      "A production seven-stage pipeline on Vertex AI that labels samples, then trains and evaluates a Windows PE malware classifier — and retrains it every day.",
    role: "Data Scientist",
    org: "Trellix",
    domains: ["MLOps", "Malware", "GCP"],
    problem:
      "Malware labels arrive from six upstream sources that often conflict, training sets run past 120 million rows, and a classifier only stays useful if it keeps learning from new samples.",
    approach: [
      {
        title: "Seven stages, one pipeline",
        body: "Inventory → labeling → extraction → sampling → HP tuning → training → evaluation, orchestrated on Vertex AI Pipelines and Cloud Run Jobs, classifying Windows PE files over 2,598+ extracted features.",
      },
      {
        title: "Resolve conflicting labels",
        body: "A tiered combiner with versioned label logic reconciles labels from VirusTotal, ReversingLabs, AVTest, DoD, endpoint feedback, and manual analysts. Chronological train/val/test splits prevent temporal leakage.",
      },
      {
        title: "A three-tier tuning fallback",
        body: "LightGBM on Vertex AI GPU CustomJobs falls back from the Bayesian HP-tuning winner to config defaults to library defaults, with 8 parameters tuned in parallel Bayesian trials.",
      },
      {
        title: "A data path that scales",
        body: "Arrow streaming over the BigQuery Storage Read API, dtype compaction (f64→f32, i64→i32), and Parquet split caching on GCS for 120M+ row training sets.",
      },
      {
        title: "Infrastructure as code",
        body: "Terraform for BigQuery datasets, GCS buckets, IAM, and daily Cloud Scheduler retrains, with config decoupled from images through GCS-hydrated YAML.",
      },
    ],
    metrics: [
      { value: "120M+", label: "Rows per training set" },
      { value: "2,598+", label: "Extracted PE features" },
      { value: "6", label: "Label sources reconciled" },
      { value: "Daily", label: "Automated retrains" },
    ],
    outcome:
      "A production pipeline I owned end to end: six conflicting label feeds in, a classifier retrained every day out — reproducible from Terraform and config.",
    stack: [
      "Python",
      // "(GPU/OpenCL)" on the résumé; shortened so the card's three-tool stack line stays within two lines.
      "LightGBM (GPU)",
      "Vertex AI",
      "BigQuery",
      "Cloud Run",
      "GCS",
      "Cloud Scheduler",
      "IAM",
      "Kubeflow Pipelines",
      "Terraform",
      "Docker",
      "Apache Arrow",
    ],
    visual: "pipeline",
  },
  {
    slug: "alert-prioritization",
    index: "04",
    title: "Autoencoder alert prioritization",
    shortTitle: "Alert prioritization",
    oneLiner:
      "An autoencoder-based system that prioritizes security alerts, so SOC analysts spend their time on the ones that matter.",
    role: "Data Scientist",
    org: "Trellix",
    domains: ["Anomaly detection", "Deep learning", "SOC"],
    problem:
      "Seventy percent of the alerts reaching security analysts were false positives — a recipe for alert fatigue.",
    approach: [
      {
        title: "Research first",
        body: "Surveyed industry best practices for alert triage before committing to a design.",
      },
      {
        title: "An autoencoder for priority",
        body: "Designed and implemented an autoencoder-based prioritization system using PyTorch and scikit-learn.",
      },
      {
        title: "On AWS",
        body: "Built with PySpark on AWS: EMR, Athena, SageMaker, EC2, and S3.",
      },
    ],
    metrics: [
      { value: "70% → 30%", label: "False positives" },
      { value: "94.5%", label: "Reduction in alert fatigue" },
    ],
    outcome:
      "False positives fell from 70% to 30% and alert fatigue dropped by 94.5%, improving SOC efficiency.",
    stack: ["Python", "PyTorch", "Scikit-learn", "PySpark", "Git", "AWS EC2", "SageMaker", "S3", "EMR", "Athena"],
    visual: "autoencoder",
  },
  {
    slug: "url-categorization",
    index: "05",
    title: "Multilingual URL categorization",
    shortTitle: "URL categorization",
    oneLiner:
      "An NLP pipeline that sorts URLs into 60 categories, using multilingual XLM transformer embeddings and XGBoost.",
    role: "Data Science Intern",
    org: "Trellix",
    period: "Mar–Jun 2023",
    domains: ["NLP", "Multilingual", "Explainability"],
    problem:
      "Sorting URLs into 60 categories means understanding text in many languages — the web isn’t written in one.",
    approach: [
      {
        title: "Embed across languages",
        body: "Built an NLP pipeline that turns each URL into multilingual XLM transformer embeddings.",
      },
      {
        title: "Classify",
        body: "Trained an XGBoost model on the embeddings: 76% accuracy across 60 categories.",
      },
      {
        title: "Explain",
        // "Validate feature importance" isn't on the new résumé: kept, confirmed by Sabarish.
        body: "Used SHAP to interpret predictions and validate feature importance.",
      },
    ],
    metrics: [
      { value: "76%", label: "Accuracy" },
      { value: "60", label: "Categories" },
    ],
    outcome:
      "An explainable categorization pipeline that works across languages — built during my internship.",
    stack: ["Python", "XLM Transformers", "XGBoost", "SHAP", "NLP"],
    visual: "categories",
  },
];

export function getProject(slug: string) {
  return projects.find((project) => project.slug === slug);
}

export function getAdjacentProject(slug: string) {
  const index = projects.findIndex((project) => project.slug === slug);
  return projects[(index + 1) % projects.length];
}
