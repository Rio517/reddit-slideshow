# ADR 0002: Use Provider-Based Media Resolution

Date: 2026-05-29
Status: Proposed

## Context

The slideshow needs to support several media shapes:

- Direct Reddit-hosted images.
- Reddit galleries.
- Reddit-hosted videos and GIF-like media.
- Redgifs.
- Possibly more external hosts later.

Each provider has different URL patterns, metadata fields, permissions, failure modes, and playback requirements.

## Decision

Use a provider adapter model for media resolution. The queue builder should identify candidate posts and pass them through provider-specific resolvers. Resolvers return normalized slide items or a known unsupported/fallback result.

## Consequences

Benefits:

- Keeps Reddit gallery logic separate from Redgifs logic.
- Makes failures explicit and recoverable.
- Allows future providers without rewriting the slideshow UI.
- Supports provider-specific permissions and test fixtures.

Costs:

- Slightly more initial structure than a one-off parser.
- Requires normalized media item types and resolver contracts.

## Follow-Up

Define the normalized slide item interface during implementation planning. It should include media type, source URL, post title, permalink, provider, duration behavior, audio capability, and fallback/open-original data.
