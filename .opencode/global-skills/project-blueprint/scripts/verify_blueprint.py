#!/usr/bin/env python3
"""verify_blueprint.py - mechanical checks for project-blueprint output.

Runs the automatable checks from references/verification.md over a docs/ tree and
prints a report. It does NOT judge semantic quality (that needs reading the docs);
it clears the mechanical checks and lists ID candidates (US/FR/Q defined vs
referenced) so the semantic pass in references/verification.md is fast.

Usage:
    python verify_blueprint.py [docs_dir]        # default: docs
    python verify_blueprint.py docs --strict     # exit 1 on any FAIL
    python verify_blueprint.py docs --questions  # print all open questions as one table

Exit code: 0 if no FAIL (warnings allowed), 1 if any FAIL (with --strict always
on FAIL). ASCII-only output.
"""
import os
import re
import sys

FEATURE_KEYS = ["feature:", "status:", "depends-on:", "owner:", "priority:", "estimate:"]
TASK_KEYS = ["id:", "feature:", "status:", "depends-on:", "owner:", "estimate:", "verify:"]

fails = []
warns = []


def fail(msg):
    fails.append(msg)


def warn(msg):
    warns.append(msg)


def read_text(path):
    with open(path, "rb") as fh:
        raw = fh.read()
    bom = raw.startswith(b"\xef\xbb\xbf")
    text = raw.decode("utf-8-sig", errors="replace")
    return text, bom


def collect_md(root):
    out = []
    for dirpath, _, files in os.walk(root):
        for fn in files:
            if fn.endswith(".md"):
                out.append(os.path.join(dirpath, fn))
    return sorted(out)


def check_ascii_bom(root, files):
    for f in files:
        text, bom = read_text(f)
        rel = os.path.relpath(f, root)
        if bom:
            fail("[BOM] %s starts with a UTF-8 BOM (save UTF-8 without BOM)" % rel)
        bad = {}
        for ch in text:
            if ord(ch) > 127:
                bad[ch] = bad.get(ch, 0) + 1
        if bad:
            desc = ", ".join("'%s' U+%04X x%d" % (c, ord(c), n) for c, n in list(bad.items())[:8])
            fail("[ASCII] %s has non-ASCII: %s" % (rel, desc))


def check_links(root, files):
    for f in files:
        text, _ = read_text(f)
        base = os.path.dirname(f)
        rel = os.path.relpath(f, root)
        for m in re.finditer(r"\]\(([^)]+)\)", text):
            target = m.group(1).strip()
            if not target or target.startswith(("http://", "https://", "mailto:", "#")):
                continue
            path_part = target.split("#")[0]
            if not path_part:
                continue
            dest = os.path.normpath(os.path.join(base, path_part))
            if not os.path.exists(dest):
                fail("[LINK] %s -> %s (missing target)" % (rel, target))


def count_lines(path):
    text, _ = read_text(path)
    return len(text.splitlines())


def parse_frontmatter(text):
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    if end == -1:
        return None
    return text[3:end]


def check_structure(root, files):
    impl_dir = os.path.join(root, "implementations")
    for f in files:
        rel = os.path.relpath(f, root).replace("\\", "/")
        n = count_lines(f)
        if rel == "IMPLEMENTATION_PLAN.md" and n > 60:
            warn("[SIZE] IMPLEMENTATION_PLAN.md is %d lines (target <= 1 page / ~60)" % n)
        is_task = "/tasks/" in rel
        is_feature = rel.startswith("implementations/") and not is_task and re.search(r"/\d\d-[^/]+\.md$", "/" + rel)
        if is_task:
            if n > 100:
                fail("[SIZE] task %s is %d lines (>100, split it)" % (rel, n))
            fm = parse_frontmatter(read_text(f)[0])
            if fm is None:
                fail("[FM] task %s has no frontmatter" % rel)
            else:
                missing = [k for k in TASK_KEYS if k not in fm]
                if missing:
                    fail("[FM] task %s missing keys: %s" % (rel, ", ".join(missing)))
                vm = re.search(r"verify:\s*(.+)", fm)
                if not vm or vm.group(1).strip() in ("", '""', "''"):
                    fail("[FM] task %s has empty verify" % rel)
        if is_feature:
            if n > 200:
                fail("[SIZE] feature %s is %d lines (>200, split it)" % (rel, n))
            fm = parse_frontmatter(read_text(f)[0])
            if fm is None:
                fail("[FM] feature %s has no frontmatter" % rel)
            else:
                missing = [k for k in FEATURE_KEYS if k not in fm]
                if missing:
                    fail("[FM] feature %s missing keys: %s" % (rel, ", ".join(missing)))


def defined_ids(files, root):
    """Collect US/FR/Q ids that are DEFINED (in a definition position)."""
    us_defined = set()
    fr_defined = set()
    # PRD user stories: lines like "- **US1** (Must)" or "- **US1** (Should)"
    prd = os.path.join(root, "PRD.md")
    if os.path.exists(prd):
        for line in read_text(prd)[0].splitlines():
            m = re.match(r"\s*-\s*\*\*(US\d+)\*\*", line)
            if m:
                us_defined.add(m.group(1))
    # TRD functional requirements: table rows "| FR1 | ..."
    trd = os.path.join(root, "TRD.md")
    if os.path.exists(trd):
        for line in read_text(trd)[0].splitlines():
            m = re.match(r"\s*\|\s*(FR\d+)\s*\|", line)
            if m:
                fr_defined.add(m.group(1))
    return us_defined, fr_defined


