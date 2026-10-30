# Giddywit

A daily general-knowledge trivia game where every point carries a pixel-art rider further along a Wild West trail.

Ten questions a day, getting harder as you go (50 → 250 points). A perfect run is 1,500 points and takes the rider from the town outskirts, through the desert, the red-rock canyon and the high frontier, to the lantern-lit town at Trail's End. There's also unlimited practice.

No accounts, no backend, no API keys. It's a static website.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build it

```bash
npm run build      # validates the questions, type-checks, builds to dist/
npm run preview    # serve the production build locally
npm test           # 37 automated tests (scoring, daily selection, saving, UI)
npm run validate   # check the question bank only
```

## Deploy it

`npm run build` makes a plain static site in `dist/`: one HTML file plus assets, with relative paths (`base: './'`), so it works from a domain root or a sub-folder. You can host it anywhere that serves static files:

- **Netlify:** drag the `dist/` folder onto app.netlify.com/drop, or connect the repo with build command `npm run build` and publish directory `dist`.
- **Vercel:** import the repo. It detects Vite (build command `npm run build`, output `dist`).
- **Cloudflare Pages:** framework preset "Vite", build command `npm run build`, output `dist`.
- **GitHub Pages:** push `dist/` to a `gh-pages` branch, or use the official "Deploy static content" action with `path: dist`.
- **Your own server (nginx etc.):** copy `dist/` to the web root, for example `rsync -av dist/ user@server:/var/www/giddywit/`. No server-side code or rewrites are needed.

Once it has a public address, put it in `GAME.shareUrl` in `src/config.ts`. Shared results then link to the game even when someone plays from a different URL.

## Change the name, colours or scoring

- **Name, tagline, share link, storage prefix:** `src/config.ts` (`GAME`). Also update `<title>` and the meta tags in `index.html`.
- **Scoring:** `src/config.ts`. `DIFFICULTY_INFO` sets the points per level, and `QUESTION_SCHEDULE` sets the difficulty of each question slot. Its length is the number of questions per game. The maximum score and trail percentage are calculated from these. (If you change the schedule, also update `PER_GAME` in `scripts/validate-questions.mjs`.)
- **UI colours and fonts:** `src/styles/theme.css` (CSS variables).
- **Pixel-art colours:** `src/scene/palette.ts`. There's one palette per trail region, and the scene blends between neighbouring regions.
- **Region names and where they start:** `REGIONS` in `src/scene/world.ts`.
- **Question timer:** `QUESTION_SECONDS` in `src/config.ts` (15 by default; 0 turns it off). When it runs out the question scores 0, the right answer shows for `TIMEOUT_ADVANCE_MS`, then the game moves on. The timer pauses while How to play is open, and restarts if you leave a game and come back to it.
- **Ride animation timing:** `RIDE_DELAY_MS` and `rideDurationMs` in `src/config.ts`.

## Add or edit questions

Questions live in `src/content/questions/<difficulty>.json`, separate from the code:

```json
{
  "id": "m-025",
  "category": "Geography",
  "difficulty": "medium",
  "question": "What is the capital city of Canada?",
  "choices": [
    { "id": "a", "text": "Toronto" },
    { "id": "b", "text": "Ottawa" },
    { "id": "c", "text": "Montreal" },
    { "id": "d", "text": "Vancouver" }
  ],
  "answerId": "b",
  "explanation": "One short, interesting sentence.",
  "source": "https://en.wikipedia.org/wiki/Ottawa",
  "verification": { "status": "verified", "checkedOn": "2026-10-29", "evidence": "quote from the source" }
}
```

1. Give every question a new, never-reused `id`. Choice ids only need to be unique within the question.
2. Check the answer against the `source` yourself. Only use `"status": "verified"` when you have. Anything marked `"unverified"` stays in the file but is never played.
3. Run `npm run validate`. It catches duplicate ids, duplicate choices, missing or invalid answers, bad difficulty values and missing sources, and warns about overlong text.
4. Bump `CONTENT_VERSION` in `src/content/bank.ts`.

**The bank** has 210 questions, 42 per difficulty, across geography, science, history, nature, literature, art & music, food & drink, sport, everyday knowledge, music, chemistry, world cultures and war. The first 160 were checked on 2026-10-29 and the 50 added on 2026-10-30 (ids 033–042) on that day, each by fetching the cited source page; the quote that supports each answer is stored in `verification.evidence`. Difficulty levels are editorial estimates, not measured player data. A few questions got judgement calls: for example, "the shortest recorded war" relies on the commonly cited Anglo-Zanzibar War.

## Sounds

All sound effects are synthesised in `src/audio/sound.ts`, except the "Yee-haw!" the rider shouts after a correct expert answer. That clip is `public/sounds/yeehaw.wav`: the 6th take from [yeehaw.mp3 by chancellorbill](https://freesound.org/people/chancellorbill/sounds/507024/) on Freesound, released under CC0 (public domain, no attribution needed), trimmed and faded. Its playback volume is `YEEHAW_VOLUME` in `src/audio/sound.ts`.

## How the daily challenge works

- The day is the **UTC** date, so everyone gets the new ride at **midnight UTC**.
- Each difficulty's pool is shuffled using a seed made from `CONTENT_VERSION` and a "cycle" number. Each day takes the next slice, so a question doesn't repeat until its whole pool has been used (about 21 days with 42 per level). Answer order is also shuffled from a seed, and the correct-answer ids never change. Everyone gets the same questions in the same order.
- Changing `CONTENT_VERSION` reshuffles future days. Games already in progress keep the exact questions and answer order they were saved with.
- Progress is saved after every answer, before any animation runs. Refreshing brings back the same question, feedback and score, and an answer can never count twice.
- A finished daily opens its results instead of a new attempt. If midnight passes mid-game, you finish the ride you started, and then today's ride is offered.
- Practice is unlimited and saved separately, so it never touches daily results. It avoids today's daily questions and recent practice questions while the pools allow.

## Limitations

- **Local only.** Progress, results, best scores, streak and settings live in this browser's `localStorage`. A different device, another browser, private mode or clearing site data starts fresh. If storage is blocked, the game still works and shows a notice that progress won't be kept.
- **Scores can be edited.** Anyone can edit localStorage or read the questions in the page's JavaScript. That's fine for a personal game. There is no leaderboard, and the game doesn't pretend there is.
- **Small bank.** With 32 questions per level, daily questions start repeating after about 16 days. Add questions (and bump `CONTENT_VERSION`) to stretch that.
- Fonts load from Google Fonts. Without them it falls back to system fonts.

## Project layout

```
src/config.ts          name, scoring, timing
src/content/           question JSON + bank version
src/game/              pure logic: sessions, scoring, daily/practice selection, storage, sharing
src/scene/             canvas pixel-art world (palette, world layout, drawing, ambient life)
src/components/        screens and UI
scripts/validate-questions.mjs
tests/                 Vitest suites
```

For development, `?trail=0.75` on the start screen previews any point of the journey. This only works in dev builds.
