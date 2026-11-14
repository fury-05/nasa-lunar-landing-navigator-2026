# API security review (P3-09)

Date: 2026-11-14 (UTC). Reviewer: Claude, with Irfan as accountable owner. Scope: the public read-only API in `services/api` at the commit that adds this file. This is a developer review with hostile-input tests, not a penetration test and not an independent audit.

## Method
1. Listed every place caller-controlled text reaches a file path, a response body or a log line (`grep` for path parameters and f-strings in `services/api/src`).
2. Wrote 62 tests in `services/api/tests/test_security.py` that send hostile input to the real app: traversal, encoded traversal, injection strings, malformed and oversized JSON, bad numbers and times, huge lists, method abuse, header injection, CORS probing.
3. Ran each test against the code. Four tests failed and exposed real weaknesses (below), then were fixed.
4. Mutation check: removed each fix in turn and confirmed the tests fail (id alphabet removed: 2 fail; raw echo: 1; loose times: 2; non-strict models: 2).

## Findings and what was done
| # | Finding | Impact | Fix |
|---|---|---|---|
| F1 | Error messages and the problem document `instance` echoed the caller's raw path, including encoded `../../etc/passwd`, markup and NUL characters. | Reflected text in error bodies and logs; confusing or misleading output; log flooding with long input. | `safe_echo()` limits echoed text to 64 printable ASCII characters, replacing markup and control characters. Used for every error that mentions caller text. |
| F2 | Site ids were only checked for `/`, `\` and a leading dot, then used to build a path under the data directory. On a case-insensitive file system `ALPHA` opened the folder `alpha`, giving two spellings of one site (and two cache keys). | Aliasing; on other systems a larger set of odd names reaching the disk. | Site ids must match `^[a-z0-9][a-z0-9_-]{0,63}$` before any file is touched. |
| F3 | Time parameters went to `datetime.fromisoformat`, which accepted a trailing NUL byte. | Odd input accepted silently. | Times must match a strict character set and length first. |
| F4 | `POST /sites/custom` accepted booleans as numbers (`{"lat": true}` started a job at latitude 1). | Unintended job for a nonsense request. | Strict request model: booleans, strings and null are rejected; whole numbers like `40` still work. |
| F5 | `/api/v1/docs` loaded Swagger UI from a third party CDN. | A third party script on our origin, against the rule that fonts and assets are self hosted. | Replaced with a small self contained reference page generated from the OpenAPI document; no external requests. |
| F6 | The API itself set no security headers, so a direct hit on the API port had none. | Defence in depth only (Caddy sets them for normal traffic). | `X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `Permissions-Policy`, `Cross-Origin-Resource-Policy` on every response. |

## Checked and found already sound
* Unhandled exceptions return a generic problem document with a request id; the text of the exception never reaches the client (tested with a secret in the message).
* Malformed, empty, truncated and huge JSON bodies give 4xx, never 500; non-JSON content types give 422.
* Request size limits: compare at most 8 sites and 8 windows, slip matrix at most 40 offsets, windows at most 400 days. Tests send 10 000 sites, 500 windows, 5 000 offsets.
* No CORS headers are sent, so other origins cannot read responses from a browser.
* Rate limiting: a spoofed `X-Forwarded-For` is ignored unless the direct peer is loopback (tested).
* `X-Request-ID` is accepted only if it matches a strict pattern, so it cannot inject headers or log lines.
* PUT, DELETE and PATCH return 405.

## NOT covered, stated plainly
* No authentication exists by design (public read-only tool). Anyone can start custom site jobs; the only brakes are the rate limits, the 120 second job timeout and the worker limit of two jobs. A determined caller could still fill the disk with distinct custom sites. A cap on stored custom sites is a recommended follow-up (not built).
* Rate limit state is in memory per process; three gunicorn workers each keep their own, so the effective limit is up to three times the configured one.
* TLS, HSTS and the browser CSP are configured in Caddy (`infra/Caddyfile`) and were not re-tested here. They belong to the deployment check (P3-08, P7).
* Dependency vulnerabilities: CI checks licences, not known CVEs. `npm audit` and `pip-audit` have not been run as a gate.
* No fuzzing beyond the listed cases, no load or denial of service testing yet (P3-08 records load test results).
* The Redis queue path was tested with a fake Redis and a mocked pool, not against the real Redis on the VM.

## Follow-ups proposed
1. Cap custom sites (count and disk) and expire old ones.
2. Add `pip-audit` and `npm audit --omit=dev` to CI as warnings first.
3. Run the same hostile-input suite against the deployed URL after P3-08.
