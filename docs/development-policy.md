# Development Policy

## Core Rule

Every new feature or behavior change must include enough regression coverage to protect previously working behavior.

This project does **not** use a fixed minimum test count as the policy goal.
The real goal is confidence:
- do not break flows that already worked
- do not close an iteration with unprotected behavior changes

## Required Before Closing an Iteration

An iteration must not be considered complete unless all of the following are true:

- the changed behavior is covered by regression tests at an appropriate level
- previously working behavior that could be affected is also protected by tests
- a release note is added for the iteration
- the test pipeline passes

## Testing Standard

When adding or changing a feature:

- add tests for the new expected behavior
- add tests for nearby existing behavior that could regress
- prefer meaningful regression coverage over test-count targets
- if a bug was discovered from real usage, add a regression test for that exact bug pattern

## Release Standard

Before deploy or release:

- run `npm test`
- run `npm run check` when appropriate
- do not close the iteration if release notes or regression coverage are missing

## Practical Interpretation

Good policy examples:

- A parser change should protect known real-world input patterns that already worked.
- A menu-flow change should protect existing message routing, state behavior, and user-facing replies.
- A Google Apps Script contract change should protect request/response shape assumptions.

Bad policy examples:

- Adding arbitrary tiny tests only to satisfy a numeric quota
- Declaring an iteration finished without protecting old working behavior
