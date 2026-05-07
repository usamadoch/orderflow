TASK:
Implement: 

task1.md



CONTEXT RULES:
- 

map.md
= source of truth for file structure
- 

log.md
 = history of changes

STRICT EXECUTION FLOW:

1. BUILD PLAN:
   - infer required files from map.md
   - do NOT ask user for file list

2. IMPLEMENT:
   - modify only necessary files
   - create new files only if required

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








-------------------------------------------------------------------------


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