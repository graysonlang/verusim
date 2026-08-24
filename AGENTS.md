# Agent Guidance

How AI coding assistants (Claude, Codex, etc.) work in this repo. This file is about *how to work*; what the project *is* belongs in [README.md](README.md), [PLAN.md](PLAN.md), [COMPLETED.md](COMPLETED.md), and `docs/`.

## Project

Verusim is a deterministic behavioral simulation substrate for NPCs whose choices are explicable in hindsight without being scripted in advance. Read [verusim-design-spec.md](verusim-design-spec.md) for the behavioral model, [docs/architecture.md](docs/architecture.md) for implementation boundaries, and [PLAN.md](PLAN.md) before changing model scope. Consult [COMPLETED.md](COMPLETED.md) before changing behavior that may already satisfy a completed phase. The browser workbench uses Solid's reactive core with ordinary DOM and Canvas APIs; it deliberately has no JSX toolchain.

The design spec is authoritative for behavioral intent, architecture for implementation contracts, and the plan for sequencing.
[COMPLETED.md](COMPLETED.md) is the durable record of achieved phase checkpoints and settled phase decisions.
If they conflict, flag and reconcile the conflict rather than silently choosing one.

## Model invariants

- Transitions are pure and deterministic. Runtime randomness never selects an action; generated inputs carry a serializable seed, sampler position, and realized result.
- Level of detail changes cadence, never evaluator fidelity. Do not add a reduced-fidelity behavioral path for distant agents.
- Proximity may gate sampling or presentation, never authoritative state.
- Somatic levels 1–2 modify appraisal; levels 3+ gate it before social terms are evaluated. A preempting gate is a positive causal-trace event, not merely an absent term.
- Authored content supplies facts, stakes, affordances, and direct consequences, never a selected behavior.
- New phenomena should compose shared mechanisms. Do not add per-character handlers or phenomenon-specific subsystems when the existing parameterization should explain the result.

## Hard rules

These are not stylistic preferences. Violating one produces a diff the owner has to undo by hand.

### Markdown

Do not hard-wrap paragraphs to a fixed column. The renderer re-wraps, so a fixed width only makes diffs noisy. Break lines at sentence or phrase boundaries instead — that is where edits land, so it plays nicely with source control. Applies to every `.md` in the repo except `LICENSE.md`.

The same rule governs prose inside HTML content (e.g. `app/index.html`): keep each sentence or phrase on its own line. The browser re-wraps it anyway.

### Source character set

Source code stays 7-bit ASCII (bytes 0x00-0x7F), comments and string literals included. No em-dash, en-dash, arrows, multiplication signs, check marks, or smart quotes. Use the low-ASCII equivalent: ` - `, `-`, `->`, `x`, straight quotes.

This governs source files (`.js`, `.mjs`, `.ts`, `.rs`, `.swift`, `.py`, `.sh`, and the like). Markdown prose may use non-ASCII freely.

### Configuration files

JSON configs are strict JSON: no comments, no trailing commas. If a config genuinely needs commentary, put it in the README rather than switching the file to JSONC.

### Language

US English spelling throughout — code, comments, UI strings, and docs. color (not colour), center, gray, behavior, license, honor, canceled, labeled, and -ize verbs (serialize, normalize, recognize).

### Commits

No AI-attribution trailers of any kind: no `Co-Authored-By: Claude`, no "Generated with" line. Write the message as the author's own.

Commit incremental, logically grouped changes as you go. The message is a concise one-liner.

Before handing off completed work, push every commit created for the task to the current branch's configured upstream.
If the branch has no upstream or the push is rejected, do not invent a remote, force-push, or bypass branch protection; report the blocker clearly.

## Working in this repo

### Plan maintenance

Active and future phase details live in [PLAN.md](PLAN.md).
Completed phases, their exit probes, and settled phase decisions live in [COMPLETED.md](COMPLETED.md).
When a phase is complete and the verification gate is green, move its complete section wholesale from the plan to the completed record in the same commit.
Do not leave the same phase active in both files.
If completed scope is reopened, move that phase back to the plan before changing it, then return it to the completed record only after its new exit probes and the full gate pass.
Keep retrospective additions concise and update both files whenever phase scope or status changes.
For a newly completed or reopened phase, the completed record names the discriminating scenario or fixture, the regression coverage for its exit probes, snapshot replay evidence when persisted state changed, UI verification when presentation changed, and schema or migration boundaries when storage changed.
Omit evidence categories that genuinely do not apply rather than adding placeholders.

### Host and content boundaries

`src/model` and `src/simulation` remain host-agnostic.
They do not import filesystem, network, browser storage, process, terminal, or path APIs.
Content acquisition and repository discovery live in adapters outside the simulation subsystem, and every source-backed or direct in-memory path converges on the same migration, validation, reference-resolution, and prepared-scenario boundary before state creation.
Creating, stepping, serializing, or resuming a simulation performs no resource reads, registration, enumeration, or asynchronous lookup.

