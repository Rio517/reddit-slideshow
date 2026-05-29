# Offline Fixtures

Offline fixtures let us test Reddit parsing without depending on live Reddit
pages, network availability, account state, or rate limits.

## Fixture Rules

- Commit only sanitized fixtures.
- Remove usernames, account-specific data, cookies, tokens, and tracking parameters.
- Keep fixtures small enough to understand in review.
- Prefer one focused fixture per behavior.
- Keep post IDs fake unless an exact ID is needed to reproduce a bug.
- Capture from real responses when shape fidelity matters: galleries,
  `media_metadata`, crossposts, videos, and Redgifs links.
- Hand-authored fixtures are fine for simple cases.

## Fixture Types

- `tests/fixtures/old-reddit/*.html`: old Reddit-like page structure for content
  and context tests.
- `tests/fixtures/reddit-json/*.json`: Reddit listing JSON shapes for queue and
  resolver tests.

JSON fixtures should model the `raw_json=1` form, where URLs are not
HTML-entity-encoded.

## Refresh Workflow

1. Save the smallest useful HTML or JSON sample.
2. Remove personal/account-specific data.
3. Replace real titles with harmless representative titles unless title text
   matters.
4. Keep media URL shapes realistic.
5. Add or update a focused test that explains why the fixture exists.

Do not use live Reddit as the normal unit-test path.
