#!/usr/bin/env node
/**
 * Validates the question bank in src/content/questions/*.json.
 *   npm run validate
 * Errors (exit code 1): duplicate ids, duplicate choices, missing/invalid answers,
 * invalid difficulty, malformed fields, too few verified questions to build a game.
 * Warnings: length limits, duplicate question text, unverified items (excluded from play).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep in sync with DIFFICULTIES / QUESTION_SCHEDULE in src/config.ts.
export const DIFFICULTIES = ['easy', 'medium', 'challenging', 'hard', 'expert'];
export const PER_GAME = { easy: 2, medium: 2, challenging: 2, hard: 2, expert: 2 };
export const CATEGORIES = ['Geography', 'Science', 'History', 'Nature', 'Literature', 'Art & Music', 'Food & Drink', 'Sport', 'Everyday'];

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');

export function validateQuestions(questions) {
  const errors = [];
  const warnings = [];
  const ids = new Map();
  const texts = new Map();
  const verified = Object.fromEntries(DIFFICULTIES.map((d) => [d, 0]));

  if (!Array.isArray(questions)) return { errors: ['Question bank is not an array.'], warnings, verified };

  questions.forEach((q, index) => {
    const where = q && nonEmpty(q.id) ? q.id : `#${index}`;
    const err = (msg) => errors.push(`${where}: ${msg}`);
    const warn = (msg) => warnings.push(`${where}: ${msg}`);

    if (!q || typeof q !== 'object') return err('not an object');

    if (!nonEmpty(q.id)) err('missing id');
    else if (ids.has(q.id)) err(`duplicate id (also at #${ids.get(q.id)})`);
    else ids.set(q.id, index);

    if (!DIFFICULTIES.includes(q.difficulty)) err(`invalid difficulty "${q.difficulty}"`);
    if (!nonEmpty(q.category)) err('missing category');
    else if (!CATEGORIES.includes(q.category)) warn(`unusual category "${q.category}"`);

    if (!nonEmpty(q.question)) err('missing question text');
    else {
      const key = norm(q.question);
      if (texts.has(key)) warn(`same question text as ${texts.get(key)}`);
      else texts.set(key, where);
      if (q.question.length > 140) warn(`question is ${q.question.length} chars (aim for ≤140)`);
    }

    if (!Array.isArray(q.choices) || q.choices.length !== 4) err('needs exactly 4 choices');
    else {
      const choiceIds = new Set();
      const choiceTexts = new Set();
      for (const c of q.choices) {
        if (!c || !nonEmpty(c.id)) { err('choice without id'); continue; }
        if (choiceIds.has(c.id)) err(`duplicate choice id "${c.id}"`);
        choiceIds.add(c.id);
        if (!nonEmpty(c.text)) err(`choice "${c.id}" has no text`);
        else {
          if (choiceTexts.has(norm(c.text))) err(`duplicate choice text "${c.text}"`);
          choiceTexts.add(norm(c.text));
          if (c.text.length > 40) warn(`choice "${c.id}" is ${c.text.length} chars (aim for ≤40)`);
        }
      }
      if (!nonEmpty(q.answerId)) err('missing answerId');
      else if (!choiceIds.has(q.answerId)) err(`answerId "${q.answerId}" is not one of the choices`);
    }

    if (!nonEmpty(q.explanation)) err('missing explanation');
    else if (q.explanation.length > 240) warn(`explanation is ${q.explanation.length} chars (aim for ≤220)`);

    if (!nonEmpty(q.source) || !/^https?:\/\/\S+$/.test(q.source)) err('source must be an http(s) URL');

    const status = q.verification?.status;
    if (status !== 'verified' && status !== 'unverified') err('verification.status must be "verified" or "unverified"');
    else if (status === 'verified') {
      if (!nonEmpty(q.verification.checkedOn)) err('verified question needs verification.checkedOn');
      if (DIFFICULTIES.includes(q.difficulty)) verified[q.difficulty]++;
    } else warn('unverified — excluded from play');
  });

  for (const d of DIFFICULTIES) {
    if (verified[d] < PER_GAME[d]) errors.push(`Only ${verified[d]} verified ${d} questions; a game needs ${PER_GAME[d]}.`);
    else if (verified[d] < PER_GAME[d] * 7) warnings.push(`Only ${verified[d]} verified ${d} questions — daily games will repeat within a week.`);
  }

  return { errors, warnings, verified };
}

export function loadQuestionFiles(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => {
      const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      return Array.isArray(data) ? data : [data];
    });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content', 'questions');
  let questions;
  try {
    questions = loadQuestionFiles(dir);
  } catch (e) {
    console.error(`✖ Could not read question files: ${e.message}`);
    process.exit(1);
  }
  const { errors, warnings, verified } = validateQuestions(questions);
  for (const w of warnings) console.warn(`  ⚠ ${w}`);
  for (const e of errors) console.error(`  ✖ ${e}`);
  const summary = Object.entries(verified).map(([d, n]) => `${d} ${n}`).join(', ');
  console.log(`${questions.length} questions · verified: ${summary}`);
  if (errors.length) {
    console.error(`✖ ${errors.length} error(s)`);
    process.exit(1);
  }
  console.log('✔ Question bank is valid');
}
