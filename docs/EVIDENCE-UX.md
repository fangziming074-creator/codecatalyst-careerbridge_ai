# Evidence-first onboarding

This change selectively adopts the uploaded offline prototype's entry guide,
coverage-aware messaging, and single company-page readiness summary. It does
not import the prototype's offline fetch override or replace the deployed
application, account service, question banks, or existing translations.

## Behavior

- A new browser starts with an empty personal profile and no readiness score.
  Existing saved profiles are preserved, not reset or automatically migrated.
- **Explore the sample** opens `?demo=1`. Sample changes use
  `careerbridge_sample_v1`; personal changes retain `careerbridge_mvp_v1`.
  Sample mode does not initialize accounts, sync cloud state, or automatically
  call the paid occupation-signal API. Returning restores the personal workspace.
- **Build my profile** uses the existing editor. After selecting a role,
  **Assess key skills** preselects just one required skill.
- A role alignment percentage is available only when every required skill
  has a recorded level. Otherwise the UI prioritizes **Insufficient evidence**
  and the assessed/required count. A complete score remains a comparison with
  an editable skill template, not validated competence or a hiring probability.
- Company cards retain relevance, favorites, intentions, filters, and official
  links. Readiness appears only once, above the directory, as target-role
  readiness rather than company fit.
- `?view=report&sample=1` is a hand-authored educational fixture with explicit
  evidence gaps. It makes no API requests and is never a silent live-report
  fallback.

## Report compatibility

`POST /api/career-report` still returns its original JSON response by default.
Clients requesting `Accept: text/event-stream` receive:

- `stage` with `searching`, immediately before real source searches;
- `stage` with `generating` and `sourceCount`, after sources are available;
- `report` with the existing response body, or a public `error` event.

Cached responses and pre-stream validation/configuration/rate-limit failures
remain JSON. The browser accepts both formats, offers an accessible retry,
and does not invent timed percentages. Authentication, origin checks, rate
limits, model configuration, and the database schema are unchanged.

## Regression checks

After installing the existing application dependency:

```sh
node --test tests/report-events.test.mjs tests/report-integration.test.mjs
python3 tests/check-localization.py
```

The Python check requires Python 3 and Chromium (`CHROMIUM` may point to the
executable). It starts an isolated local server and browser profile. API
responses in browser checks are mocked. The Node integration test runs the
actual application against a local synthetic upstream with accounts disabled.
No paid model calls or production mutations are used in these checks.
