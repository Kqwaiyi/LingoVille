# 19a — Barista hiring

**What to build:** The Player asks the barista for work (#26), gives their name and says when they can start. If it goes well, the Player is hired. If it fails, they can try again.

**Blocked by:** None — can start immediately

**Spec:** [spec.md](../spec.md): Jobs and Shifts; Goal Interactions (#26); Named NPCs (name check)

**Status:** ready-for-agent

- [ ] Hiring interaction #26: ask for work, give a name (the sim compares it to the setup name) and say when you can start.
- [ ] The name check is a sim function that the later `learn_name` tool will reuse (Vitest).
- [ ] A failure can be retried. The Job is recorded in the save.
