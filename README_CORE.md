# Second Soul Engine — Core Architecture
## Version 4 · State-Safe + Debug-Ready

---

## 1. Data Source of Truth

Two authorities. Strictly separated. No crossover.

### AsyncStorage → TIME authority

| Key | Format | Written | Rule |
|-----|--------|---------|------|
| `first_launch_date` | `YYYY-MM-DD` | Once on first launch | Never overwritten |
| `last_computed_day` | integer string | Every launch | Only increases |
| `onboarding_complete` | `"true"` | Once on onboarding finish | Never cleared |

**DAY is derived from `first_launch_date` only.**
No database record counts. No timestamp arithmetic. No millisecond division.

DAY formula:
```
DAY = calendar_diff(today, first_launch_date) + 1
```

Safety rule — DAY must never go backward:
```
if (computedDay < lastComputedDay) {
  DAY = lastComputedDay
} else {
  DAY = computedDay
  save lastComputedDay = DAY
}
```

### SQLite → BEHAVIOR authority

| Table | Contains | Forbidden |
|-------|----------|-----------|
| `raw_events` | Timestamped interaction events | Aggregation, scoring, labeling |
| `raw_sessions` | Session open/close records | DAY calculation, onboarding state |

SQLite has no authority over DAY or onboarding.
SQLite data may be wiped on reinstall — the time system survives in AsyncStorage.

---

## 2. Event Lifecycle Map

```
OS Lifecycle Event
        │
        ▼
behaviorService.js
  ├─ App enters foreground  → session_start event
  ├─ App leaves foreground  → session_end event
  ├─ Screen navigation      → screen_enter / screen_exit events
  └─ 3-min inactivity gap   → idle event (fires once, then silent)
        │
        ▼
eventStore.persistEvent(event)
        │
        ▼
SQLite: raw_events table
        │
        ▼
SQLite: raw_sessions table (open/close pairs)
```

### Event object shape

```js
Event {
  timestamp:        number,    // Unix ms
  session_start:    boolean,
  session_end:      boolean,
  app_focus:        string,    // screen name
  interaction_type: string,    // session_start | session_end | screen_enter | screen_exit | idle | tap
  duration:         number,    // ms
  app_switch:       boolean,
  idle_time:        number,    // ms, non-zero only for idle events
  _session_id:      string,    // opaque, internal only
}
```

### Idle rule

Idle is **passive-only**. It fires once after a gap in interaction.
No `setInterval`. No polling. No background waking.
The collector sets a single `setTimeout` on each real interaction.
If the timeout fires without interruption → one idle event → timer stops.
Next real interaction resets the timer.

---

## 3. Safety Boundary

### Explicitly forbidden data sources

| Source | Status |
|--------|--------|
| GPS / location coordinates | **FORBIDDEN** |
| Accelerometer / gyroscope | **FORBIDDEN** |
| Battery discharge modeling | **FORBIDDEN** |
| CPU / thermal state | **FORBIDDEN** |
| Biometric data (heart rate, etc.) | **FORBIDDEN** |
| Continuous sensor polling | **FORBIDDEN** |
| Background loops or timers | **FORBIDDEN** |
| Real-time behavioral inference during collection | **FORBIDDEN** |

### Allowed signals

| Signal | Trigger | Source |
|--------|---------|--------|
| App foreground | AppState 'active' | OS lifecycle |
| App background | AppState 'background' / 'inactive' | OS lifecycle |
| Screen focus | Manual call from screen useEffect | App navigation |
| Idle gap | Single setTimeout after last interaction | App-internal |

### Storage boundary

```
AsyncStorage  →  time state only (DAY, onboarding, first_launch_date)
SQLite        →  raw interaction events only (no derived values)
Network       →  never used
```

---

## 4. Export (Development Channel)

`eventStore.exportRawEvents()` writes the last 30 days of raw events
to `DocumentDirectory/second_soul_raw_events.json` and triggers the
native share dialog.

This function is only callable in `__DEV__` mode.
The export button is conditionally rendered:

```jsx
{__DEV__ && <TouchableOpacity onPress={handleExport}>...</TouchableOpacity>}
```

Export format: raw JSON. No transformation. No labeling. No derived fields.

---

## 5. System Identity

This system does not measure people.
It waits until something becomes recognizable.

The system must feel like quiet observation of existence —
not analytics, not tracking, not monitoring.
