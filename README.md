# Turan Math

SAT Math practice testing in a Bluebook-style environment. Professors put
students into **rooms** (classrooms). In each room they run **quizzes**, each a
44-question **test** that is either drawn at random from the question bank
following the digital SAT blueprint, or hand-picked, and assign **homework**
that students hand in as files and the professor grades and answers.

**Stack:** Next.js 15 (App Router, TypeScript), PostgreSQL, Prisma 7, Tailwind CSS 4,
KaTeX (math rendering), Desmos (graphing calculator).

## Run with Docker (app + PostgreSQL)

Requires Docker with Compose v2. Nothing else needs to be installed.

```bash
cp .env.example .env            # set SESSION_SECRET and ADMIN_PASSWORD
docker compose up -d --build    # http://localhost:3000
```

On every start the app container waits for PostgreSQL, applies pending
migrations, makes sure the skill taxonomy and admin account exist, and then
serves. All of these steps are idempotent. Database data lives in the `pgdata`
Docker volume.

| Setting (`.env`) | Default | Notes |
|---|---|---|
| `SESSION_SECRET` | required | 32+ random characters (`openssl rand -hex 32`) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / required | Admin created on first start; the password is never overwritten later |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `turan` / `turan` / `turan_math` | Use URL-safe characters in the password |
| `POSTGRES_PORT` | `5432` | Published on 127.0.0.1 only, for `npm run dev` and DB tools |
| `APP_PORT` | `3000` | |
| `COOKIE_SECURE` | `false` | Set `true` once served over HTTPS; over plain http it must stay `false` or login fails |
| `SEED_SAMPLE_QUESTIONS` | `false` | `true` loads ~760 synthetic "[Sample]" questions (dev only) |
| `NEXT_PUBLIC_DESMOS_API_KEY` | demo key | Baked in at build time: rebuild after changing |

Common commands:

```bash
docker compose logs -f app            # follow app logs
docker compose up -d --build          # deploy a new version (migrations run automatically)
docker compose exec db psql -U turan turan_math
docker compose down                   # stop (data kept)
docker compose down -v                # stop and DELETE all data
```

Bulk-import a large question file into the running stack (uses your local Node.js against the published DB port):

```bash
DATABASE_URL=postgresql://turan:turan@localhost:5432/turan_math npx tsx scripts/import-questions.ts questions.json
```

## Local development

```bash
cp .env.example .env
docker compose up -d db         # PostgreSQL only (or point DATABASE_URL at your own)
npm install
npm run db:migrate              # apply migrations
npm run db:seed:samples         # OPTIONAL: 760 synthetic "[Sample]" questions
npm run dev                     # http://localhost:3000
```

The dev server also creates the skill taxonomy and admin account on start
(`npm run db:seed` does the same on demand).

| Script | Purpose |
|---|---|
| `npm test` | Unit tests (blueprint selection, grading) |
| `npm run lint` | Type-check |
| `npm run db:migrate:dev -- --name <change>` | Create a new migration after editing `prisma/schema.prisma` |
| `npx tsx scripts/import-questions.ts file.json` | Bulk-import a very large question file from the CLI |

## Roles

| Role | Can |
|---|---|
| **Admin** | Everything a professor can, plus: manage professors, create/edit/retire/import questions |
| **Professor** | Create students, create rooms, assign/move students between rooms, generate or hand-build tests, create/start/schedule quizzes and monitor them live, release results, assign and grade homework |
| **Student** | See only the rooms they are assigned to and the quizzes and homework in them; take quizzes; hand in homework; see quiz results once released and homework grades/responses once given |

Students never see other students, other rooms, other students' submissions, or
answer keys. Every page, server action and file download re-checks the session
role and room membership on the server.

## Rooms, quizzes and homework

A **room** is a classroom (a group of students); its page has tabs for
Students, Quizzes, Homework and Settings.

**Quizzes** have no fixed time. A new quiz waits until the professor presses
**Start quiz**: students in the room see it immediately and get **5 minutes**
(`LOBBY_MINUTES` in `src/lib/timing.ts`) to enter the lobby, then module 1 begins
for everyone. Scheduling a start time instead is optional (when creating the
quiz, or later from the quiz page); a scheduled quiz can be started early,
rescheduled or cancelled until it begins. Unstarted quizzes are invisible to
students. Default length: **27 minutes per module**.

**Homework** has a title, instructions (Markdown + LaTeX), optional attached
files, a due date, points, the accepted file formats (PDF, images, Word, Excel,
PowerPoint, text, ZIP and/or custom extensions; none = any) and whether late
hand-ins are accepted. Students hand in up to 10 files (15 MB each) plus a
note, and can replace the hand-in until it is graded. The professor grades
each submission with a score and/or a written response with optional files;
grading locks the submission, and **Reopen for resubmission** unlocks it (even
past the due date). Files are stored in PostgreSQL and served by
`/api/files/:id` only to staff and to the students entitled to them.

## Test format

* 2 modules × 22 questions, `moduleMinutes` per module (default 27).
* **Fixed start:** module 1 opens for everyone at the quiz's start time and closes
  for everyone `moduleMinutes` later. A student who finishes module 1 early starts
  module 2 immediately; otherwise module 2 starts when module 1 closes. Students
  can't return to module 1.
* Timers are enforced on the server; late answers are rejected and expired modules
  are closed automatically.
