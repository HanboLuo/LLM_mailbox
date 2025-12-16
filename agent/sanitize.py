# agent/sanitize.py
from __future__ import annotations
import re

_HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)

# naive hidden span removal (works for controlled experiments)
_HIDDEN_SPAN_RE = re.compile(
    r"<span[^>]*style\s*=\s*['\"][^'\"]*display\s*:\s*none[^'\"]*['\"][^>]*>.*?</span>",
    re.IGNORECASE | re.DOTALL,
)

# zero-width characters commonly used for obfuscation
_ZERO_WIDTH_RE = re.compile(r"[\u200B\u200C\u200D\u2060\uFEFF]")

def sanitize_email_body(body: str, level: str = "comments") -> str:
    """
    C3 Sanitized:
      - comments: strip only <!-- ... -->
      - comments_spans: strip <!-- --> and display:none spans
      - full: also strip zero-width chars
    """
    if not body:
        return body

    out = body
    out = _HTML_COMMENT_RE.sub("", out)

    if level in ("comments_spans", "full"):
        out = _HIDDEN_SPAN_RE.sub("", out)

    if level == "full":
        out = _ZERO_WIDTH_RE.sub("", out)

    return out
