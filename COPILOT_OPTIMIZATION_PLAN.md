# COPILOT OPTIMIZATION WORKSPACE PLAN
## Raise Omni's Engineering Score to 9.5-9.9

This plan upgrades the Omni codebase across six engineering dimensions:

- Type Safety
- Documentation
- Modularity
- Error Handling
- Testing
- Linting + Formatting

Each dimension includes concrete steps you can execute in VS Code.

---

## 1. TYPE SAFETY (TypeScript Conversion)
**Target Score Impact:** +1.5 to +2.0

Copilot heavily rewards typed codebases.

**Steps**
- Convert /src/ from JavaScript to TypeScript (.js -> .ts).
- Add tsconfig.json with strict mode enabled.
- Create /src/types/ folder for shared interfaces.
- Add types for:
  - Omni request/response
  - Router rules
  - Retrieval chunks
  - Memory objects
  - Mode definitions
- Replace all any with explicit types.
- Add return types to all functions.

---

## 2. DOCUMENTATION (JSDoc + Architecture Notes)
**Target Score Impact:** +1.0 to +1.5

Copilot boosts repos with clear documentation.

**Steps**
- Add JSDoc headers to every function.
- Document all modes in /src/modules/modes_reference.md.
- Add architecture overview in /docs/architecture.md.
- Add inline comments explaining complex logic.
- Add README sections for:
  - Modes
  - Routing
  - Retrieval
  - Memory
- Add a Contributing Guide for future maintainers.

---

## 3. MODULARITY (Refactor Into Clean Components)
**Target Score Impact:** +1.0

Copilot penalizes large, monolithic files.

**Steps**
- Split Omni engine into:
  - pipeline.ts
  - reasoning.ts
  - retrieval.ts
  - router.ts
  - memory.ts
- Move all prompt templates into /src/prompts/.
- Move all UI logic into /src/ui/.
- Extract utility functions into /src/utils/.
- Create a config.ts for environment variables.
- Ensure each file has a single responsibility.

---

## 4. ERROR HANDLING (Enterprise-Grade Stability)
**Target Score Impact:** +0.5 to +1.0

Copilot rewards robust error boundaries.

**Steps**
- Add try/catch blocks around all API calls.
- Create /src/errors/ with custom error classes.
- Add fallback logic for:
  - retrieval failures
  - router failures
  - memory read/write errors
- Add logging for all caught errors.
- Add a global error handler in pipeline.ts.
- Add user-friendly error messages in UI.

---

## 5. TESTING (Unit + Integration Tests)
**Target Score Impact:** +1.0 to +1.5

Copilot gives high scores to repos with tests.

**Steps**
- Install Jest or Vitest.
- Create /tests/ folder.
- Add tests for:
  - retrieval
  - router
  - memory
  - reasoning pipeline
- Add snapshot tests for prompt builder.
- Add integration test for full Omni pipeline.
- Add GitHub Actions workflow for CI testing.

---

## 6. LINTING + FORMATTING (Code Quality Enforcement)
**Target Score Impact:** +0.5 to +1.0

Copilot checks for consistency.

**Steps**
- Install ESLint with TypeScript rules.
- Install Prettier for formatting.
- Add .eslintrc.json and .prettierrc.
- Add lint scripts to package.json.
- Run eslint --fix across the repo.
- Enable Format on Save in VS Code.

---

## FINAL EXPECTED SCORE AFTER IMPLEMENTATION

| Category | Expected Score |
| --- | --- |
| Type Safety | 10 |
| Documentation | 10 |
| Modularity | 9.5 |
| Error Handling | 9.5 |
| Testing | 9.5 |
| Linting + Formatting | 10 |

**Projected Copilot Engineering Score:** 9.5-9.9

This is the highest range possible without rewriting the entire system in a framework like Next.js or NestJS.

---

## EXECUTION TIMELINE (8-WEEK PLAN)

**Week 1-2: Type Safety Foundations**
- Add tsconfig.json (strict) and base build script.
- Create /src/types/ and define core interfaces.
- Convert critical path files first (entrypoints, routing, retrieval).

**Week 3: Modularity Pass**
- Split engine into pipeline, reasoning, retrieval, router, memory.
- Move prompts to /src/prompts/ and align imports.
- Add config.ts for environment variables.

**Week 4: Documentation Upgrade**
- Add JSDoc to all public functions.
- Add /docs/architecture.md and README sections.
- Add CONTRIBUTING.md with setup, scripts, and conventions.

**Week 5: Error Handling Hardening**
- Add typed error classes and global error boundaries.
- Implement fallback logic and structured logging.
- Add user-facing error messages in UI.

**Week 6-7: Testing + CI**
- Add test framework and baseline unit tests.
- Add snapshot tests for prompt builder.
- Add integration test for end-to-end flow.
- Add GitHub Actions workflow for CI.

**Week 8: Linting + Formatting Enforcement**
- Add ESLint + Prettier config and scripts.
- Run repo-wide formatting pass.
- Enable format on save and add editor config.

---

## OWNERSHIP MATRIX

| Area | Primary Owner | Secondary Owner | Notes |
| --- | --- | --- | --- |
| Type Safety | Platform Lead | API Lead | Strict typing and shared interfaces |
| Modularity | Core Systems | Platform Lead | Pipeline split + prompts + config |
| Documentation | Tech Writer | Platform Lead | Architecture + API + modes |
| Error Handling | API Lead | Core Systems | Typed errors + fallback logic |
| Testing + CI | QA Lead | Platform Lead | Unit + integration + workflows |
| Linting + Formatting | DX Lead | Platform Lead | ESLint/Prettier + VS Code setup |
