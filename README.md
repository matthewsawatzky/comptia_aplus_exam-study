# IT Quiz App

A lightweight browser-based quiz app for practicing IT fundamentals and CompTIA A+ style questions.

The project is built as a static frontend with JSON question files, so it can run locally without a build system, backend, database, or package install. It is designed for short study sessions with immediate feedback, answer explanations, and local progress tracking.

## Features

- Practice questions for hardware, networking, security, operating systems, and troubleshooting
- CompTIA A+ Core 1 and Core 2 style content
- Multiple question types: single choice, multiple choice, drag/drop matching, drag/drop ordering, and fill-in-the-blank
- Immediate scoring and explanations after each answer
- Category selection for focused study sessions
- Local profile, streaks, recent sessions, progress history, and weak-question tracking
- JSON-based question bank that is easy to edit or regenerate
- Helper scripts for generating AI prompts and merging new question data

## Quick Start

This app is deployed as a static site on GitHub Pages:

```text
https://it-quiz.orboul.com/
```

It must be hosted (not opened via `file://`) because it loads JSON question data using `fetch` and relies on relative paths. Some browsers will block or mis-resolve these requests when you open files directly from disk.

If you want to run it locally, use any static file host. For example:

```bash
python3 -m http.server 8000
```

Then open `http://127.0.0.1:8000/`.

## Requirements

- A modern web browser
- A static page host (GitHub Pages works)
- `jq` only if you use the question merge helper

There is no npm install, frontend build step, or backend service required.

## Project Structure

```text
.
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── data.js
│   ├── question-repo.js
│   ├── scoring.js
│   ├── session.js
│   ├── storage.js
│   ├── utils.js
│   └── views.js
├── data/
│   └── questions/
│       ├── hardware.json
│       ├── networking.json
│       ├── os.json
│       ├── security.json
│       └── troubleshooting.json
├── question-gen/
│   ├── make_question_prompt.sh
│   ├── merge_questions.sh
│   ├── question_maker.md
│   └── question_templates.md
├── schema-spec.md
```

## Question Data

Questions are stored in `data/questions/` and split by category. Each category file has this shape:

```json
{
  "schema_version": 1,
  "category": "hardware",
  "questions": []
}
```

Each question includes shared fields such as `id`, `type`, `category`, `subcategory`, `difficulty`, `question`, and `explanation`. Extra fields depend on the question type.

Supported question types:

- `single_choice`
- `multi_choice`
- `drag_drop` with `match` or `order`
- `fill_blank`

Question IDs use category prefixes:

| Category | Prefix | Example |
| --- | --- | --- |
| Hardware | `hw` | `hw-001` |
| Networking | `net` | `net-001` |
| Operating Systems | `os` | `os-001` |
| Security | `sec` | `sec-001` |
| Troubleshooting | `trbl` | `trbl-001` |

See `schema-spec.md` and `question-gen/question_templates.md` for the full data format.

## Generating More Questions

The `question-gen/` folder contains tools for creating prompts and merging new AI-generated question data into the existing question bank.

Create a custom prompt:

```bash
cd question-gen
./make_question_prompt.sh
```

Paste the generated prompt into an AI model. The expected result is JSON question data only, not an app, schema, or code.

Merge generated questions with the existing question set:

```bash
./merge_questions.sh ../data/questions Raw-JSON-Question/questions.json
```

The merge script writes normalized output to:

```text
question-gen/question-maker-output/data/questions/
```

The script validates required fields, separates questions by category, and renumbers IDs using the correct category prefixes.

## ALSM (Advanced Local Session Management)

This app uses **ALSM** to manage learning progress entirely in the browser.

What gets stored (client-side only):

- Profile info and streaks
- Session history
- Category averages / breakdowns
- Weak-question tracking

ALSM writes to `localStorage` under the `alsm` key.

On GitHub Pages, the only network usage is downloading the static site files (including the JSON question files). After the page loads, everything runs locally and nothing is uploaded or saved anywhere else.

## Development Notes

- The app is intentionally plain HTML, CSS, and JavaScript.
- Question loading is handled in `js/question-repo.js`.
- Scoring rules are implemented in `js/scoring.js`.
- Local progress persistence is implemented in `js/storage.js`.
- The target question schema is documented in `schema-spec.md`.

## Disclaimer

This project is for study and practice. It is not affiliated with or endorsed by CompTIA. CompTIA A+ is a trademark of CompTIA.
