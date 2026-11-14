# ADR-0005: Use an sslip.io hostname for the public deployment
Date (UTC): 2026-11-14. Status: accepted. Deciders: Irfan (human decision), with Afreen and Luz present.

## Context
The app needs a public HTTPS address for judging. The team has no registered domain and little time. Caddy needs a hostname that resolves to the VM so it can obtain a certificate automatically.

## Options considered
1. Register a domain and configure DNS. Slow, costs money.
2. Plain IP address. No automatic TLS certificate.
3. sslip.io: a free public DNS service that resolves `<ip-with-dashes>.sslip.io` to that IP.

## Decision
Use option 3. The exact hostname is the `DOMAIN` value in `team.env`. It is the public app URL and appears in the submission.

## Evidence
`nslookup` of the hostname returned the Elastic IP of the VM on 2026-11-14 (recorded in docs/START_LOG.md notes of this phase).

## Consequences and sources
sslip.io is a third-party DNS convenience, not a data source: no project data flows through it, so it needs no ATTRIBUTION row. Certificates come from Let's Encrypt via Caddy, which has rate limits; do not repeatedly reset the server. If the Elastic IP changes the hostname changes, so keep the Elastic IP attached. Revisit if a real domain is acquired.
