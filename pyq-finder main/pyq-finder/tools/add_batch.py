"""Append a batch of questions to data/questions.json, then rebuild data.js.
Usage:  python tools/add_batch.py data/batches/<file>.json
Rejects duplicate ids; build_data.py validates chapters/fields/answer indexes."""
import json, os, subprocess, sys
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
qp = os.path.join(root, "data", "questions.json")
Q = json.load(open(qp, encoding="utf-8"))
new = json.load(open(sys.argv[1], encoding="utf-8"))
ids = {q["id"] for q in Q}
added = [q for q in new if q["id"] not in ids]
print(f"adding {len(added)} (skipped {len(new)-len(added)} duplicates)")
json.dump(Q + added, open(qp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
subprocess.check_call([sys.executable, os.path.join(root, "tools", "build_data.py")])
