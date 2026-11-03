# Turan Math

SAT Math practice testing in a Bluebook-style environment. Professors schedule
**rooms** (fixed-start sittings), put students in them, and attach a 44-question
**test** that is either drawn at random from the question bank following the
digital SAT blueprint, or hand-picked.

**Stack:** Next.js 15 (App Router, TypeScript), PostgreSQL, Prisma 7, Tailwind CSS 4,
KaTeX (math rendering), Desmos (graphing calculator).

## Quick start

```bash
cp .env.example .env            # then edit SESSION_SECRET and ADMIN_PASSWORD
docker compose up -d            # or point DATABASE_URL at your own Postgres
npm install
npm run db:migrate              # apply migrations
npm run db:seed                 # SAT skill taxonomy + the admin account
npm run db:seed:samples         # OPTIONAL, dev only: 760 synthetic "[Sample]" questions
npm run dev                     # http://localhost:3000
```

Production: `npm run build && npm start`.

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
| **Professor** | Create students, create rooms, assign/move students between rooms, generate or hand-build tests, monitor live rooms, release results |
| **Student** | See only the rooms they are assigned to; take the test; see their results once released |

Students never see other students, other rooms, or answer keys. Every page and
server action re-checks the session role and room membership on the server.

## Test format

* 2 modules × 22 questions, `moduleMinutes` per module (default 22).
* **Fixed start:** module 1 opens for everyone at the room's start time and closes
  for everyone `moduleMinutes` later. A student who finishes module 1 early starts
  module 2 immediately; otherwise module 2 starts when module 1 closes. Students
  can't return to module 1.
* Timers are enforced on the server; late answers are rejected and expired modules
  are closed automatically.
* Bluebook-style UI: question navigator, Mark for Review, answer eliminator (ABC),
  Check Your Work page, Answer Preview for grid-ins, reference sheet, timer that
  can be hidden (except in the last 5 minutes), and the Desmos calculator when the
  room allows it.
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

Every student in a room gets the same test so results are comparable
question by question.

## Data model (`prisma/schema.prisma`)

```
User ──< RoomMember >── Room ──> Test ──< TestItem >── Question >── Skill
                         │
                         └──< Attempt ──< Response >── TestItem
```

| Table | Notes |
|---|---|
| `User` | `role` ∈ ADMIN / PROFESSOR / STUDENT; bcrypt `passwordHash`; `active` flag; `createdBy` |
| `Skill` | The 19 College Board SAT Math skills, each in one `Domain` |
| `Question` | `domain`, `skill`, `difficulty` (EASY/MEDIUM/HARD), `type` (MCQ/SPR), Markdown+LaTeX `stem`, `choices` (JSON, MCQ), `correctChoice` (MCQ), `sprAnswers[]` (SPR), `explanation`, unique `externalId` for idempotent imports, `active` (retired questions are never drawn) |
| `Asset` | Uploaded figures (bytea), served at `/api/assets/:id` to signed-in users |
| `Test` | A fixed 44-question form; `source` AUTO or MANUAL; reusable across rooms |
| `TestItem` | `(test, module, position) → question`; a question appears once per test |
| `Room` | `startsAt`, `moduleMinutes`, `calculatorAllowed`, `resultsReleased`, `test` |
| `RoomMember` | Student ↔ room assignment (a student can be in several rooms) |
| `Attempt` | One per (room, student): status, module timestamps, raw/scaled scores |
| `Response` | One per (attempt, item): `answer`, `markedForReview`, `eliminated[]`, `isCorrect` (set at grading) |

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

To remove the dev sample questions:
`DELETE FROM "Question" WHERE "externalId" LIKE 'sample-%';` (only if no test uses them).

## Desmos

`NEXT_PUBLIC_DESMOS_API_KEY` defaults to Desmos' public demo key, which is for
development only. Request a production key at https://www.desmos.com/api.
