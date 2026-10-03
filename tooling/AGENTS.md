# tooling

Repo-wide guardrail tests that check the project's rules rather than game behaviour, such as the ESLint import boundaries.

**Rules**
- Prove each guardrail with a deliberate violation, linted or checked as if it lived in the repo, and expect the rule to fire.
- When a boundary in `eslint.config.js` changes, change its test here in the same commit.

**Testing**: `npx vitest run tooling`
