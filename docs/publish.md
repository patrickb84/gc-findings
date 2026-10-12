# Publishing to Notion

The JSON in `data/` is the source of truth. Notion is a view of it. Patrick's own notes live only in Notion, in the **My notes** property.

## The re-publish rule

Follow this on every run after the first.

1. **Look the row up before writing it.**
   - Talks: `data/notion-map.json` → `rows["talk:<slug>"]`.
   - Findings: query the Findings data source for `"Finding ID" = '<slug>/<id>'`. It is unique.
   - Index: query the Index data source for `"Term" = '<term>'`. It is unique.
2. **Found it?** Update its properties in place. **Not found?** Create it, and add talk rows to `rows` in the map.
3. **Never send My notes.** Leave it out of every create and every update, so Patrick's notes are never overwritten.
4. **Never touch Status on an Index row that is `approved` or `rejected`.** Those are Patrick's calls. Only `discovered` and `proposed_family` are written by code.
5. **A finding is gone from the JSON?** Don't delete its row. List it in the run report and let Patrick decide, because the row may carry his notes.
6. **Re-run the "What I found" page** from `data/discoveries.json`: replace the page's content, with evidence as page mentions of the Findings rows.

Finding and Index row ids are not stored in the map. Their `Finding ID` and `Term` properties are the keys, so the map stays small and can't drift from Notion.

## Where things live

- Root page: `GC October 2026` (private). Its id is in `notion-map.json` → `page`.
- Databases and data sources: `notion-map.json` → `databases`.
- Views: `notion-map.json` → `views`.
- The "What I found" page: `notion-map.json` → `pages.whatIFound`.

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
| Findings | relation | back-relation of Findings → Talk |
| My notes | text | **Patrick only. Never written.** |

**Page body:**
1. Summary, Who it addresses, and Shape (the arc).
2. An inline linked view of Findings, filtered to this talk and grouped by Type.

## Findings

| Property | Type | From |
|---|---|---|
| Quote | title | `quote` |
| Finding ID | text | `<talk>/<id>` (unique key) |
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

**Views:**
- **Themes:** sorted by Talks touched desc, then Mentions desc.
- **Families to approve:** Status = proposed_family, grouped by Kind.
