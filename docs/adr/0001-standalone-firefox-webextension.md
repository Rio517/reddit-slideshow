# ADR 0001: Build A Standalone Firefox WebExtension First

Date: 2026-05-29
Status: Proposed

## Context

The desired feature overlaps with Reddit Enhancement Suite because the user browses old Reddit with RES installed. RES is open source and already targets old Reddit, but it is a large existing project with its own architecture, review process, license constraints, and release cadence.

The current workspace is empty, so there is no existing codebase forcing an integration-first path.

## Decision

Build the first version as a standalone Firefox-first WebExtension that coexists with RES.

## Consequences

Benefits:

- Faster iteration.
- Clear ownership of the slideshow experience.
- Easier local development and testing.
- Lower risk of breaking or depending on RES internals.
- A working standalone extension can later inform a RES PR or fork.

Costs:

- Some overlap with RES capabilities may remain.
- The extension must be careful to avoid conflicting with RES DOM changes and keyboard handlers.
- A later RES integration would require additional adaptation.

## Follow-Up

Review RES source for relevant media expansion behavior and compatibility risks after the standalone extension architecture is clearer.