* Bluebook-style UI: question navigator, Mark for Review, answer eliminator (ABC),
  Check Your Work page, Answer Preview for grid-ins, reference sheet, timer that
  can be hidden (except in the last 5 minutes), and the Desmos calculator when the
  quiz allows it.
* Results (estimated 200–800 score, raw score, per-domain breakdown, per-question
  review with explanations) stay hidden from students until the professor
  releases them.

### Random selection blueprint (`src/lib/blueprint.ts`)

| Domain | Module 1 | Module 2 | Total |
|---|---|---|---|
| Algebra | 8 | 7 | 15 |
| Advanced Math | 7 | 8 | 15 |
| Problem-Solving & Data Analysis | 4 | 3 | 7 |
| Geometry & Trigonometry | 3 | 4 | 7 |

Each module: 7 easy / 8 medium / 7 hard, ordered easier → harder with domains
interleaved; 6 student-produced responses at random positions; skills spread
out within each domain. Selection uses `ORDER BY random()` on indexed
`(active, domain, difficulty, type)` subsets, so it stays fast with hundreds of
thousands of questions. If an exact combination runs short, it falls back to the
other question type, then the neighbouring difficulty, always within the same
domain. Difficulty is not adaptive (both modules use the same mix).

Every student in a quiz gets the same test so results are comparable
question by question.

## Data model (`prisma/schema.prisma`)

```
User ──< RoomMember >── Room ──< Quiz ──> Test ──< TestItem >── Question >── Skill
                         │        │
                         │        └──< Attempt ──< Response >── TestItem
                         │
                         └──< Homework ──< HomeworkSubmission
                                 └──── StoredFile ────┘
```

| Table | Notes |
|---|---|
| `User` | `role` ∈ ADMIN / PROFESSOR / STUDENT; bcrypt `passwordHash`; `active` flag; `createdBy` |
| `Skill` | The 19 College Board SAT Math skills, each in one `Domain` |
| `Question` | `domain`, `skill`, `difficulty` (EASY/MEDIUM/HARD), `type` (MCQ/SPR), Markdown+LaTeX `stem`, `choices` (JSON, MCQ), `correctChoice` (MCQ), `sprAnswers[]` (SPR), `explanation`, unique `externalId` for idempotent imports, `active` (retired questions are never drawn) |
| `Asset` | Uploaded figures (bytea), served at `/api/assets/:id` to signed-in users |
| `Test` | A fixed 44-question form; `source` AUTO or MANUAL; reusable across quizzes |
| `TestItem` | `(test, module, position) → question`; a question appears once per test |
| `Room` | A classroom: `name`, `description` |
| `RoomMember` | Student ↔ room assignment (a student can be in several rooms) |
| `Quiz` | One sitting in a room: `title`, `startsAt` (null until started/scheduled), `moduleMinutes`, `calculatorAllowed`, `resultsReleased`, `test` |
| `Attempt` | One per (quiz, student): status, module timestamps, raw/scaled scores |
| `Response` | One per (attempt, item): `answer`, `markedForReview`, `eliminated[]`, `isCorrect` (set at grading) |
| `Homework` | Per room: `title`, `instructions`, `dueAt`, `allowedFormats[]` (extensions; empty = any), `maxPoints`, `allowLate` |
| `HomeworkSubmission` | One per (homework, student): `note`, `submittedAt`, `late`, `score`, `feedback`, `gradedAt`, `reopened` |
| `StoredFile` | Uploaded homework files (bytea): assignment attachments, student files, or files in the professor's response |

## Question bank

Admins can add questions one by one (live preview, figure upload) or import JSON
/ CSV at **Question bank → Import**. The import page documents the format; in short:

```json
{ "externalId": "src-123", "domain": "ALGEBRA", "skill": "LIN_EQ_1VAR",
  "difficulty": "MEDIUM", "type": "MCQ", "stem": "If $3x+5=20$, what is $x$?",
  "choices": {"A": "$3$", "B": "$5$", "C": "$15$", "D": "$25$"}, "answer": "B" }
```

SPR answers are a list of accepted strings; equivalent fractions/decimals and
Bluebook's rounding/truncation rules are accepted automatically
(`src/lib/grading.ts`).

### Importing from the College Board SAT Suite Question Bank

`scripts/cbqb/scrape.ts` downloads SAT Math questions from
satsuitequestionbank.collegeboard.org and converts them (MathML → LaTeX,
inline SVG/images → figure files) into the import format. Run it on your own
machine; the output goes to `data/` (git-ignored, College Board content):

```bash
npm run cbqb:scrape -- --limit 20      # test run; add --probe to inspect the raw API
npm run cbqb:scrape                    # everything (cached in data/cbqb/raw, re-runs resume)
npx tsx scripts/import-questions.ts data/cbqb/questions.json --figures data/cbqb/figures
```

The question bank has no public API contract; if it changes, `--probe` shows
what it returns and `ENDPOINTS` / `normalizeItem()` in the script need updating.
Check College Board's terms of use for how you may use the questions.

To remove the dev sample questions:
`DELETE FROM "Question" WHERE "externalId" LIKE 'sample-%';` (only if no test uses them).

## Desmos

`NEXT_PUBLIC_DESMOS_API_KEY` defaults to Desmos' public demo key, which is for
development only. Request a production key at https://www.desmos.com/api.
