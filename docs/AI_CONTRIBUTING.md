# AI Contributing Guide

## Read Order (Required Before Edits)
1. `README.md`
2. `docs/GUARDRAILS.md`
3. `docs/DOMAIN_MODEL.md`
4. `docs/ARCHITECTURE.md`
5. Relevant feature docs

## Allowed Change Classes
- Scoped feature additions inside declared MVP boundaries.
- Bug fixes with tests.
- Documentation updates tied to behavior changes.
- Performance improvements that preserve behavior.

## Refused Change Classes
- Expanding scope into non-goals without roadmap approval.
- Enabling raw HTML rendering or unsafe markdown execution.
- Architectural rewrites without ADR updates.
- Silent data model changes without `docs/DOMAIN_MODEL.md` updates.

## Required Validation Before PR
- Run lint, typecheck, and tests.
- Confirm routes still resolve.
- Confirm docs are updated when behavior/contract changes.
- Explicitly list assumptions in PR summary.
