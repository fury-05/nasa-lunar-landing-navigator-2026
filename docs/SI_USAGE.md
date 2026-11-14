# SI usage disclosure

The Space Apps FAQ uses the term SI for AI tools and asks each submission to describe how SI tools were used. Keep this file current.

## Tools
Claude (Anthropic) through Claude Desktop with models via AWS Bedrock (record exact model ids used per phase).

## How SI was used
Phase 0 (2026-11-14): Claude (model Sonnet 5.5, exact id recorded in the session log) scaffolded the Python workspace, FastAPI health endpoints, the React shell with design tokens, and the README. Humans chose the repo name, licence direction, commit mode and infrastructure, and supplied the VM.

Fill per phase: scaffolding, engine code, tests, UI, documentation, deployment scripts. State what humans decided, reviewed and verified.

## Human responsibility
The onboarded collaborators (Irfan, Afreen and Member 3 once onboarded) specified requirements, chose data sources, reviewed every pull request, ran validation steps that need a human (QuickMap checks, accessibility checks), and own the final submission.

## Commit attribution
During this hackathon all three collaborators sit together at the same workstation and follow the build as it happens; they asked Claude to work on all three tracks to save time. Commit trailers (COMMIT_MODE=coauthor) credit the track owner of each task. Teammates review PRs and run the human validation steps.

All commits were created from one workstation (Irfan's Claude Desktop session, GitHub login fury-05). Author names reflect the collaborator responsible for the task, used with their consent (or credited as Co-authored-by). Teammates reviewed, commented and performed human validation from their own accounts.

## Runtime SI
None in calculations. (If the optional explainer from ROADMAP is built: describe it here and label its output in the UI.)

## Pre-event material
List planning documents and concept mockups prepared before the event and state that none of their code or assets is in this repository.
