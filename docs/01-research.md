# Research Findings

Research conducted August 2026 against current sources.

---

## 1. Official rules — USA Pickleball 2026 Rulebook

The current governing document is the **USA Pickleball Official Rulebook, 2026 edition**, effective
**January 1, 2026**. Verified changes from the previous edition:

| Change | What it means |
|---|---|
| **Volley serve** | The word "clearly" was added to all three requirements — contact clearly below the waist, paddle head clearly below the wrist, clearly upward arc. Referees may now fault a borderline serve instead of giving the server benefit of the doubt. |
| **Rally scoring** | Now formalized in the rulebook, including approved rally-scoring match formats. |
| **Out calls** | Must be made promptly once the ball is dead, or the call is not recognized. |
| **Visible second ball** | Having a second ball visible during a live rally is now an official fault. |
| **Wheelchair / adaptive play** | New dedicated rules for sanctioned play, developed with the wheelchair community. |
| **Player conduct** | Expanded authority to eject or expel for violence causing injury, and for venue damage. |
| **Net post** | Clarified: a ball that legally crossed and bounced is not automatically a fault if it then contacts the net post. |

### The one that changes our design

**Rally scoring being formalized** is the only 2026 change with architectural consequences. It means
the scoring configuration must treat `side_out` and `rally` as first-class peers, not treat rally as
an exotic variant. Every other change is a rule of play — relevant to the rules reference we show
players, irrelevant to the data model.

### Copyright position

The rulebook is USA Pickleball's copyrighted work. **The app must not embed the full text.** Instead:

- Store a `rule_set` record: name, governing body, edition year, effective date, canonical URL.
- Store a short list of **organizer-authored** summary points, each linking to the official source.
- Let the organizer pick which rule set a tournament runs under.

This is both legally clean and exactly the right design for versioning — a 2027 tournament points at
a 2027 rule set, and the 2026 tournament's record stays accurate forever.

