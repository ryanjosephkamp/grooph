#!/usr/bin/env python3
"""Runs every command the beginner's guide (docs/plain-english/) shows, in the guide's order, in an empty folder,
and says where what is printed differs from what the guide shows under it. No model is started: these are grooph's
own commands and a few cp and echo lines. `grooph` is the build in the repository given, not one on the PATH.

  python3 guide-commands.py <repository, built> <scratch folder> [chapter prefix, such as 07]

It knows three things the chapters say in words and not as commands: chapter 4 starts again from the template,
chapter 9 copies the sample map in, and chapter 11 is in a project folder of its own. `grooph watch` is stopped
after four seconds. The install line on the start page is not run. A line that is only "…" in the guide stands for
any lines, and shown output that is an excerpt (its lines printed in order among others) counts as the same.
Exit code 1 when anything differs."""
import glob, os, re, shutil, subprocess, sys, difflib
repo, scratch = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
only = sys.argv[3] if len(sys.argv) > 3 else None
work = os.path.join(scratch, "work"); shutil.rmtree(work, ignore_errors=True); os.makedirs(work)
shutil.rmtree(os.path.join(scratch, "work-11"), ignore_errors=True)
os.makedirs(os.path.join(scratch, "bin"), exist_ok=True)
with open(os.path.join(scratch, "bin", "grooph"), "w") as f: f.write('#!/bin/sh\nexec node "%s/packages/cli/bin/grooph.js" "$@"\n' % repo)
os.chmod(os.path.join(scratch, "bin", "grooph"), 0o755)
env = dict(os.environ, PATH=os.path.join(scratch, "bin") + ":" + os.environ["PATH"], NO_COLOR="1")
def blocks(path):
    s = open(path).read().split("\n"); i = 0
    while i < len(s):
        if s[i].strip() == "```bash":
            j = i + 1; cmd = []
            while s[j].strip() != "```": cmd.append(s[j]); j += 1
            k = j + 1; out = None
            while k < len(s) and k < j + 7:
                if s[k].strip() in ("```text", "```json", "```"):
                    m = k + 1
                    while s[m].strip() != "```": m += 1
                    ind = len(s[k]) - len(s[k].lstrip())
                    out = [x[ind:] if x[:ind].strip() == "" else x for x in s[k + 1:m]]; break
                if s[k].strip() == "```bash": break
                k += 1
            yield i + 1, cmd, out
            i = j
        i += 1
def norm(t):
    t = t.replace(repo, "<grooph>")
    for w in (os.path.join(scratch, "work-11"), work): t = t.replace(os.path.realpath(w), ".").replace(w, ".")
    return [l.rstrip() for l in t.rstrip("\n").split("\n")]
def same(shown, got):
    pat = "\n".join(".*" if l.strip() == "…" else (re.escape(l.rstrip()[:-1]) + "[^\n]*" if l.rstrip().endswith("…") else re.escape(l.rstrip())) for l in shown)
    if re.fullmatch(pat, "\n".join(got), re.S) is not None: return True
    # An excerpt: every line shown is printed, in order, among others.
    it = iter(got)
    return all(any(l.rstrip() == g for g in it) for l in shown if l.strip() != "…")
files = sorted(glob.glob(os.path.join(repo, "docs/plain-english/[0-9]*.md"))) + [os.path.join(repo, "docs/plain-english/README.md")]
bad = 0; ran = 0
for f in files:
    name = os.path.basename(f)
    for line, cmd, shown in blocks(f):
        text = "\n".join(cmd)
        if "git clone" in text: continue
        inrepo = re.search(r"(?<![\w>/.])(fixtures|experiments)/", text.replace("<grooph>/", "")) is not None and "<grooph>" not in text
        run = text.replace("<grooph>", repo)
        # What the chapters do in words before a command: chapter 4 starts again from the template, chapter 9 copies the
        # sample map in, and chapter 11 is in a project folder of its own with nothing recorded.
        if name.startswith("04") and "template use" in run and "--out rounding.grooph.json" in run and os.path.exists(os.path.join(work, "rounding.grooph.json")): os.remove(os.path.join(work, "rounding.grooph.json"))
        if name.startswith("09") and not os.path.exists(os.path.join(work, "team.grooph-map.json")): shutil.copy(os.path.join(repo, "fixtures/maps/valid/a-person-and-two-sessions.grooph-map.json"), os.path.join(work, "team.grooph-map.json"))
        here = work
        if name.startswith("11") and not inrepo:
            here = os.path.join(scratch, "work-11"); os.makedirs(here, exist_ok=True)
        try:
            p = subprocess.run(run, shell=True, cwd=repo if inrepo else here, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=4 if "grooph watch" in run else 120)
            got = norm(p.stdout); code = p.returncode
        except subprocess.TimeoutExpired as e:
            got = norm((e.stdout or b"").decode() if isinstance(e.stdout, bytes) else (e.stdout or "")); code = "stopped"
        ran += 1
        if only and not name.startswith(only): continue
        if shown is None:
            if code not in (0, "stopped"): print(f"\n### {name}:{line} exit {code}, no output shown\n  $ {text[:160]}\n  " + "\n  ".join(got[:6]))
            continue
        if not same(shown, got):
            bad += 1
            print(f"\n### {name}:{line} DIFFERS (exit {code})\n  $ {text[:170]}")
            for d in list(difflib.unified_diff([l.rstrip() for l in shown], got, "the guide", "now", lineterm="", n=0))[:int(os.environ.get("MAXD", "26"))]: print("  " + d[:230])
print(f"\n{ran} commands run; {bad} whose output differs from what the guide shows")
sys.exit(1 if bad else 0)
