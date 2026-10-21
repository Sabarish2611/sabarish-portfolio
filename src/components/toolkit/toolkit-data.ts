import { projects } from "@/content/projects";
import { methodSkills, skillGroups } from "@/content/site";
import type { ToolIconSlug } from "@/content/tool-icons";

/**
 * The Toolkit as a periodic table, derived from the content files: every résumé skill is an element,
 * numbered in résumé order and placed where that element number sits in the real table, so the
 * groups fill it in reading order. Nothing here adds a fact; it only reconciles how the résumé's
 * project lines spell some skills. Server-side: the section passes the result to the client as props.
 */

/** Two-letter element symbols (presentation only). Every skill needs one, and they must be unique. */
const SYMBOLS: Readonly<Record<string, string>> = {
  Python: "Py",
  SQL: "Sq",
  MySQL: "My",
  PostgreSQL: "Pg",
  BigQuery: "Bq",
  Cypher: "Cy",
  Bash: "Sh",
  Git: "Gt",
  "REST APIs": "Ap",
  Flask: "Fl",
  LLMs: "Ll",
  Claude: "Cl",
  "AWS Bedrock": "Br",
  "Multi-Agent Systems": "Ma",
  LangGraph: "Lg",
  LangChain: "Lc",
  "Tool Calling": "Tc",
  RAG: "Rg",
  GraphRAG: "Gr",
  "Vector Search": "Vs",
  "Human-in-the-Loop": "Hl",
  "LLM-as-Judge": "Lj",
  "Prompt Engineering": "Pe",
  "Deep Learning": "Dl",
  Transformers: "Tf",
  Autoencoders: "Ae",
  NLP: "Nl",
  "Computer Vision": "Cv",
  "Reinforcement Learning": "Rl",
  LightGBM: "Lb",
  XGBoost: "Xg",
  PyTorch: "Pt",
  "Scikit-learn": "Sk",
  SHAP: "Sp",
  "Statistical Modeling": "Sm",
  "A/B Testing": "Ab",
  PySpark: "Ps",
  "Apache Arrow": "Ar",
  EDA: "Ed",
  "Feature Engineering": "Fe",
  Matplotlib: "Mp",
  Seaborn: "Sb",
  Plotly: "Pl",
  "AWS SageMaker": "Sg",
  "AWS Lambda": "La",
  EC2: "Ec",
  S3: "S3",
  EMR: "Em",
  Athena: "At",
  "Vertex AI Pipelines": "Vx",
  "Cloud Run": "Cr",
  GCS: "Gc",
  "Cloud Scheduler": "Cs",
  IAM: "Ia",
  "Kubeflow Pipelines": "Kf",
  Terraform: "Tr",
  Docker: "Dk",
};

/** Brand marks in TOOL_ICONS, shown on the enlarged element. */
const ICONS: Readonly<Record<string, ToolIconSlug>> = {
  Python: "python",
  MySQL: "mysql",
  PostgreSQL: "postgresql",
  BigQuery: "googlebigquery",
  Bash: "gnubash",
  Git: "git",
  Flask: "flask",
  Claude: "claude",
  LangGraph: "langgraph",
  LangChain: "langchain",
  PyTorch: "pytorch",
  "Scikit-learn": "scikitlearn",
  PySpark: "apachespark",
  "Apache Arrow": "apachearrow",
  Plotly: "plotly",
  GCS: "googlecloudstorage",
  Terraform: "terraform",
  Docker: "docker",
};

/** Shorter names for the tiles (the full name stays the accessible one, and shows enlarged). */
const LABELS: Readonly<Record<string, string>> = {
  "AWS SageMaker": "SageMaker",
  "AWS Bedrock": "Bedrock",
  "AWS Lambda": "Lambda",
  "Vertex AI Pipelines": "Vertex AI",
  "Kubeflow Pipelines": "Kubeflow",
  "Cloud Scheduler": "Scheduler",
  "Multi-Agent Systems": "Multi-agent",
  "Human-in-the-Loop": "HITL",
  "Prompt Engineering": "Prompting",
  "Reinforcement Learning": "RL",
  "Statistical Modeling": "Statistics",
  "Feature Engineering": "Features",
  "Computer Vision": "Vision",
  "Deep Learning": "Deep learning",
  "Vector Search": "Vectors",
  "LLM-as-Judge": "LLM judge",
};

/** Project-line spellings of a skill. */
const ALIASES: Readonly<Record<string, string>> = {
  "AWS EC2": "EC2",
  SageMaker: "AWS SageMaker",
  "LightGBM (GPU)": "LightGBM",
  "Vertex AI": "Vertex AI Pipelines",
  "XLM Transformers": "Transformers",
};

export type ToolkitElement = {
  number: number;
  name: string;
  label: string;
  symbol: string;
  /** Index into toolkitGroups. */
  group: number;
  /** A field or method rather than a tool. */
  method: boolean;
  icon?: ToolIconSlug;
  /** Short titles of the case studies whose stack names it. */
  usedIn: readonly string[];
  /** Grid cell (1-based) of that element number in the 18-column table. */
  row: number;
  col: number;
};

/** Row and column of element `n` in the standard 18-column table, lanthanides/actinides pulled out below. */
function cell(n: number): { row: number; col: number } {
  if (n === 1) return { row: 1, col: 1 };
  if (n === 2) return { row: 1, col: 18 };
  if (n <= 18) {
    const row = n <= 10 ? 2 : 3;
    const i = n - (row === 2 ? 3 : 11);
    return { row, col: i < 2 ? i + 1 : i + 11 };
  }
  if (n <= 54) {
    const row = n <= 36 ? 4 : 5;
    return { row, col: n - (row === 4 ? 18 : 36) };
  }
  if (n <= 57) return { row: 6, col: n - 54 };
  if (n <= 71) return { row: 8, col: n - 54 };
  if (n <= 86) return { row: 6, col: n - 68 };
  throw new Error(`Toolkit: the table holds 86 skills; there are ${n}.`);
}

const methods = new Set(methodSkills);

const usedIn = new Map<string, string[]>();
for (const project of projects) {
  for (const entry of project.stack) {
    const name = ALIASES[entry] ?? entry;
    usedIn.set(name, [...(usedIn.get(name) ?? []), project.shortTitle]);
  }
}

export const toolkitGroups: readonly string[] = skillGroups.map((group) => group.label);

// The résumé lists BigQuery under two groups; the table holds it once, in the first.
const seen = new Set<string>();
const symbols = new Set<string>();
export const toolkitElements: readonly ToolkitElement[] = skillGroups
  .flatMap((group, g) => group.items.map((name) => ({ name, group: g })))
  .filter(({ name }) => !seen.has(name) && Boolean(seen.add(name)))
  .map(({ name, group }, i) => {
    const symbol = SYMBOLS[name];
    if (!symbol) throw new Error(`Toolkit: ${name} needs an element symbol (SYMBOLS).`);
    if (symbols.has(symbol)) throw new Error(`Toolkit: the symbol ${symbol} is used twice.`);
    symbols.add(symbol);
    return {
      number: i + 1,
      name,
      label: LABELS[name] ?? name,
      symbol,
      group,
      method: methods.has(name),
      icon: ICONS[name],
      usedIn: usedIn.get(name) ?? [],
      ...cell(i + 1),
    };
  });
