# Part 1 — Data Ingestion and Pipeline Architecture

**Scope:** everything from opening the exchange connection to a normalized, correct event landing on an internal queue, ready for aggregation. This is the foundation Parts 2 (storage), 4 (indicators), and 5 (scaling) all build on — get this part wrong and every downstream number inherits the error.

This file goes deeper than a general overview: it's written to be handed to a coding agent as the authoritative spec for this layer, along with an explicit diagnosis of the "hang" symptom, since that almost certainly originates here or immediately downstream of here.

---

## 1. The Connection Lifecycle

Model the connection as an explicit state machine, not an implicit "it's either connected or it isn't." Four states:

- **CONNECTING** — opening the WebSocket, waiting for confirmation.
- **SYNCING** — buffering incoming diff events without applying them, while a REST call fetches a full order-book snapshot in parallel. No data is considered valid yet.
- **LIVE** — snapshot applied, buffered diffs replayed on top of it, now applying new diffs as they arrive in real time. This is the only state where downstream consumers should trust the data.
- **RESYNCING / RECONNECTING** — triggered by a detected sequence gap (data is known to be wrong) or a dropped connection. Discard the current in-memory book, and go back to SYNCING.

Every symbol you're tracking has its own independent instance of this state machine. One symbol resyncing should never affect another symbol's LIVE state.

**Reconnection specifics:** use exponential backoff with jitter — each failed reconnect attempt waits longer than the last (e.g., 1s, 2s, 4s, 8s, capped somewhere reasonable), with a small random offset added to each wait. Without the jitter, if your process restarts and reconnects several symbols at once, or if the exchange briefly drops many clients simultaneously, every connection retries at exactly the same instant, which just recreates the same spike of load that likely caused the drop in the first place.

---

## 2. Rebuilding a Correct Order Book (Snapshot + Diff), in Full Detail

**The data structure.** Keep bids and asks as two separate lookup structures, each keyed by price, holding quantity at that price (a plain key-value map is enough — you don't need a fully sorted structure updated on every single diff). You only need a *sorted* view in two situations: rendering the visible price ladder, and finding best bid/best ask. Both of those can be served by maintaining the best bid/ask as separately-tracked running values (updated cheaply whenever a diff touches the top of book) and only sorting the full map when something actually needs the full sorted depth (e.g., a heatmap render). Re-sorting the entire book on every single diff event — which is an easy mistake to make if the update logic naively does `Object.values(book).sort(...)` inside the message handler — is a classic accidental O(n log n)-per-message cost hiding inside what should be an O(1) update, and at high message rates this alone is enough to fall behind and start queuing.

**Cold-start alignment.** When your snapshot arrives, it comes with its own "last update ID." The first buffered diff you're allowed to apply is the one whose ID range straddles that number — concretely, its first-update-ID must be less than or equal to (snapshot's last-update-ID + 1), and its last-update-ID must be greater than or equal to it. Any buffered diff older than that window gets discarded; it's already reflected in the snapshot.

**Ongoing gap detection.** Every diff after that carries the ID of the previous diff it expects to follow. Before applying a new diff, compare that "previous ID" field against the last-update-ID you actually applied. If they don't match, a message was lost somewhere between the exchange and you — your local book is now silently wrong, and the correct response is to stop applying anything further, discard the local book entirely, and drop back into SYNCING to fetch a fresh snapshot. Continuing to apply diffs to a book you know is out of sync doesn't just leave one bad value — it compounds, because every future diff assumes the previous state was correct.

**Out-of-order arrival.** This is rare but not impossible, particularly right after a reconnect. Rather than trying to buffer and re-sort incoming messages defensively (which adds complexity and its own bug surface), it's simpler and safer to rely entirely on the gap-detection check above — if something arrived out of order, the sequence check will catch it and trigger a resync, which is the correct outcome either way.

---

## 3. Where Computation Actually Runs — Almost Certainly Your Hang

This is the single most important section in this file for your current bug.

**The core fact:** Node.js runs your server-side JavaScript on one thread, exactly like the browser does for client-side JavaScript. Your earlier performance work (state-management separation, animation-frame-driven rendering, database indexing) fixed real problems, but all of it lives on the *front-end rendering* side. If the hang is still happening, the remaining bottleneck is very likely on the *back-end compute* side — something synchronous and expensive running inside your Node process's single thread, blocking it from doing anything else while it runs. That "anything else" includes: reading the next incoming trade off the exchange socket, responding to any connected client's WebSocket message, and handling any concurrent HTTP request — which is exactly the kind of global, everything-freezes-at-once symptom you're describing, and exactly why it gets worse as more is happening (more symbols live, more users connected, more indicators enabled) rather than staying constant.

**The two separate fixes — you likely need both:**

1. **Make the calculation itself cheap (algorithmic fix).** If a signal or indicator is being computed by re-scanning some window of accumulated ticks every time a bar closes or a client requests it, that's an O(n)-per-event cost that grows as the session goes on. Part 4 covers this properly, but the short version: every one of these calculations should be a running total updated by a fixed, tiny amount of work per incoming trade — never a full recompute over history. This is the highest-leverage fix, because it reduces how much work there is to block on in the first place, and it's very likely a meaningful part of why your current build hangs specifically once indicators are enabled.

