# Session Visualization — Task 1 of 2
## Session Definitions, Store, and Settings Panel

---

## Goal for This Task Only

Define the three trading sessions and their default timings. Add all session-related state to the store. Build the settings panel section where sessions can be toggled and their times configured. Nothing renders on the canvas yet — verify by confirming store state updates correctly when settings are changed.

---

## The Three Sessions

Each session represents a major market trading window in UTC time.

| Session | Default Start (UTC) | Default End (UTC) | Color |
|---|---|---|---|
| Tokyo | 00:00 | 06:00 | `#B39DDB` — muted purple |
| London | 07:00 | 16:00 | `#4FC3F7` — muted blue |
| New York | 13:00 | 22:00 | `#81C784` — muted green |

Note that London and New York overlap from 13:00–16:00 UTC. This is intentional and expected — it is the highest liquidity window of the day and both session boxes rendering together is visually useful.

Times are in UTC always. The chart already works in UTC (Binance timestamps are UTC). No timezone conversion needed.

---

## Session State Shape

**File:** `lib/store/chart.ts`

```ts
interface SessionConfig {
  enabled:    boolean
  startHour:  number    // 0–23, UTC
  startMin:   number    // 0 or 30 only — sessions start on the hour or half hour
  endHour:    number
  endMin:     number
  color:      string    // hex color
}

interface SessionsState {
  sessionsEnabled: boolean         // master toggle for all sessions
  sessions: {
    tokyo:   SessionConfig
    london:  SessionConfig
    newYork: SessionConfig
  }
}
```

Add to Zustand store with these defaults:

```ts
sessionsEnabled: true

sessions: {
  tokyo: {
    enabled:   true,
    startHour: 0,  startMin: 0,
    endHour:   6,  endMin:   0,
    color:     '#B39DDB'
  },
  london: {
    enabled:   true,
    startHour: 7,  startMin: 0,
    endHour:   16, endMin:   0,
    color:     '#4FC3F7'
  },
  newYork: {
    enabled:   true,
    startHour: 13, startMin: 0,
    endHour:   22, endMin:   0,
    color:     '#81C784'
  }
}
```

**Actions:**
- `setSessionsEnabled(v: boolean)` — master toggle
- `setSessionEnabled(session: 'tokyo' | 'london' | 'newYork', v: boolean)`
- `setSessionTime(session, field: 'startHour' | 'startMin' | 'endHour' | 'endMin', value: number)`
- `setSessionColor(session, color: string)`

**Persistence:** All session config persists via `partialize`. User's custom session times and toggles survive page refresh.

---

## Settings Panel Section

**File:** `components/ui/SettingsPanel.tsx`

Add a new `SESSIONS` section. Place it after the existing chart settings sections.

```
SESSIONS
  Show sessions        [master toggle]

  ── TOKYO ───────────────────────────
  Enabled              [toggle]
  Start                [00] : [00]
  End                  [06] : [00]
  Color                [color picker]

  ── LONDON ──────────────────────────
  Enabled              [toggle]
  Start                [07] : [00]
  End                  [16] : [00]
  Color                [color picker]

  ── NEW YORK ────────────────────────
  Enabled              [toggle]
  Start                [13] : [00]
  End                  [22] : [00]
  Color                [color picker]
```

### Master toggle behavior
When `sessionsEnabled` is false, all session boxes disappear from the chart immediately. The individual session toggles and time inputs are still visible in the settings panel but the entire feature is off. This lets users quickly hide all sessions without losing their per-session settings.

When master toggle is on, only sessions with `enabled: true` render.

### Time inputs
Each start and end time uses two separate number inputs — one for hour, one for minute.

Hour input: `0–23`, step `1`
Minute input: only `0` or `30` are valid — use a select dropdown with two options (`00` and `30`) rather than a free number input. Sessions do not start on arbitrary minutes.

On change: call `setSessionTime` with the updated value. Canvas redraws immediately — no debounce needed.

### Validation
Enforce that `endHour:endMin` is after `startHour:startMin`. If the user sets an end time earlier than start time, revert the field to its previous value and do not update the store. No error message needed — just silent rejection.

Exception: sessions that wrap midnight (e.g. a session starting at 22:00 and ending at 06:00 the next day) are not supported in this implementation. If end time is before start time, treat it as invalid and revert.

### Color picker
Standard `<input type="color">` for each session. On change: `setSessionColor(session, e.target.value)`. Default colors pre-filled.

### Session label style in settings
Each session name (`TOKYO`, `LONDON`, `NEW YORK`) is displayed as a section divider line with the name centered or left-aligned. Font: `JetBrains Mono`, `9px`, color matching that session's default color. Thin `1px` horizontal rule `#1F1F1F` above each session block.

---

## Toolbar Quick Toggle

Add a small `S` or session icon button to the toolbar that maps to the `sessionsEnabled` master toggle.

- Active (sessions showing): background `#1F1F1F`, border `1px solid #3D7EFF`
- Inactive: transparent, muted
- This is a shortcut — same as toggling the master switch in settings
- No individual session control from toolbar — that lives only in settings

---

## Keyboard Shortcut

Add `S` key to toggle `sessionsEnabled` on and off.
Guard: skip when focused on input.

---

## How to Verify This Task is Done

Open the settings panel, find the `SESSIONS` section.

- Master toggle is present and updates `sessionsEnabled` in store (check via Redux/Zustand devtools or a console log)
- Each session has its own toggle — disabling Tokyo sets `sessions.tokyo.enabled = false` in store
- Changing Tokyo start hour to `1` updates `sessions.tokyo.startHour = 1` in store
- Minute dropdown only shows `00` and `30`
- Setting end time earlier than start time is silently rejected — field reverts
- Color picker changes update store immediately
- Toolbar `S` button toggles `sessionsEnabled`
- `S` keyboard shortcut does the same
- Refresh the page — all settings restored from localStorage

Do not proceed to Task 2 until all store values update correctly and persist.