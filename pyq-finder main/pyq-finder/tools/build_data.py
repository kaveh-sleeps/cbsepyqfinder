"""Run after editing data/*.json:  python tools/build_data.py
Validates questions and regenerates data/data.js (so the site works offline by double-clicking index.html)."""
import json,os
d=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","data")
L=lambda f:json.load(open(os.path.join(d,f),encoding="utf-8"))
Q,C,S=L("questions.json"),L("chapters.json"),L("synonyms.json")
ids=set()
for q in Q:
    for k in("id","class","subject","chapter","topics","keywords","type","nature","marks","year","difficulty","question","solution","source"):
        assert k in q,f"{q.get('id')} missing {k}"
    assert q["id"] not in ids,"duplicate id "+q["id"]; ids.add(q["id"])
    assert q["chapter"] in C[str(q["class"])][q["subject"]],f"{q['id']}: unknown chapter"
    if "options" in q: assert 0<=q["answer"]<len(q["options"]),f"{q['id']}: bad answer index"
open(os.path.join(d,"data.js"),"w",encoding="utf-8").write("window.PYQ_DATA="+json.dumps({"questions":Q,"chapters":C,"synonyms":S},ensure_ascii=False)+";\n")
print("OK:",len(Q),"questions")
