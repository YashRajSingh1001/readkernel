// The sources the pipeline reads. Generated from pipeline/sources.yaml by
// `python -m kernel.sources` (run it after editing that file).
import list from "./sources.json";

export type SourceInfo = { name: string; topic: string; site: string };

export const SOURCES: SourceInfo[] = list;

// Well-known names first for the homepage strip.
const FEATURED = [
  "TechCrunch",
  "The Verge",
  "Bloomberg Technology",
  "Ars Technica",
  "Wired",
  "MIT Technology Review",
  "Hacker News",
  "OpenAI News",
  "Google DeepMind",
  "Hugging Face",
  "GitHub Blog",
  "Rest of World",
  "Inc42",
  "Krebs on Security",
];

export const FEATURED_SOURCES = FEATURED.map((name) => SOURCES.find((s) => s.name === name)).filter(
  (s): s is SourceInfo => Boolean(s),
);