2. **Move whatever's still expensive off the main thread (structural fix).** For anything that genuinely can't be made cheap enough to run inline — a full profile rebuild over a long session, a batch recalculation triggered by a user changing settings — use Node's `worker_threads` module. This is the direct server-side equivalent of a browser Web Worker: it spins up a separate OS thread with its own isolated JavaScript environment, you hand it the data it needs and it hands back a result via message-passing, and critically, your main event loop stays completely free the whole time it's working. Worker threads exist specifically for CPU-bound work like this — they're not useful for I/O (Node's own async I/O already handles that efficiently), but they're the correct tool for exactly the kind of "heavy synchronous math" that signal/indicator calculation involves.

**How to confirm this before you build around it:** don't take this as a guess to design blindly against — verify it. Time how long a single indicator calculation actually takes on your busiest symbol during a busy period, and check whether the hang duration lines up with that. Node also has built-in profiling (the `--prof` flag) that will show you directly whether time is being spent in a long synchronous JavaScript call versus waiting on I/O or the database. If the timing lines up with indicator-heavy moments specifically, this is confirmed as the mechanism, not just a theory.

---

## 4. Pipeline Stages — Interfaces and Responsibilities

Restating the shape from the overview doc, with the internal contract of each stage made explicit:

- **Exchange Connection** — owns the WebSocket lifecycle only (Section 1). Its output is raw, unmodified exchange messages. It knows nothing about footprint, CVD, or any other downstream concept — that separation is what lets you swap or add exchanges later without touching this layer's logic.
- **Normalizer** — pure transformation: raw exchange message in, internal event shape out. No side effects, no state. This is what makes it trivial to test in isolation and trivial to duplicate for a second data source later.
- **Event Bus** — a durable, ordered queue (Redis Streams, covered in Part 5) that every downstream stage reads from independently as its own **consumer group**. This is the detail worth being precise about: a consumer group means each stage (order-book reconstructor, indicator aggregator, persistence writer, live broadcaster) processes *every* event at its own pace, on its own schedule, without waiting on or blocking any other stage. A slow database write never delays the live broadcast to connected users. A consumer that crashes and restarts resumes from the last position it acknowledged, rather than either losing events or needing to reprocess everything from the start.
- **Consumers** — each one does exactly one job (Section 3's fix #1 applies inside every one of these): maintain the in-memory book, compute running aggregates, write batched data to storage, or push updates out to clients.

---

## 5. Failure Modes and Recovery, Concretely

| Failure | Detection | Recovery |
|---|---|---|
| WebSocket drops | Connection close/error event | Reconnect with exponential backoff + jitter (Section 1) |
| Sequence gap in diff stream | previous-update-ID mismatch (Section 2) | Discard local book, re-enter SYNCING |
| A consumer process crashes | Process monitoring / restart supervisor | Resumes from last acknowledged position in its consumer group — no manual replay needed if using Streams correctly |
| Duplicate message delivery after a crash-recovery | N/A — expect this to happen | Design writes to be idempotent: key persistence operations off the exchange's own trade ID or update ID, so reprocessing the same event twice doesn't create a duplicate record or double-count a running total |

That last row matters more than it looks like it does: any recovery mechanism that resumes from "roughly where it left off" will occasionally redeliver an event that was already processed. If your persistence and aggregation logic isn't explicitly idempotent, recovery from a crash can itself introduce corruption — which would show up as exactly the kind of unexplained, hard-to-reproduce data weirdness you're currently seeing.

---

## 6. Multi-Symbol and Future Multi-Source Scaling

Each symbol's ingestion → normalization → aggregation chain should be isolated from every other symbol's — separate consumer instances (or at minimum, separate logical queues within the bus) so a burst of activity on one busy symbol never starves processing for a quiet one. This isolation is also what makes horizontal scaling straightforward later: symbols can be distributed across multiple consumer processes without any coordination needed between them.

Because the normalizer is the only place that knows about a specific exchange's message format, adding forex or another instrument class later — a stated future goal — means writing one new normalizer that speaks whatever that new source's protocol is and emits the same internal event shape everything else already understands. Nothing in the event bus, the aggregators, the storage writer, or the broadcaster needs to know or care that the data now comes from two different places. This is the concrete payoff of keeping the normalizer boundary strict from the start, rather than something to retrofit once a second source is actually being added.

---

## Terms Reference

- **Event-loop blocking** — synchronous JavaScript work that occupies Node's single thread long enough that it can't process anything else (new messages, requests, timers) until it finishes.
- **`worker_threads`** — Node's module for running JavaScript on a separate OS thread with its own isolated environment, used to offload CPU-heavy work without blocking the main thread.
- **Consumer group** — a named, independent reader of an event stream; each group processes every message at its own pace, tracked separately from every other group reading the same stream.
- **Idempotency** — a write or operation that produces the same end result whether it's applied once or applied multiple times with the same input, making accidental redelivery harmless.
- **Exponential backoff with jitter** — a reconnect strategy where each retry waits progressively longer than the last, with a small randomized offset added so that many simultaneously-failing connections don't all retry at the exact same moment.
- **Sequence gap / resync** — the detection of a missing message via mismatched update-ID sequencing, and the recovery of discarding local state and rebuilding it from a fresh snapshot.
