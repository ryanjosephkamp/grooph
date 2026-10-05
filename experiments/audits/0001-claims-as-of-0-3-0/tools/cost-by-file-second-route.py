# Audit 0001, round two, S7: the cost page's Table 10 by a second route than its own script.
#   cd <repository root> && python3 <this file>      (only on the Mac that holds study two's transcripts)
# Reads the six package-arm lead transcripts of study two on this Mac. Counts only; prints no transcript text.
import json, glob, os, sys
ROOT = os.getcwd(); HOME = os.path.expanduser("~")
W1H, READ = 8e-6, 0.2e-6
def session(run):
    r = json.load(open(f"{ROOT}/experiments/comparisons/{run}/result.json"))
    ids = [i.get("session_id") for i in r.get("invocations", []) if i.get("session_id")] or [r.get("session_id")]
    return ids[0]
def kind(path):
    p = path or ""
    if p.endswith("graph.grooph.json"): return "graph"
    if "/.claude/agents/" in p: return "agents"
    if p.endswith("LEAD.md"): return "brief"
    return None
tot = {"graph": [], "agents": [], "brief": []}
for proj in ["review-gate-2", "heterogeneous-critic", "taste-polish"]:
    for n in (1, 2):
        run = f"{proj}/A-{n}"; sid = session(run)
        hits = glob.glob(f"{HOME}/.claude/projects/*/{sid}.jsonl")
        if not hits: print(run, "transcript not found"); continue
        calls = {}; order = []; results = {}
        for line in open(hits[0], errors="replace"):
            try: e = json.loads(line)
            except Exception: continue
            m = e.get("message") or {}
            if e.get("type") == "assistant" and m.get("id") and m.get("usage"):
                c = calls.setdefault(m["id"], {"uses": [], "write": 0})
                if m["id"] not in order: order.append(m["id"])
                u = m["usage"]; cc = u.get("cache_creation") or {}
                c["write"] = max(c["write"], (cc.get("ephemeral_1h_input_tokens") or 0) + (cc.get("ephemeral_5m_input_tokens") or 0) or (u.get("cache_creation_input_tokens") or 0))
                for part in m.get("content") or []:
                    if isinstance(part, dict) and part.get("type") == "tool_use":
                        c["uses"].append((part.get("id"), part.get("name"), (part.get("input") or {}).get("file_path")))
            elif e.get("type") == "user" and isinstance(m.get("content"), list):
                for part in m["content"]:
                    if isinstance(part, dict) and part.get("type") == "tool_result":
                        body = part.get("content")
                        text = body if isinstance(body, str) else "".join(x.get("text", "") for x in body or [] if isinstance(x, dict))
                        results[part.get("tool_use_id")] = len(text)
        per = {"graph": [0, 0.0], "agents": [0, 0.0], "brief": [0, 0.0]}
        for k, mid in enumerate(order[:-1]):
            c = calls[mid]; nxt = calls[order[k + 1]]
            chars = [(kind(fp) if name == "Read" else None, results.get(uid, 0)) for uid, name, fp in c["uses"]]
            total = sum(n_ for _, n_ in chars)
            if total == 0: continue
            later = len(order) - (k + 2)   # the calls after the one that wrote it to the cache
            for kd, n_ in chars:
                if kd:
                    t = nxt["write"] * n_ / total
                    per[kd][0] += t; per[kd][1] += t * W1H + t * later * READ
        print(f"{run:26} lead calls {len(order):2} | graph {per['graph'][0]:6.0f} tok ${per['graph'][1]:.3f} | agents {per['agents'][0]:6.0f} tok ${per['agents'][1]:.3f} | brief {per['brief'][0]:6.0f} tok ${per['brief'][1]:.3f}")
        for kd in tot: tot[kd].append(per[kd])
for kd in tot:
    t = sum(x[0] for x in tot[kd]) / 6; d = sum(x[1] for x in tot[kd]) / 6
    print(f"mean of six, {kd:6}: {t:6.0f} tokens, ${d:.3f} written once and read back")
g = sum(x[1] for x in tot["graph"]) / 6 + sum(x[1] for x in tot["agents"]) / 6
print(f"the graph document and the agent files together: ${g:.3f} a run (the page: $0.043 + $0.041 = $0.084, and $0.088 with the calls that read nothing else)")