Authoring discovery and packing are deterministic build concerns.
They may not depend on filesystem enumeration order, absolute checkout paths, locale, timezone, host case sensitivity, or registration order.
Directory paths organize source but never define semantic identity, and duplicate semantic addresses fail with actionable provenance instead of resolving by precedence or last-one-wins behavior.

### Behavioral changes

Each implementation phase ends with a scenario that makes the wrong mechanism visibly fail.
Harness assertions are ordinal rather than tied to calibration constants, and they inspect aftermath state when coincident actions could hide different mechanisms.
Malformed content fails at an actionable authored path; do not add silent best-effort parsing.
Record new unresolved design choices in the spec's open-decision sections rather than adding untested fields that appear authoritative.

### Verification gate

A change is done when all four are green:

```sh
npm run typecheck   # tsc --noEmit
npm run lint        # biome check .
npm test            # node --test, over an esbuild bundle
npm run build       # esbuild, via esp's runner
```

`npm run check` chains all four. Run them before claiming a change works. If one fails, say so with the output rather than describing the change as complete.

Formatting is Biome's job, not yours. Do not hand-format to match the surrounding code and do not argue with the formatter — run `npm run lint:fix` and take what it produces. The one thing worth knowing: `.vscode/launch_template.json` is deliberately excluded from Biome, because the `{{debug}}` placeholders in it are not valid JSON.

### Use an isolated preview server

Do not run `npm run dev` or `npm run serve` for routine validation unless the user explicitly asks.
Those commands belong to the owner's visible development workflow and use its automatically deduced port.

For browser validation, an agent may start its own isolated preview without additional authorization by using `node scripts/build.mjs --serve --port=<agent-reserved-port> --sourcemap`.
The port must be explicitly reserved for that agent rather than automatically selected, and the agent must navigate to the exact emitted URL and stop the preview when validation finishes.

`npm run build` is the right check that something compiles.

### Playwright tool availability

Do not infer whether Playwright MCP is available from memory, prior messages, the presence or absence of an in-app browser bridge, or other browser tools.

When browser validation is required, attempt to invoke the Playwright MCP `browser_navigate` tool directly.

If that invocation succeeds, continue browser validation with Playwright. Do not claim that Playwright MCP is unavailable merely because another browser mechanism, such as the in-app browser or Node REPL bridge, is unavailable.

Only report Playwright MCP as unavailable if an attempted Playwright MCP tool invocation itself fails because the tool is absent or inaccessible.

The in-app browser and Playwright MCP are independent browser-control paths. Failure of the in-app browser does not imply failure of Playwright MCP.

### Browser validation

For browser-visible changes, try the `browser-use` skill against the owner's existing in-app browser session first. If that path is unavailable after completing the skill's required tool discovery, use the configured Playwright MCP server as the preferred fallback.

Preserve the server rules above: never start `npm run dev` or `npm run serve` merely for browser verification.
Reuse the owner's current app when the browser can reach it; otherwise start an isolated preview on the agent's explicitly reserved port, navigate to the exact emitted URL, and stop the preview afterward.

Start ordinary control inspection from a structured DOM or accessibility snapshot and prefer semantic roles, names, labels, or test IDs. Use screenshots for visual layout and Canvas results, not as the primary way to locate ordinary DOM controls. Canvas verification should combine application or DOM state, browser runtime evidence, and rendered pixels where each applies.

After load and interaction, inspect unexpected console errors and relevant failed network requests, including HTTP, WASM, worker, and asset failures. Wait for observable state rather than fixed sleeps. Report the exercised flow, assertions, console and network results, and visual checks; if browser validation was unavailable, say so explicitly.

### Where not to look

When searching for source, skip generated and dependency directories — `www/`, `dist/`, `dist-tests/`, `node_modules/` — unless the user expressly asks you to inspect them. Hits there are stale copies of real source and will send you down the wrong path.

## Response preferences

Keep final responses compact. Lead with the meaningful outcome.

Do not list verification commands or local URLs unless the user asks for them, or a check failed and it explains the blocker.

Do not use clickable markdown links for local files — the enumerated changes list at the end of the chat already covers them.

Do not include a hyperlink "open" card for the built `index.html`.

## Anti-patterns

- Treating chat history as authoritative. Externalize durable decisions into markdown; a long conversation is not a source of truth.
- Continuing a sprawling conversation instead of formalizing the decision and starting fresh.
- Introducing terminology that conflicts with names already in the codebase.
- Widening scope past what was asked. Discovered work is a new item, not growth of the current one.
- Adding a dependency where a few lines of local code would do. The dependency graph here is deliberately tight.
