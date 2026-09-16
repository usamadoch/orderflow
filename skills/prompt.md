TASK:

CONTEXT RULES:

map.md = source of truth for file structure
log.md = history of changes make its not more than 12 lines

STRICT EXECUTION FLOW:

1. BUILD PLAN:
   - infer required files from map.md
   - do NOT ask user for file list

2. IMPLEMENT:
   - modify only necessary files
   - create new files only if required
   - NEVER commit or push code to git unless explicitly instructed by the user

3. AFTER CODE CHANGES:
   - update map.md (MANDATORY)
     format:
     file_path → responsibility (short line)
   - update log.md:
     - what changed
     - why it changed
     - impact summary

HARD RULES:

- Never modify files outside inferred scope
- Never skip map.md update
- Never skip log.md update
- Do not re-scan full repository

Do not start the Next dev server unless the change specifically requires browser/runtime UI verification. Prefer TypeScript checks and targeted code review first.
...

Work only on the approved plan. Before making changes, identify the exact implementation steps. Execute them sequentially. After each major step, validate the result. Do not start additional investigation or implementation loops. If you encounter an issue outside the plan, stop and report it. Do not continue autonomously.

## conte

After completing the task:

1. Check git status
2. Stage only modified files:
   git add .

3. Create a commit with a clear message:
   - format: <type>: <short summary>
   - example: feat: add auth system

4. Ensure map.md and log.md are updated before commit

5. Commit changes:
   git commit -m "<message>"

6. Push to current branch:
   git push origin main

RULES:

- Do NOT push if working directory has unfinished task.md changes
- Do NOT include unrelated files
- Always confirm repo is in clean state before pushing

## Execution constraints

Do not endlessly explore the codebase. Your job is to reach a conclusion, not to inspect every file.

- Start with the files directly relevant to the task. Do not recursively inspect unrelated files.
- Do not repeatedly reopen the same file or reread the same sections unless new evidence requires it.
- Do not inspect line-by-line across large files without a specific reason.
- After you have enough evidence to determine the cause, stop investigating and state the conclusion.
- Do not chase unrelated errors, warnings, TODOs, refactors, or hypothetical edge cases.
- Do not expand the scope of the task on your own.
- Do not keep searching for additional confirmation after the conclusion is already sufficiently supported.
- Never invent missing behavior, code, files, test results, or causes. If something cannot be verified, explicitly say so.
- If evidence is conflicting or insufficient, report exactly what is known and what remains unverified instead of continuing indefinitely.
- Prefer the smallest set of files and lines needed to answer the task.
- Do not perform broad codebase exploration unless the task explicitly requires it.

### Hard stop

If you have spent substantial effort without finding new relevant evidence, STOP and provide the best-supported conclusion so far.

Your final response must contain:

1. What you found.
2. The specific files/functions involved.
3. The exact cause or conclusion.
4. What should be changed, if anything.
5. Any uncertainty that remains.

Do not continue investigating merely to make the answer more certain.
