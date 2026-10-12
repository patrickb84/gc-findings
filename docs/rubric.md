# Reading rubric

Every finding: an exact `quote` of 40 words or fewer from the talk, the right `type`, `basis`, and for `interpreted` a one-line `note` saying what Claude read. Ids `c-1`, `c-2`... per talk. Never edit `x-` findings except `type`, `note`, `detail`, `terms`.

## Talk-level fields

| Field | Rule |
|---|---|
| `summary` | Three sentences: what it teaches, the main story or image, what it asks. Plain words |
| `audience` | `who` in plain words; `quote` only when the speaker names the audience ("my young friends") |
| `arc` | The beats in order, from: story, principle, scripture, quote, list, invitation, promise, testimony. Repeat a beat if it recurs |
| `orientation` | Rough share (sums to 1) of past (history, pioneers, ancestors, scripture events), present, future (Second Coming, eternity, "the days ahead") |

## Finding types

| Type | Include when | `detail` |
|---|---|---|
| `invitation` | The speaker asks the listener to act: "I invite", "I urge", "let us", "will you", "I plead" | `{ "action": "<verb phrase>" }` |
| `promise` | The speaker assures a blessing or outcome: "I promise", "you will", "as you ..., you will" | `{ "blessing": "<what>" }`; set `paired_with` on the invitation it answers |
| `list` | Enumerated items: "three things", numbered or ordinal lists | `{ "count": "<n>", "items": ["..."], "purpose": "<what the list is for>" }` |
| `testimony` | A formal witness, usually the closing "I testify" / "I bear witness" | `{ "of": "<what is testified of>" }` |
| `revelation` | A statement that reads as prophetic, revelatory, or newly announced direction. `basis` interpreted; `note` starts "Reads as" | `{ "kind": "prophecy" or "direction" or "warning" }` |
| `prophet` | Quotes or cites President Dallin H. Oaks (current Church President) | `{ "source": "<talk or event>" }` |
| `past_prophet` | Quotes or cites a previous Church President (Russell M. Nelson, Thomas S. Monson, Gordon B. Hinckley, ... Joseph Smith) | `{ "who": "<name>" }` |
| `christ` | Words of Jesus Christ quoted from scripture | `{ "where": "<reference>" }` |
| `source` | Any other quoted voice: apostles, authors, hymns, poets, friends | `{ "who": "<name>" }` |
| `story` | A narrative with people and events | `{ "story_type": "personal" or "family" or "scripture" or "church history" or "missionary" or "other", "about": "<one line>" }` |
| `relationship` | A named relationship in a story: "my wife, who passed away" | `{ "who": "<relation>", "state": "living" or "deceased" or "unknown" }` |
| `image` | A concrete picture used to teach: boat, water, light, path, rock, seed, fruit, building, race | `{ "image": "<noun>", "family": "water" or "light" or "path" or "rock" or "growth" or "building" or "body" or "other", "carries": "<the teaching it carries>" }` |
| `place` | A named place | `{ "place": "<name>", "country": "<country>" }` |
| `name_of_christ` | A title or name used for Christ other than "Jesus Christ" and "the Savior" | `{ "name": "<title>" }` |

Code-written `source` findings (`x-n...`) that cite the current President become `prophet`; previous Presidents become `past_prophet`.
