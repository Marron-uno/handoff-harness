import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpDir, PLUGIN_ROOT } from "./helpers.mjs";
import { loadProfile } from "../scripts/lib/profile.mjs";
import { detectNonEnglish, checkFileLanguage, isExempt } from "../scripts/lib/guards/language-guard.mjs";
import { lintProse } from "../scripts/lib/guards/prose-lint.mjs";

const profile = loadProfile(tmpDir(), PLUGIN_ROOT);
const cfg = profile.language;

const ES = "El sistema debe permitir que los usuarios creen notas con un título y un cuerpo, y además debe mostrar la lista de notas ordenada por fecha de creación para que sea fácil encontrar las más recientes.";
const EN = "The system must let users create notes with a title and a body, and it must show the list of notes sorted by creation date so that the most recent ones are easy to find.";
const PT = "O sistema deve permitir que os usuários criem notas com um título e um corpo, e também deve mostrar a lista de notas ordenada por data de criação para que seja fácil encontrar as mais recentes.";

test("detects Spanish and Portuguese paragraphs, leaves English alone", () => {
  assert.equal(detectNonEnglish(EN, cfg).length, 0);
  const es = detectNonEnglish(ES, cfg);
  assert.equal(es.length, 1);
  assert.equal(es[0].lang, "es");
  assert.equal(detectNonEnglish(PT, cfg)[0].lang, "pt");
});

test("short paragraphs, code blocks, inline code and urls are skipped", () => {
  assert.equal(detectNonEnglish("Hola mundo, esto es corto.", cfg).length, 0);
  const md = `# Title\n\n${EN}\n\n\`\`\`\n${ES}\n\`\`\`\n\nSee \`${ES}\` and https://example.com/${ES.replace(/ /g, "-")}\n`;
  assert.equal(detectNonEnglish(md, cfg).length, 0);
  const mixed = `${EN}\n\n${ES}\n`;
  const hits = detectNonEnglish(mixed, cfg);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 3);
});

test("exemptions: locale files except the English locale, fixtures; code files check comments only", () => {
  assert.equal(isExempt("src/locales/es.json", cfg), true);
  assert.equal(isExempt("src/locales/en.json", cfg), false);
  assert.equal(isExempt("src/i18n/pt-BR/messages.json", cfg), true);
  assert.equal(isExempt("tests/fixtures/sample.md", cfg), true);
  assert.equal(isExempt("docs/guide.md", cfg), false);
  assert.equal(checkFileLanguage("src/locales/es.json", JSON.stringify({ a: ES }), cfg).length, 0);
  assert.equal(checkFileLanguage("src/locales/en.json", JSON.stringify({ a: ES }), cfg).length, 1);
  const code = `const copy = "${ES}";\n// ${ES}\n// ${ES}\nexport default copy;\n`;
  const hits = checkFileLanguage("src/copy.ts", code, cfg);
  assert.equal(hits.length, 1, "string literal is allowed, the comment block is not");
  assert.equal(checkFileLanguage("logo.png", "binary", cfg).length, 0);
});

test("prose lint flags em dashes and banned phrases in markdown only", () => {
  const md = "Intro — with a dash.\n\nWe leverage synergy.\n\n```\ncode — ok\n```\n";
  const hits = lintProse("docs/a.md", md, profile.prose);
  assert.deepEqual(hits.map((h) => h.rule), ["em-dash", "banned-phrase:leverage"]);
  assert.equal(lintProse("src/a.ts", "// a — b", profile.prose).length, 0);
});
