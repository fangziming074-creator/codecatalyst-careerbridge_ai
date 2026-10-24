# Validation record

## Included source

- Repository: fangziming074-creator/careerbridge-ai-live.
- Main baseline: f7b1b7fe6513de7b1cd9a6266fc980aa836d75ba (PR7).
- Includes pending PR8: 8a2ad877d04887e16dfe615dd5c227aaf2a5e707.
- Adds server-only Runpod adapter, authenticated AI workspace, bounded follow-up context, and deployment documentation.
- This package does not merge PR8, deploy a website, create a GPU endpoint, or migrate historical user data.

## Passing checks

- `npm test`: 21 Node tests, including the existing report JSON/SSE regression suite, a real local HTTP assistant handler with synthetic account/model dependencies, and a real website startup/health/static-file/fail-closed test in Runpod mode without a database.
- `python3 tests/check-ai.py`: 32 checks in actual headless Chromium. Covers guest/sample gates, blank inputs, English/Chinese UI, all three assistant tasks, ownership envelope, safe text rendering, manual retry, duplicate prevention, short follow-up history, feature-switch reset, and late-response discard.
- `python3 tests/check-entry.py`: 29 existing entry/login/empty-input/translation checks in actual Chromium.
- All inline JavaScript in public/index.html passed Node syntax checks.
- The 14 locked dependency versions, tarball URLs and integrity values matched public npm registry metadata. The lockfile uses portable public registry URLs, not an internal registry.
- A credential-pattern scan of the export found no matching credential strings. This is a limited packaging check, not a security audit.

## Not verified

- No real Runpod inference, paid DeepSeek/market call, production database access, production data write, deployment, or production end-to-end test was performed.
- Existing account behavior in browser tests uses synthetic API responses; no fresh PostgreSQL instance was provisioned for this delivery.
- `configured=true` reports presence of settings, not model reachability, correct GPU capacity, JSON compatibility, or available funds.
- No full historical data-isolation migration or cleanup was implemented.
- No multi-replica persistent quota/job system, durable conversation history, or long-running asynchronous job recovery was implemented.

## Before launch

1. Use a new database and configure secrets outside GitHub.
2. Run npm ci and npm test in the destination environment.
3. Validate real registration/login/profile save against that new database.
4. Explicitly approve a small paid model smoke test; verify English/Chinese output, report JSON compatibility, latency and cost.
5. Set provider budget/worker limits and decide whether to keep the original report writer or select AI_PROVIDER=runpod.