def check_id_origin(root, files):
    us_defined, fr_defined = defined_ids(files, root)
    us_ref = {}
    fr_ref = {}
    for f in files:
        text, _ = read_text(f)
        rel = os.path.relpath(f, root).replace("\\", "/")
        for i, line in enumerate(text.splitlines(), 1):
            for m in re.finditer(r"\bUS(\d+)\b", line):
                us_ref.setdefault("US" + m.group(1), []).append("%s:%d" % (rel, i))
            for m in re.finditer(r"\bFR(\d+)\b", line):
                fr_ref.setdefault("FR" + m.group(1), []).append("%s:%d" % (rel, i))
    # orphans = referenced but not defined (only meaningful if a PRD/TRD exists)
    if us_defined:
        for uid in sorted(us_ref, key=lambda x: int(x[2:])):
            if uid not in us_defined:
                locs = ", ".join(us_ref[uid][:4])
                fail("[US-ORPHAN] %s referenced but not defined in PRD Sec.6 (at %s)" % (uid, locs))
    if fr_defined:
        for fid in sorted(fr_ref, key=lambda x: int(x[2:])):
            if fid not in fr_defined:
                locs = ", ".join(fr_ref[fid][:4])
                fail("[FR-ORPHAN] %s referenced but not defined in TRD Sec.3 (at %s)" % (fid, locs))
    # dangling open-question refs, per file. Only meaningful when the file has its
    # OWN Open Questions table: then any Q# it cites that its table omits is dangling.
    # Files without an Open Questions table cite Q# from other docs on purpose - skip.
    for f in files:
        text, _ = read_text(f)
        rel = os.path.relpath(f, root).replace("\\", "/")
        q_defined = set(re.findall(r"\|\s*(Q\d+)\s*\|", text))
        if not q_defined:
            continue
        q_used = set(re.findall(r"\b(Q\d+)\b", text))
        dangling = sorted(q_used - q_defined, key=lambda x: int(x[1:]))
        if dangling:
            warn("[Q-DANGLING] %s has an Open Questions table but cites undefined %s"
                 % (rel, ", ".join(dangling)))
    print("\nID summary:")
    print("  US defined in PRD: %s" % (", ".join(sorted(us_defined, key=lambda x: int(x[2:]))) or "(none)"))
    print("  FR defined in TRD: %s" % (", ".join(sorted(fr_defined, key=lambda x: int(x[2:]))) or "(none)"))
    if us_defined:
        print("  US referenced not defined: %s" % (", ".join(
            sorted([u for u in us_ref if u not in us_defined], key=lambda x: int(x[2:]))) or "none"))
    if fr_defined:
        print("  FR referenced not defined: %s" % (", ".join(
            sorted([f for f in fr_ref if f not in fr_defined], key=lambda x: int(x[2:]))) or "none"))


def print_questions(root, files):
    """Print every Open Questions row across docs as one table (for Workflow step 7)."""
    print("Open questions across all docs (offer these to the user once, with a recommendation each):\n")
    print("  %-4s %-28s %-55s %-14s %-10s" % ("Q#", "Doc", "Question", "Owner", "Needed by"))
    print("  " + "-" * 116)
    total = 0
    for f in files:
        text, _ = read_text(f)
        rel = os.path.relpath(f, root).replace("\\", "/")
        lines = text.splitlines()
        # locate the "Open questions" heading, read the first table under it
        idx = None
        for i, line in enumerate(lines):
            if re.match(r"\s*#+\s*.*open questions", line, re.I):
                idx = i
                break
        if idx is None:
            continue
        for line in lines[idx:idx + 40]:
            if re.match(r"\s*#+\s", line) and idx is not None and line is not lines[idx]:
                break
            m = re.match(r"\s*\|\s*(Q\d+)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|", line)
            if m:
                q, question, owner, needed = m.group(1), m.group(2), m.group(3), m.group(4)
                q = question[:53]
                print("  %-4s %-28s %-55s %-14s %-10s" % (m.group(1), rel[:28], q, owner[:14], needed[:10]))
                total += 1
    print("\n  total open questions: %d (TBD items inside docs count too)" % total)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    strict = "--strict" in sys.argv
    questions_only = "--questions" in sys.argv
    root = args[0] if args else "docs"
    if not os.path.isdir(root):
        print("ERROR: docs dir not found: %s" % root)
        return 2
    files = collect_md(root)
    if questions_only:
        print("verify_blueprint --questions: %d markdown files under %s" % (len(files), root))
        print_questions(root, files)
        return 0
    print("verify_blueprint: %d markdown files under %s" % (len(files), root))
    check_ascii_bom(root, files)
    check_links(root, files)
    check_structure(root, files)
    check_id_origin(root, files)

    print("\n==== RESULT ====")
    if warns:
        print("WARN (%d):" % len(warns))
        for w in warns:
            print("  - " + w)
    if fails:
        print("FAIL (%d):" % len(fails))
        for f in fails:
            print("  - " + f)
        print("\nSTATUS: FAIL - fix the items above or record an accepted WAIVED reason.")
        return 1
    print("PASS: no mechanical failures.")
    print("STATUS: PASS - now do the semantic checks in references/verification.md (Sec.3-8).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
