# agent/experiment_config.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional
import os


# -------------------------
# Experiment dimensions
# -------------------------

PromptPolicy = Literal["C0", "C1", "C2", "C3"]
SanitizeLevel = Literal["comments", "comments_spans", "full"]


@dataclass(frozen=True)
class ExperimentConfig:
    """
    Global experiment / prompt-policy configuration.

    This config controls:
    - Prompt isolation policy (C0–C3)
    - Whether model reasoning is logged and/or exposed
    - Email body sanitization strength (only active under C3)
    - Optional fixed user-instruction template

    IMPORTANT SEMANTICS:
    --------------------
    1) prompt_policy:
        - C0: Raw (no labeling, no isolation, no sanitization)
        - C1: Label-only (email body marked as untrusted, but not isolated)
        - C2: Quoted/Isolated (email body wrapped with explicit boundaries)
        - C3: Sanitized (email body preprocessed to remove hidden content)

    2) sanitize_level:
        - ONLY applied when prompt_policy == "C3"
        - Ignored for C0 / C1 / C2

    3) reasoning visibility:
        - hide_reasoning=True  -> reasoning is NOT returned to UI/API
        - log_reasoning=True   -> reasoning MAY still be logged internally
        - hide_reasoning takes precedence over log_reasoning for exposure

    Defaults are intentionally backward-compatible:
    - C1 approximates your current behavior
    - reasoning is hidden unless explicitly enabled
    """

    # Prompt / isolation policy
    prompt_policy: PromptPolicy = "C1"

    # Reasoning control
    log_reasoning: bool = False
    hide_reasoning: bool = False

    # Sanitization (effective only under C3)
    sanitize_level: SanitizeLevel = "comments"

    # Optional fixed instruction template, e.g.:
    # "The user requests the following task:\n{instruction}"
    instruction_template: Optional[str] = None

    # -------------------------
    # Environment loader
    # -------------------------

    @staticmethod
    def from_env() -> "ExperimentConfig":
        """
        Load experiment configuration from environment variables.

        Supported variables:
        - MAILBOX_PROMPT_POLICY = C0 | C1 | C2 | C3
        - MAILBOX_LOG_REASONING = 1 / true / yes
        - MAILBOX_HIDE_REASONING = 1 / true / yes
        - MAILBOX_SANITIZE_LEVEL = comments | comments_spans | full
        - MAILBOX_INSTRUCTION_TEMPLATE = string with optional {instruction}
        """

        # ---- prompt policy ----
        policy = (os.getenv("MAILBOX_PROMPT_POLICY") or "C1").upper().strip()
        if policy not in ("C0", "C1", "C2", "C3"):
            policy = "C1"

        # ---- reasoning flags ----
        log_reasoning = (os.getenv("MAILBOX_LOG_REASONING") or "0").strip().lower() in (
            "1", "true", "yes"
        )
        hide_reasoning = (os.getenv("MAILBOX_HIDE_REASONING") or "0").strip().lower() in (
            "1", "true", "yes"
        )

        # ---- sanitization ----
        sanitize_level = (os.getenv("MAILBOX_SANITIZE_LEVEL") or "comments").strip()
        if sanitize_level not in ("comments", "comments_spans", "full"):
            sanitize_level = "comments"

        # ---- instruction template ----
        instruction_template = os.getenv("MAILBOX_INSTRUCTION_TEMPLATE")
        if instruction_template is not None and instruction_template.strip() == "":
            instruction_template = None

        return ExperimentConfig(
            prompt_policy=policy,            # type: ignore
            log_reasoning=log_reasoning,
            hide_reasoning=hide_reasoning,
            sanitize_level=sanitize_level,    # type: ignore
            instruction_template=instruction_template,
        )
