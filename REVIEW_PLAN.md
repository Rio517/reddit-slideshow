# Review Plan

Date: 2026-05-30

## Scope

Review the current `main` branch after the v1 feature-complete work. Focus on
three narrow areas:

- Security and privacy: permissions, message boundaries, DOM injection, remote
  media loading, data retention, and extension review risk.
- Performance: queue growth, media preloading, timers, duplicate detection,
  render churn, and pagination behavior.
- Code quality: module boundaries, test coverage, type/JSDoc quality,
  maintainability, and obvious correctness risks.

## Method

1. Inspect current code and recent commits.
2. Run static searches for risky patterns (`innerHTML`, dynamic script, broad
   permissions, raw external fetches, storage writes, message listeners).
3. Run verification commands: `npm run format`, `npm run typecheck`,
   `npm run lint`, `npm test`, `npm run build`, and `npm run webext:lint`.
4. Review source by module:
   - `entrypoints/background.js`
   - `entrypoints/content.js`
   - `lib/slides.js`
   - `lib/slideshow.js`
   - `lib/queue.js`
   - `lib/overlay-render.js`
   - `lib/overlay-ui.js`
   - `lib/dedup.js`
   - settings/options files
5. Write narrow review reports in the repository root:
   - `SECURITY_REVIEW.md`
   - `PERFORMANCE_REVIEW.md`
   - `CODE_QUALITY_REVIEW.md`
   - `REVIEW_SUMMARY.md`

## Finding Format

Each finding should include severity, file/line reference, why it matters, and
the recommended next action. Avoid speculative issues unless they are clearly
marked as residual risk.
