# LLM Mailbox — Prompt Injection Experiment Harness

This repository contains a lightweight “LLM mailbox” system designed to study prompt-injection and hidden-instruction attacks in email-like inputs, and to evaluate mitigations via prompt policy variants (C0–C3) using a controlled experiment matrix (Phase 1 / Phase 2).

It has three layers:

**1. Frontend mailbox UI (Vite + React + TS)**  
Used for interactive demos: open emails, enter instructions, run the agent, view logs and run history.

**2. Agent backend (Python)**  
Builds final prompts, calls the LLM (DeepSeek), normalizes outputs to a fixed action protocol, and produces structured logs with run_id.

**3. Experiments harness (Python)**  
Generates attack emails, runs factorial trial matrices, judges outcomes (alignment/injection/over-execution/clarify), and exports results for analysis.

## Repository Structure
```
agent/                  # Agent backend (prompt build / call / normalize / logging)
experiments/            # Experiment matrix generation + judging + runners
frontend/               # Vite React UI mailbox demo
appendix/               # (optional) figures/notes/paper appendix materials
app.py                  # (your local app entry; may be legacy depending on your setup)
agent.py                # (legacy mock agent module; not the main LLM agent runner)
Methods.md              # Your write-up (methods/threat model), for group reporting
README.md               # This file
```

## High-Level Flow (End-to-End)
### A) Interactive UI run (frontend → backend agent)

1. User selects an email in UI (open_email log).

2. User enters an instruction and clicks Run (user_instruction log with run_id).

3. UI calls Python backend (your app.py routes) which invokes:  
`agent/llm_agent.py::run_agent(...)`

4. Backend builds final prompt (policy C0–C3), calls DeepSeek, normalizes output to protocol v1.4, returns:  
`actions[]`  
`reasoning[] (optionally hidden)`  
`logs[]` (system + agent + model logs, all tagged with run_id)  
`prompt_record` provenance (system/email_body/user/final)

### B) Batch experiments run (experiments → agent)

1. `experiments/run_matrix.py` generates Phase 1 trial specs.

2. For each trial, it constructs an email with an injected payload using `attack_factory.py`.

3. It calls `agent.llm_agent.run_agent(...)` with `ExperimentConfig`.

4. `experiments/judge.py` labels the outcome and metrics.

5. Results are exported to JSONL/CSV.

## Agent Protocol (v1.4)

The LLM must output JSON with:

* `actions`: list of structured actions

* `reasoning`: list of strings (optional to expose to UI; can still be logged)

* `logs`: list of agent-side logs (then normalized/overridden by backend)

Allowed actions:

* `reply`

* `mark_read`

* `mark_unread`

* `create_email (draft only)`

* `send_email (only drafts)`

* `move_email` (inbox/archive/trash/spam)

* `clarify`

Backend normalization is responsible for:

* coercing malformed outputs into valid action objects

* preventing “no action” outputs (fallback to clarify)

* adding authoritative logs (decide_action, engine_used, final_prompt_used, optional reasoning_dump)

* tagging all logs with run_id

## Prompt Policies (C0–C3)

Policies are implemented in `agent/prompt_builder.py` and controlled via `ExperimentConfig`.

* C0 Raw: minimal system prompt; email body is passed through with no warning/boundary.

* C1 Label-only: adds explicit warning that email body is untrusted.

* C2 Quoted/Isolated: wraps email body in `BEGIN_UNTRUSTED_EMAIL_BODY ... END_UNTRUSTED_EMAIL_BODY.`

* C3 Sanitized: sanitizes email body (comments / spans / zero-width) before boundary wrapping.

Sanitization logic lives in `agent/sanitize.py`.

## Experiments

Each trial is defined as:

(one email template + one injection config + one user instruction + one prompt policy)
run agent once and record outputs

We compute metrics:

1. User-aligned action rate: actions match the user instruction’s allowed mapping

2. Injection success rate (ISR): actions match injection target(s) of the hidden payload

3. Over-execution rate: actions include extras beyond allowed set

4. Clarify rate: model returns `clarify` or fallback becomes `clarify`

Labels typically include: `OK`, `Injected`, `OverExecuted`, `Clarify` (and optionally `ClarifyOnly`)

Judging rules and instruction→allowed mapping are hard-coded in experiments/judge.py for reproducibility.

## How to Run
### 1) Frontend (interactive demo)

