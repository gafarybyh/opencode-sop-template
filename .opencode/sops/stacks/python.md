# Stack — Python (FastAPI / Django / Flask)

## Verify (phase 5)

| Lint | Typecheck | Test | Build |
|---|---|---|---|
| `rtk ruff check` | `rtk mypy .` | `rtk pytest` | `rtk python -m build` |

A missing tool is a gap, not a pass: record `N/A <check>: <reason>`. Do not add
a framework silently.

## Anti-slop

- Validate at the boundary; never trust request input.
- No secrets in code, logs, or responses. Use the project's settings layer.
- Match the existing project layout, import style, and error-handling pattern.
- No new dependency for a small utility; write the few lines.

## One-command backend gate

When the backend has a `qa-api.config.json` (it must, see `stacks/_backend.md`), run
`node .opencode/scripts/qa-api.mjs --dir <backend-dir>` (tests + coverage + live smoke + secret scan). Set
`"framework": "python"` in the config so the gate runs pytest and parses pytest's output. When the deps live
in a virtualenv rather than the system interpreter, point the interpreter at it:
`--python <venv>/Scripts/python.exe` (Windows) or `--python <venv>/bin/python` (POSIX).

```json
{
  "framework": "python",
  "test": ["python", "-m", "pytest"],
  "coverage": ["python", "-m", "pytest", "--cov=app", "--cov-report=term"],
  "start": ["python", "-m", "uvicorn", "server:app", "--port", "${PORT}"],
  "readyPath": "/health",
  "coverageMin": 70,
  "smoke": [
    { "method": "GET", "path": "/api/items", "expect": 200 },
    { "method": "POST", "path": "/api/items", "body": {}, "expect": 400 },
    { "method": "GET", "path": "/api/items/nope", "expect": 404 }
  ]
}
```

The gate reads "N passed" from pytest's summary; a project `addopts = "-q"` that would hide it is handled by an
automatic retry. Supply chain: `rtk pip-audit`.
