# Publishing to Notion

The JSON in `data/` is the source of truth. Notion is a view of it. Patrick's own notes live only in Notion, in the **My notes** property.

## The re-publish rule

Follow this on every run after the first.

1. **Look the row up before writing it.**
   - Talks: `data/notion-map.json` → `rows["talk:<slug>"]`.
   - Highlights: query the Highlights data source for `"Highlight ID" = '<slug>/<id>'`. It is unique.
   - Index: query the Index data source for `"Term" = '<term>'`. It is unique.
2. **Found it?** Update its properties in place. **Not found?** Create it, and add talk rows to `rows` in the map.
3. **Never send My notes.** Leave it out of every create and every update, so Patrick's notes are never overwritten.
4. **Never touch Status on an Index row that is `approved` or `rejected`.** Those are Patrick's calls. Only `discovered` and `proposed_family` are written by code.
5. **A finding (highlight) is gone from the JSON?** Don't delete its row. List it in the run report and let Patrick decide, because the row may carry his notes.
6. **Re-run the "What I found" page** from `data/discoveries.json`: replace the page's content, with evidence as page mentions of the Highlights rows.

Highlight and Index row ids are not stored in the map. Their `Highlight ID` and `Term` properties are the keys, so the map stays small and can't drift from Notion.

## Where things live

- Root page: `GC October 2026` (private). Its id is in `notion-map.json` → `page`.
- Databases and data sources (Talks, Highlights, Index, Scriptures): `notion-map.json` → `databases`.
- Views: `notion-map.json` → `views`.
- The "What I found" page: `notion-map.json` → `pages.whatIFound`.
- The "To do" page: `notion-map.json` → `pages.todo`. Everything that needs Patrick (rows to delete, families to approve, decisions) goes here as a checkbox at the end of each run. Claude never ticks them.

**When SQL queries are out of quota,** use `query_data_sources` in view mode on a saved view (it has no quota) and page through with `next_cursor`. To look rows up by key, use rows mode with a filter, for example `"Highlight ID"` `string_is` `16hathaway/x-s29` (up to 100 rows per call).

**Checking Highlights counts:** query the Talks "In order" view 12 rows at a time (more rows exceeds Notion's 1000-mention limit) and count each talk's Highlights relation against `findings.length` in its JSON.

## Talks

| Property | Type | From |
|---|---|---|
| Name | title | `<title> (<speaker>)` |
| Talk ID | text | slug, for example `49oaks` |
| Kind | select: talk, hymn | |
| Speaker | text | |
| Role | text | |
| Session | select | manifest session |
| Order | number | manifest order |
| Audience | text | `audience.who` |
| Arc | text | beats joined with ` > ` |
| Summary | text | |
| I / We / You | text | pronoun counts, `i / we / you` |
| Link | url | Gospel Library URL |
| Highlights | relation | back-relation of Highlights → Talk |
| My notes | text | **Patrick only. Never written.** |

**Page body:**
1. Summary, Who it addresses, and Shape (the arc).
2. An inline linked view of Highlights ("Highlights in this talk"), filtered to this talk and grouped by Type.

## Highlights

In Notion, findings are called **Highlights** (plainer for readers). The code and JSON keep the word `findings`.

| Property | Type | From |
|---|---|---|
| Quote | title | `quote` |
| Highlight ID | text | `<talk>/<id>` (unique key) |
| Type | select | the 15 finding types |
| Basis | select: exact, interpreted | |
| Note | text | `note` |
| Ref | text | `ref` |
| In talk text | checkbox | `spoken` (scripture findings) |
| Detail | text | `key: value \| key: value`, list values joined with `; ` |
| Paired with | text | the paired promise's quote |
| Talk | relation | → Talks |
| My notes | text | **Patrick only. Never written.** |

**Views:**

| View | Filter | Grouping and sort |
|---|---|---|
| Testimonies | Type = testimony | grouped by Talk |
| Invitations -> Promises | Type in (invitation, promise) | grouped by Talk, shows Paired with |
| Scriptures | Type = scripture | grouped by In talk text |
| Prophets | Type in (prophet, past_prophet, christ) | grouped by Type |
| Stories | Type in (story, relationship) | grouped by Talk |
| Images | Type = image | sorted by Detail, so families cluster |
| Lists | Type = list | |
| Interpreted only | Basis = interpreted | grouped by Type |

## Index

| Property | Type | From |
|---|---|---|
| Term | title | `term` (unique key) |
| Kind | select: keyword, subject, image | |
| Status | select: discovered, proposed_family, approved, rejected | |
| Mentions | number | empty for subject families |
| Talks touched | number | `talks.length` |
| Variants | text | joined with `, `; if `exclude` is set, add ` (not: <exclude joined with , >)` |
| Talks | relation | → Talks |

**What gets published:**
- Every curated entry.
- The top 50 discovered terms.
- Any term already in Notion that has fallen out of the top 50: its counts are refreshed, never left stale, and the row is not deleted.

**Subjects are not recounted by code.** `kind: subject` families come from reading, so every time new talks are read, check each subject against them by hand, add the talks that fit, and propose new subjects that span 2+ talks.

**Views:**
- **Themes:** sorted by Talks touched desc, then Mentions desc.
- **Families to approve:** Status = proposed_family, grouped by Kind.

## Scriptures

One row per passage from `data/passages.json` (`pnpm scriptures`).

**How citations are grouped into a passage:**
- Citations that share a verse, directly or through another citation, are one passage, across talks. For example, Alma 7:11 and Alma 7:11–12 are one passage.
- A one-chapter citation (Isaiah chapter 58) pulls in the verses inside it.
- A citation of several chapters (3 Nephi 11–28) points at a whole section, so it stays on its own.
- Next-door verses (Alma 34:32 and 34:33) are separate passages. They share a Chapter.

| Property | Type | From |
|---|---|---|
| Passage | title | `label`, unique key |
| Volume | select | `volume`; `Unknown` when null |
| Book | text | `book` (empty when the volume is unknown) |
| Chapter | text | label up to the `:`, or the whole label for a chapter citation |
| Citations | number | `citations.length` |
| Talks touched | number | `talks.length` |
| Talks | relation | → Talks |
| Cited as | text | `refs` joined with `; ` |
| Order | number | canon order, 1-based |

**Re-publishing:**
- Look a row up by `"Passage" = '<label>'` and update it in place.
- A passage label can change when new talks merge two passages. When that happens, update the old row to the new label, and list labels with no row left in the run report. Don't delete rows.
- Existing rows keep their Order. New rows get a fractional Order between their canon neighbours, so the table stays in canon order without renumbering every row.
- Only rows whose properties changed since the last publish are updated, so compare against the commit that was last published.

**Views:**

| View | Filter | Sort or grouping |
|---|---|---|
| Shared across talks | Talks touched > 1 | sorted by Talks touched, then Citations (both desc) |
| In canon order | | grouped by Volume, sorted by Order |
| By chapter | | grouped by Chapter |
| Most cited | | sorted by Citations desc |
