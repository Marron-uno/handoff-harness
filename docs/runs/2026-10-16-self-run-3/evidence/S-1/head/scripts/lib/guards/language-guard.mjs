// English-only guard. No model, no library: counts function words per paragraph.
// A paragraph of at least `minWords` words whose strongest non-English function-word count
// reaches `minForeignHits` and beats the English count is flagged.
import { globToRegExp } from "../glob.mjs";
import { extname } from "node:path";

const WORDS = {
  en: "the and of to in is that for it with as on be this by are from or an not we which have has will can if at their its was were should must when each into than then also only use used using all any one two no so but do does how what where after before these those there here while because such may might would could them they you your our".split(" "),
  es: "el la los las de del que y en un una es se por para con su sus al lo como más pero o este esta ser son está están debe cuando también hay muy ya sobre entre sin hasta donde desde cada puede pueden hacer tiene tienen porque aunque nosotros ustedes".split(" "),
  pt: "o os as de do da dos das que e em um uma é se por para com não seu sua ao como mais mas ou este esta ser são está deve quando também há muito já sobre entre sem até onde desde cada pode podem fazer tem têm porque embora nós vocês".split(" "),
  fr: "le la les de des du que et en un une est se par pour avec ne pas son sa ses au aux comme plus mais ou ce cette être sont doit quand aussi il elle nous vous sur entre sans où depuis chaque peut peuvent faire ont parce".split(" "),
  de: "der die das und in den von zu mit sich auf für ist im dem nicht ein eine als auch es an werden aus er hat dass sie nach wird bei einer um am sind noch wie einem über einen so zum war haben nur oder aber vor zur bis mehr durch".split(" "),
  it: "il lo la i gli le di del della dei delle che e in un una è si per con non suo sua al come più ma o questo questa essere sono deve quando anche c'è molto già su tra senza dove ogni può possono fare ha hanno perché".split(" "),
};
// Words that are function words in English too are dropped from the foreign lists.
const EN = new Set(WORDS.en);
const FOREIGN = Object.fromEntries(Object.entries(WORDS).filter(([k]) => k !== "en").map(([k, list]) => [k, new Set(list.filter((w) => !EN.has(w)))]));

const COMMENT_LINE = /^\s*(\/\/|#(?!!)|\*|\/\*|<!--|--\s|;;?|%)/;
const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".rb", ".go", ".rs", ".java", ".kt", ".swift", ".php", ".sql", ".css", ".scss", ".vue", ".svelte", ".astro"]);
const PROSE_EXT = new Set([".md", ".mdx", ".txt"]);

export function stripNonProse(text) {
  return String(text)
    .replace(/^---\n[\s\S]*?\n---\n/, "")            // frontmatter
    .replace(/```[\s\S]*?```/g, "\n")                 // fenced code
    .replace(/~~~[\s\S]*?~~~/g, "\n")
    .replace(/`[^`\n]*`/g, " ")                        // inline code
    .replace(/https?:\/\/\S+/g, " ")                   // urls
    .replace(/<[^>\n]+>/g, " ")                        // html tags
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")           // link targets
    .replace(/[|#>*_~]+/g, " ");                       // markdown punctuation
}

export function detectNonEnglish(text, { minWords = 15, minForeignHits = 3 } = {}) {
  const flagged = [];
  const paragraphs = stripNonProse(text).split(/\n\s*\n/);
  let lineCursor = 1;
  for (const para of paragraphs) {
    const words = para.toLowerCase().match(/[\p{L}']+/gu) ?? [];
    const lines = para.split("\n").length;
    if (words.length >= minWords) {
      const en = words.filter((w) => EN.has(w)).length;
      let best = null;
      for (const [lang, set] of Object.entries(FOREIGN)) {
        const hits = words.filter((w) => set.has(w)).length;
        if (!best || hits > best.hits) best = { lang, hits };
      }
      if (best && best.hits >= minForeignHits && best.hits > en) {
        flagged.push({ line: lineCursor, lang: best.lang, hits: best.hits, englishHits: en, words: words.length, sample: para.trim().slice(0, 100).replace(/\s+/g, " ") });
      }
    }
    lineCursor += lines + 1;
  }
  return flagged;
}

function localeFromPath(path) {
  const m = path.match(/(?:^|[\/.])([a-z]{2}(?:-[A-Z]{2})?)(?:[\/.]|$)/);
  return m ? m[1] : null;
}

export function isExempt(path, cfg) {
  if (cfg.exemptGlobs.some((g) => globToRegExp(g).test(path))) {
    const locale = localeFromPath(path);
    // Locale files are exempt unless they are the English locale, which must be English.
    if (locale && cfg.exemptEnglishLocale.includes(locale)) return false;
    return true;
  }
  return false;
}

// Checks one file. Code files are checked on their comment lines only; prose files on everything.
export function checkFileLanguage(path, content, cfg) {
  const ext = extname(path).toLowerCase();
  if (!cfg.textExtensions.includes(ext)) return [];
  if (isExempt(path, cfg)) return [];
  let text = String(content);
  if (CODE_EXT.has(ext)) {
    text = text.split("\n").map((l) => (COMMENT_LINE.test(l) ? l.replace(/^\s*(\/\/|#|\*|\/\*|<!--|--|;;?|%)\s?/, "") : "")).join("\n");
  } else if (!PROSE_EXT.has(ext) && ![".json", ".yaml", ".yml", ".html"].includes(ext)) {
    return [];
  }
  return detectNonEnglish(text, cfg).map((f) => ({ path, ...f }));
}