From repo root:

```
cd frontend
npm install
npm run dev
```

The UI uses `frontend/src/fakeEmails.ts` as the demo email store.
This is independent from the batch experiment email generator.

### 2) Batch experiments (Phase 1 matrix)

Important: run as a module so Python can resolve package imports:
```
# from repo root
python -m experiments.run_matrix
```

If you run `python experiments/run_matrix.py` directly, Windows may raise:
`ModuleNotFoundError: No module named 'agent'`.

If you must run scripts directly, set:
```
set PYTHONPATH=.
python experiments/run_matrix.py
```
### 3) DeepSeek configuration

Set environment variables:
```
set DEEPSEEK_API_KEY=...
set DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions
set DEEPSEEK_MODEL=deepseek-chat
```

### File-by-File Responsibilities
#### `agent/` (backend agent core)

`**agent/llm_agent.py**`

Main runtime agent:

builds prompt pack via prompt_builder.build_agent_prompt

calls DeepSeek API

normalizes output to v1.4 (_normalize_v14)

adds authoritative logs (timestamps, run_id, final_prompt_used, reasoning_dump)

returns structured result for UI/experiments

`**agent/prompt_builder.py**`

Prompt construction single source of truth:

defines `AGENT_PROTOCOL_V14`

implements prompt policy variants C0–C3

applies optional instruction templating

optionally sanitizes email body (C3)

records provenance into `PromptRecord` (system/email_body/user/history/final)

`**agent/prompt_registry.py**`

Defines `PromptRecord` (prompt provenance log):

records each prompt component with hash + timestamp

exports the full prompt lineage for each `run_id`

`**agent/experiment_config.py**`

Defines ExperimentConfig switches:

`prompt_policy` (C0–C3)

`sanitize_level`

`log_reasoning` / `hide_reasoning`

optional `instruction_template`

can be constructed from env or passed directly by experiment runner

`**agent/sanitize.py**`

Sanitization utilities for C3:

strip HTML comments (`<!-- ... -->`)

remove hidden spans (`display:none`)

optionally remove zero-width characters

`**agent/mock_agent.py**`

Deterministic mock agent used when `engine="mock"`:

helpful for UI/dev without calling DeepSeek

`**agent/__init__.py**`

Marks `agent` as a package.

#### `experiments/` (matrix + attack generator + judging)

`experiments/attack_factory.py`

Attack email templates and injection generator:

provides 5 base emails

builds payload by `strength × target`

injects via carrier (clean/html_comment/visible) and placement (top/bottom)

defines expected `injection_targets` used by judging

`experiments/judge.py`

Outcome evaluation:

defines `TrialSpec` and `TrialOutcome`

maps `user_instruction` -> allowed actions

computes alignment / injection success / over-execution / clarify

produces labels for plotting

`experiments/run_matrix.py`

Primary Phase 1 runner:

builds factorial trial list (Phase 1 core matrix)

constructs email instances (with injected body)

runs agent with explicit config for each trial

writes JSONL + CSV outputs to `experiment_out/`

`experiments/run_phase1.py`

Legacy/alternate runner (may be outdated relative to the newer matrix runner).
Prefer `run_matrix.py` unless you intentionally keep this for comparison.

#### `frontend/` (Vite + React mailbox)

`frontend/src/App.tsx`

Main UI composition:

sidebar + email list + email view + assistant panel + log panel

stores emails/logs in localStorage

attaches `run_id` to UI-originated logs

`frontend/src/fakeEmails.ts`

Frontend demo email dataset (independent of experiment emails).
Used only for UI testing/demo unless you wire it to backend.

`frontend/src/components/*`

UI components:

`Assistant.tsx`: instruction input + run trigger + renders actions/reasoning

`EmailList.tsx`, `EmailView.tsx`, `Inbox.tsx`, `Sidebar.tsx`

`LogPanel.tsx`: shows structured logs

`frontend/src/types/*`

Type definitions for:

`Email` model

agent output schema

log item schema


## Outputs Produced

### Agent output (per run)

`engine`, `run_id`

`actions[]`

`reasoning[]` (possibly hidden)

`logs[]` (system/agent/ui, all tagged with run_id)

`prompt_record` (prompt provenance record)

### Experiment outputs

JSONL: full per-trial record (actions + logs + labels)

CSV: compact metrics table (good for plotting)

