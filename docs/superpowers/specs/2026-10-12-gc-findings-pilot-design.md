---
title: GC Findings - pilot design
created: 2026-10-12
status: draft, awaiting review
---

# GC Findings - pilot design

Read General Conference (October 2026) talks closely, pull out what is in them, and discover what stands out across them. Results go to Notion for browsing on a phone. A public site comes later.

**This spec covers the pilot only:** 7 or so items, every field, so we can see which fields are worth keeping before running the whole conference.

---

## Goals

1. Patrick catches up on talks he missed: one page per talk, readable in two minutes.
2. Discovery first: the system surfaces what stands out, rather than confirming a list of words chosen in advance.
3. Every finding can be checked: exact quotes are verified against the talk text; interpretations carry their quote and a link.
4. Data and views are separate: JSON is the source of truth, Notion is a view, a site can be another view later.

## Non-goals (pilot)

- The rest of the conference, and past conferences (trends come later).
- The public website.
- Notion-to-JSON sync. Edits flow one way only.

---

## Pilot items

| Rule | Items |
|---|---|
| The prophet | Every talk he gave this conference |
| First talk | Saturday morning, first speaker |
| Last talk | Sunday afternoon, last speaker. If that is the prophet, also the second-to-last talk |
| By request | Elder Ciro Schmeil's talk |
| Closing hymn | The last hymn of the last session |

The exact list is fixed in step 1 (Fetch) and written to `data/manifest.json`.

---

## Pipeline

```
1 FETCH     code    talks, footnotes, session and order; hymn lyrics and its listed scriptures
2 COUNT     code    exact: words and 1-3 word phrases, footnote scriptures, spoken vs footnote, I/we/you
3 READ      Claude  one talk at a time: the interpreted findings (types below)
4 CONNECT   Claude  across talks: word families, echoes, shared images, invitation-promise pairs
5 DISCOVER  Claude  "What I found": about 10 standouts, each linked to its evidence
6 PUBLISH   Claude  JSON -> Notion, through the Notion connector (no API token to set up)
```

Steps 1, 2 and the quote check are a small Node + TypeScript script. Steps 3 to 6 are Claude sessions working from the JSON.

---

## Data model

### Talk file - `data/talks/<order>-<speaker-slug>.json`

| Field | Holds |
|---|---|
| `id`, `kind` | `talk` or `hymn` |
| `speaker`, `role`, `session`, `order`, `url` | Who, when, where it lives |
| `summary` | Three lines, the catch-up version |
| `audience` | Who it addresses, with the quote if stated |
| `arc` | Ordered list of beats, e.g. story > principle > scripture > invitation > promise > testimony |
| `orientation` | Share of past / present / future references |
| `pronouns` | Counts of I, we, you |
| `findings` | List, below |

The hymn uses `kind: hymn`, has no speaker, role or arc, and keeps `summary`, `findings` and the scriptures the hymnbook lists for it.

### Finding

| Field | Holds |
|---|---|
| `id` | Stable within the talk |
| `type` | One of the types below |
| `quote` | Exact words from the talk. Required for every finding |
| `basis` | `exact` (quote, footnote, count) or `interpreted` (Claude's read) |
| `note` | Claude's one-line reading, for interpreted findings |
| `ref` | Scripture or source reference, when there is one |
| `spoken` | For scriptures: read aloud (`true`) or footnote only (`false`) |
| `paired_with` | Invitation to promise link |
| `detail` | Type-specific: list items, story type, relationship, image family, place |
| `terms` | Index terms this finding counts toward |

### Finding types (pilot - all of them, trimmed after review)

| Group | Types |
|---|---|
| Asked and given | `invitation`, `promise`, `list` (e.g. "X things to prepare") |
| Witness | `testimony`, `revelation` (prophetic or revelatory statement) |
| Quoted | `scripture`, `prophet` (current), `past_prophet`, `christ` (words of Christ), `source` (hymns, authors, others) |
| Stories | `story` (with story type), `relationship` (e.g. "my wife who died") |
| Texture | `image` (boat, water, light...), `place`, `name_of_christ` |

### Index - `data/index.json`

One entry per term.

| Field | Holds |
|---|---|
| `term`, `kind` | `keyword` (exact count), `subject` (interpreted), `image` |
| `variants` | Family members, e.g. peace, peacemaker, Prince of Peace |
| `mentions` | Exact count (keywords and images); empty for subjects |
| `talks` | Which talks touched it |
| `status` | `discovered`, `proposed_family`, `approved`, `rejected` |

**Discovery:** code counts every word and 1-3 word phrase, minus a stopword list, and ranks by talks touched, then mentions. Claude proposes families from that ranking. Patrick approves or rejects them on the "What I found" page. Only approved families merge counts.

**Image patterns to look for** (step 4). These are kinds of pattern, not expected results:

| Pattern | Example of the shape |
|---|---|
| Shared image across speakers | Two talks independently use water or a boat |
| Image tied to a scripture | A boat story that leans on the Jaredite barges or Peter on the water |
| Bookend | An image opens a talk and returns at its close |
| Image to doctrine | Which teaching each image is carrying (storm = trial, light = truth) |
| Image families | Water / sea / storm / boat; light / dark; path / journey; rock / foundation; seed / tree / fruit |

---

## Guardrails

1. **Quote check:** code confirms every `quote` appears verbatim in the talk text. Failures are dropped and listed in `data/rejected.json`.
2. **Interpreted findings are always labeled** and always carry their quote.
3. **Revelation and prophecy findings** are the most sensitive. They are `interpreted`, worded as "reads as", and never stated as fact.
4. **Talk text stays local.** Notion holds summaries, findings and short quotes with links, not full talk text.

---

## Notion layout

Private page **GC October 2026**:

| Piece | What it is |
|---|---|
| **What I found** | Page at the top: about 10 standouts, each linking to its rows. Proposed families listed for approval |
| **Talks** database | One row per talk or hymn; the row's page is the catch-up page (summary, audience, arc, findings grouped by type) |
| **Findings** database | One row per finding; relation to Talks. Views: Testimonies, Invitations -> Promises, Scriptures, Prophets, Stories, Images, Lists, Interpreted only |
| **Index** database | One row per term; relation to Talks; sortable by talks touched and mentions |
| **My notes** | A property on Talks and Findings that publishing never overwrites |

---

## Success criteria

1. Every pilot talk has a page Patrick can read in about two minutes and feel caught up.
2. Every Findings view opens on his phone and shows only its type.
3. 100% of published quotes pass the quote check.
4. "What I found" has about 10 items, each linked to evidence, and at least some he did not expect.
5. After review, a keep / cut list of finding types for the full-conference run.

---

## Open questions

1. Hymn lyrics source: the hymn's page on the Church site. Confirm it is reachable at fetch time.
2. If the prophet gave several talks, all are in. The manifest will show the final count.