**Sources:** [USA Pickleball Rules](https://usapickleball.org/rules/) ·
[2026 Change Document](https://usapickleball.org/docs/rules/USAP-Rulebook-Change-Document.pdf) ·
[The Dink summary](https://www.thedinkpickleball.com/7-new-usap-pickleball-rules-for-2026-you-need-to-know/) ·
[Selkirk summary](https://www.selkirk.com/blogs/pickleball-education/2026-usa-pickleball-rulebook-changes-key-updates-for-the-new-year)

---

## 2. DUPR integration — current state

Three ways to get results into DUPR today:

### Path 1 — Partner API
DUPR runs a partner program. Integrated partners include Pickleball.com, Scoreholio, PlayByPoint,
Pickleheads, and Main Court (which launched full integration in July 2026). A club inserts its Club
ID into partner software and results flow back automatically.

There is public API surface at `api.dupr.gg/api-explorer` and an events documentation site, but
**becoming a partner requires contacting `clubs@mydupr.com` and being approved.** That timeline is
outside our control, which makes it unsuitable as a launch dependency.

### Path 2 — CSV import
Club directors download a template, fill in match rows, and upload. **No approval required.** This is
the path we build.

### Path 3 — Manual entry
Add matches one at a time in the club dashboard. Our export doubles as a worksheet for this.

### Hard constraint discovered

> **Every participant in a submitted match must have a DUPR ID** for the result to process.

Expect many club players to have none. This is not an edge case — it is the normal state of a
casual club roster. So:

- `player.dupr_id` is nullable.
- The export computes per-match eligibility and **reports exactly which matches can't be submitted
  and which player is missing an ID**, rather than silently dropping rows.

### Conclusion

Build the CSV export now. Model submissions as an `external_result_submission` record so the partner
API becomes a second adapter behind the same interface later, with no data reshaping. **The
tournament must be fully usable with DUPR switched off entirely.**

**Sources:** [DUPR Club Resources](https://www.dupr.com/club-resources) ·
[DUPR integration FAQs](https://www.dupr.com/post/pickleball-tournaments-and-pickleball-brackets-integration-with-dupr---faqs) ·
[Pickleball Brackets DUPR manual](https://www.manula.com/manuals/pickleball-brackets/pbmanual/1/en/topic/dupr-integration-faq) ·
[Main Court × DUPR, July 2026](https://maincourt.com/2026/07/08/main-court-dupr-integration/)

---

## 3. Existing platform comparison

Five platforms evaluated against the stated requirements.

| Requirement | Global Pickleball Network | Swish Tournaments | Pickleball Brackets / KeepaScore | Pickleball Den | LeagueLobster |
|---|---|---|---|---|---|
| Cost | Free | Free registration tier | ~$100/mo tiers | Paid | Paid tiers |
| Doubles | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multiple groups / pools | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multiple stages | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Round robin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Single elimination | ✅ | ✅ | ✅ | ✅ | ✅ |
| Double elimination | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| RR → knockout with crossover | ⚠️ opinionated | ✅ | ✅ | ✅ | ⚠️ |
| **Custom points-to-win per stage** | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| **Organizer-defined tiebreaker order** | ❌ | ❌ | ⚠️ | ⚠️ | ❌ |
| **Custom qualification rules** | ❌ | ❌ | ❌ | ❌ | ❌ |
| Mobile public view | ✅ | ✅ | ✅ | ✅ | ✅ |
| QR / no-account player access | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Organizer score entry | ✅ | ✅ | ✅ | ✅ | ✅ |
| Scheduling | ✅ | ✅ | ✅ | ✅ | ✅ |
| DUPR | ✅ | ✅ auto-upload | ✅ | ✅ | ❌ |
| Export | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ✅ CSV |
| Public API | ❌ | ❌ | ❌ | ❌ | ⚠️ |
| Customization | Low | Medium | Medium | Medium | Low |

✅ supported · ⚠️ partial or constrained · ❌ not supported

### Honest assessment

**The Pakangers tournament is not a reason to build anything.** Every platform in this table runs
"two pools, top two advance, crossover semifinals, third place, final" without workarounds, and two
of them do it for free. If the only goal were this event, the correct answer would be Global
Pickleball Network, this week, done.

**The reusability goal is a reason to build.** The three rows in bold are where all five platforms
are weak or absent — and those three rows are precisely what the requirements emphasize. Per-stage
scoring, organizer-ordered tiebreakers, and arbitrary qualification wiring are fixed assumptions in
every existing product. That is the gap.

Secondary factors: these platforms are built around sanctioned-event registration and payment flows,
which add friction for a small club running a private event; and none offers an API or full data
export, so the club's own tournament history stays locked in someone else's system.

---

## 4. Recommendation

**Option C — custom PWA — with Option A held as an explicit fallback.**

| Criterion | Assessment |
|---|---|
| Exact requirements | Only a custom build satisfies configurable tiebreakers + qualification + per-stage scoring. |
| Reliability | Lower than a mature platform on day one. Mitigated by dry runs, paper backup, and the fallback. |
| Cost | Supabase and Vercel free tiers cover an event this size. Effectively $0. |
| Setup effort | High for the first tournament, near-zero for every one after (templates). |
| Flexibility | The entire point. Unmatched by any option. |
| Future tournaments | Improves with each one. Existing platforms stay static. |
| Organizer usability | Can be tuned to exactly how you run events, rather than a generic flow. |
| Player experience | Simpler than existing platforms — one link, no account, no upsell. |
| DUPR workflow | CSV export is equivalent to what most platforms offer anyway. |
| Maintenance | Modest: occasional dependency updates. No servers to babysit. |

**The fallback is not a formality.** If the engine and the five core screens are not dry-run tested
before the event date, run the tournament on Global Pickleball Network and continue building. That
decision gets made in advance, calmly — never at the venue.

---

## 5. Algorithms

### Round robin — circle method
For *n* teams: if *n* is odd, add a BYE to make it even. Fix one team in place and rotate the rest
around it. This yields **n−1 rounds of n/2 matches**, each team playing exactly once per round, each
pair meeting exactly once.

A 5-team pool becomes 5 rounds with one team idle each round — the idle slot *is* the rest period,
which is why odd pools are fine rather than a problem to be engineered around.

### Elimination bracket
Pad the entrant count up to the next power of two with byes. Standard seeding pairs seed *i* against
seed *2^k + 1 − i*, which keeps the top seeds apart until the late rounds. Byes are assigned to the
highest seeds.

### Standings
Computed, **never stored as truth**. A pure function of `(completed matches, ordered tiebreaker
list)`. Head-to-head is evaluated as a mini-table over only the tied teams, and must fall through to
the next criterion when three or more teams form a circular tie.

### Scheduling
With a handful of courts and ten or fewer teams this is greedy assignment with constraint checks —
no team in two concurrent matches, respect minimum rest — not an optimization problem. Kept as an
isolated module so it can be replaced later without touching the engine.

---

## 6. Common pickleball tournament formats

| Format | Build now? | Notes |
|---|---|---|
| Round robin | **Yes** | The first tournament's pool stage. |
| Single elimination | **Yes** | The first tournament's knockout stage. |
| Round robin → knockout | **Yes** | Composition of the two above, via stage wiring. |
| Pool play → knockout | **Yes** | Same as above with multiple groups. |
| Double elimination | Design for | Needs a losers bracket; `bracket_node.loser_to_node_id` already exists for it. |
| Consolation / back-draw | Design for | Same mechanism as double elimination. |
| Swiss | Design for | Pairing by current record; format-registry addition. |
| Ladder / king of the court | Later | Popular recreationally, structurally different. |
| Shuffle / mixer (rotating partners) | Later | Breaks the fixed-team assumption; would need per-match partner assignment. |

The format registry interface means each of these is a **new file**, not a change to the engine.
