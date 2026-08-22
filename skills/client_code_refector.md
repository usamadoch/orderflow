# CODE_SKILL.md — Code Quality & Structure Guidelines

> This file is a standing skill for AI agents and developers.
> When refactoring, reviewing, or writing new code — always check against these rules first.
> These are not suggestions. They are the standard.

---

## 1. FILE LENGTH LIMITS

| File Type | Soft Limit | Hard Limit | Action |
|---|---|---|---|
| Component (UI) | 150 lines | 250 lines | Extract sub-components |
| Service / Logic | 100 lines | 200 lines | Split by responsibility |
| Utility / Helper | 80 lines | 150 lines | Group into domain files |
| Config file | 50 lines | 100 lines | Split by environment or feature |
| Types / Interfaces | 100 lines | 200 lines | Split by domain |
| Test file | 200 lines | 400 lines | Split by feature/behavior |

**Soft limit** → Warning. Review whether extraction is needed.  
**Hard limit** → Stop. The file MUST be split before adding more code.

**How to count:** Count only non-empty, non-comment lines. If a file hits the hard limit, no new logic is added until it is refactored.

---

## 2. FUNCTION / METHOD RULES

```
Max lines per function:     30 lines
Max parameters:              3  (use an options object if more are needed)
Max nesting depth:           3  (if/for/try inside each other)
Max cyclomatic complexity:   5  (number of branches: if, else, switch cases, loops)
```

### What "too much logic in one function" looks like:

❌ **Bad — one function doing too many things:**
```js
async function handleSubmit(data) {
  // validate
  if (!data.email) throw new Error(...)
  if (!data.name) throw new Error(...)

  // transform
  const payload = { ...data, createdAt: new Date() }

  // call API
  const res = await fetch('/api/users', { method: 'POST', body: JSON.stringify(payload) })
  const json = await res.json()

  // update UI
  setUser(json)
  toast('Success!')
  router.push('/dashboard')
}
```

✅ **Good — single responsibility per function:**
```js
async function handleSubmit(data) {
  validateUserForm(data)
  const payload = buildUserPayload(data)
  const user = await createUser(payload)
  onUserCreated(user)
}
```

Each extracted function is testable, readable, and reusable.

---

## 3. WHEN TO EXTRACT TO A SEPARATE FILE

Extract to a new file when ANY of the following is true:

| Condition | Extract To |
|---|---|
| A function is used in more than 1 file | `utils/` or `helpers/` |
| A block of logic has its own clear domain (auth, payments, formatting) | `services/` or `lib/` |
| A UI component has its own state or is longer than 80 lines | New component file |
| Constants / magic values are repeated across files | `constants/` file |
| Types / interfaces are shared across 2+ files | `types/` file |
| A hook contains more than 20 lines of logic | `hooks/` file |
| API call logic is inline inside a component | `api/` or `services/` file |

### Never leave these inline in a component:
- API calls (`fetch`, `axios`, SDK calls)
- Business rules ("user can edit if role is admin and post is not archived")
- Reusable formatting logic (dates, currency, truncation)
- Hardcoded strings that appear more than once

---

## 4. WHAT BELONGS WHERE — FOLDER RULES

```
src/
├── components/       UI only. No API calls. No business logic.
├── pages/ (or app/)  Routing + composition only. Thin files.
├── hooks/            Reusable React hooks. One hook per file.
├── services/         All API calls and external integrations.
├── lib/ or utils/    Pure functions. No side effects. No framework deps.
├── store/            State management. One slice/store per domain.
├── types/            Shared TypeScript types and interfaces.
├── constants/        Magic strings, enums, config values.
└── config/           Environment-level config. No logic.
```

**Rule:** If you're not sure where code goes, ask: *"Does this talk to the UI, talk to an API, or just transform data?"*  
- Talks to UI → `components/`  
- Talks to API → `services/`  
- Transforms data → `utils/` or `lib/`

---

## 5. NAMING RULES

| Thing | Convention | Example |
|---|---|---|
| Files (components) | PascalCase | `UserCard.tsx` |
| Files (utils/hooks) | camelCase | `useAuthUser.ts`, `formatDate.ts` |
| Functions | camelCase, verb-first | `getUser`, `buildPayload`, `handleClick` |
| Boolean variables | `is/has/can/should` prefix | `isLoading`, `hasPermission` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_FILE_SIZE`, `API_BASE_URL` |
| Types/Interfaces | PascalCase, no `I` prefix | `UserProfile`, `ApiResponse` |
| Event handlers | `handle` prefix | `handleSubmit`, `handleDelete` |

**Naming is communication.** If you need a comment to explain what a variable is, rename it instead.

---

## 6. COMMENTS — WHEN AND WHEN NOT TO

### Write a comment when:
- Explaining **why** something is done a non-obvious way
- Documenting a known workaround or bug fix
- Describing a business rule that lives in the code

### Do NOT write a comment when:
- The code is already self-explanatory
- You're narrating what the code does line by line
- You'd rather add a comment than rename a confusing variable

```js
// ❌ Useless comment
// loop through users
users.forEach(user => ...)

// ✅ Useful comment
// Skip unverified users — backend does not filter them out in this endpoint
users.filter(u => u.verified).forEach(user => ...)
```

---

## 7. IMPORTS — ORDERING AND CLEANLINESS

Always order imports in this sequence (with a blank line between groups):

```js
// 1. External packages
import React, { useState } from 'react'
import { useRouter } from 'next/router'

// 2. Internal aliases / absolute paths
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'

// 3. Relative imports
import { formatDate } from './utils'
import type { UserProps } from './types'
```

**Remove unused imports immediately.** They are noise and cause confusion.

---

## 8. COMPLEXITY CHECKLIST — USE BEFORE SUBMITTING CODE

Run through this before finalizing any file:

- [ ] Is the file under the soft limit for its type?
- [ ] Does every function do exactly one thing?
- [ ] Are there any magic numbers or hardcoded strings that should be constants?
- [ ] Are API calls isolated from UI components?
- [ ] Is any logic copy-pasted from another file? (Extract it.)
- [ ] Are variable and function names self-explanatory without comments?
- [ ] Does nesting go deeper than 3 levels? (Refactor if yes.)
- [ ] Are there any functions longer than 30 lines? (Split them.)
- [ ] Are shared types defined in the `types/` folder?
- [ ] Could any function here be reused elsewhere? (Move it to `utils/`.)

---

## 9. REFACTOR TRIGGERS — WHEN AN AGENT MUST REFACTOR

An AI agent reviewing or editing code MUST flag for refactor when:

1. File exceeds **hard limit** for its type (see Section 1)
2. A function has **more than 3 parameters** without an options object
3. Business logic is **inside a UI component**
4. The same logic block appears **in more than one file**
5. Nesting is **deeper than 3 levels**
6. A component imports from **more than 8 different files**
7. A single file has **more than 5 exported functions/classes**
8. Any function is **longer than 30 lines**

When flagging, the agent must specify:
- Which rule is violated
- What should be extracted and where it should go
- The suggested new file name and folder

---

## 10. QUICK REFERENCE CARD

```
File too long?          → Split by responsibility
Function too long?      → Extract smaller named functions
Logic in component?     → Move to service or hook
Code repeated?          → Move to utils/
Unclear name?           → Rename before commenting
API call in component?  → Move to services/
Shared type?            → Move to types/
Magic value?            → Move to constants/
```

---

*Last updated: 2026 | Version: 1.0 | Apply to all projects unless a project-specific override exists.*


















