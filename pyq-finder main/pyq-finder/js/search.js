/* search.js - deterministic, explainable ranking. Runs entirely offline in the browser: no network, no live AI model, no API calls.
   (AI-assisted parts: the topic/keyword tags and the synonym map in data/ were prepared with AI assistance; this file only applies them.)
   Pipeline: normalise -> detect hints (year/type/difficulty...) -> typo fix -> synonym expansion -> weighted scoring. */
(function (root) {
  const STOP = new Set("a an the of on in for to and or with from about me my i want need some any all questions question pyq pyqs previous year give show find get practice practise related regarding chapter topic cbse class board please can you is are what how reaction reactions law laws problem problems".split(" "));
  const W = { topic: 6, keyword: 4, chapter: 3, question: 1.2, solution: 0.4 };
  const SYN_FACTOR = 0.6;

  const norm = s => s.toLowerCase().replace(/[‑–−]/g, "-").replace(/[^a-z0-9+\-' ]/g, " ").replace(/\s+/g, " ").trim();
  const stem = w => w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        rowMin = Math.min(rowMin, cur[j]);
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  function buildIndex(questions, synonyms) {
    const vocab = new Set();
    const docs = questions.map(q => {
      const d = {
        q,
        topic: q.topics.map(norm), keyword: q.keywords.map(norm),
        chapter: norm(q.chapter), question: norm(q.question), solution: norm(q.solution),
      };
      [...d.topic, ...d.keyword, d.chapter, d.question].forEach(t => t.split(" ").forEach(w => w.length > 3 && vocab.add(stem(w))));
      return d;
    });
    Object.entries(synonyms).forEach(([k, v]) => [k, ...v].forEach(t => norm(t).split(" ").forEach(w => w.length > 3 && vocab.add(stem(w)))));
    return { docs, vocab: [...vocab], synonyms };
  }

  /* Pull filter hints out of free text, e.g. "hard numericals 2023 3 marks" */
  function parseHints(text) {
    let t = " " + norm(text) + " "; const h = {}; const used = [];
    const take = (re, fn, label) => { const m = t.match(re); if (m) { fn(m); used.push(label(m)); t = t.replace(re, " "); } };
    take(/\b(20(?:2[0-9]))\b/, m => (h.year = +m[1]), m => m[1]);
    take(/\b(\d)\s*(?:marks?|mark)\b/, m => (h.marks = +m[1]), m => m[1] + " marks");
    take(/\b(easy|simple)\b/, () => (h.difficulty = "Easy"), () => "Easy");
    take(/\b(medium|moderate)\b/, () => (h.difficulty = "Medium"), () => "Medium");
    take(/\b(hard|difficult|tough|challenging)\b/, () => (h.difficulty = "Hard"), () => "Hard");
    take(/\b(numericals?|numerical problems?|calculations?)\b/, () => (h.nature = "Numerical"), () => "Numerical");
    take(/\b(derivations?|derive|proofs?)\b/, () => (h.nature = "Derivation"), () => "Derivation");
    take(/\b(mcqs?|multiple choice)\b/, () => (h.type = "MCQ"), () => "MCQ");
    take(/\b(assertion[- ]reason|assertion)\b/, () => (h.type = "Assertion-Reason"), () => "Assertion-Reason");
    take(/\b(case[- ]?study|case[- ]based)\b/, () => (h.type = "Case Study"), () => "Case Study");
    take(/\b(long answer|5 marks?)\b/, () => (h.type = "Long Answer"), () => "Long Answer");
    take(/\b(short answer)\b/, () => (h.type = "Short Answer"), () => "Short Answer");
    take(/\b(physics)\b/, () => (h.subject = "Physics"), () => "Physics");
    take(/\b(chemistry|chem)\b/, () => (h.subject = "Chemistry"), () => "Chemistry");
    take(/\b(science)\b/, () => (h.subject = "Science"), () => "Science");
    take(/\b(maths?|mathematics)\b/, () => (h.subject = "Maths"), () => "Maths");
    return { hints: h, used, rest: t.trim() };
  }

  function fixTypos(tokens, vocab, fixes) {
    const set = new Set(vocab);
    return tokens.map(w => {
      const s = stem(w);
      if (w.length < 5 || set.has(s) || /\d/.test(w)) return w;
      let best = null, bd = 99; const max = w.length > 7 ? 2 : 1;
      for (const v of vocab) { const d = lev(s, v, max); if (d < bd) { bd = d; best = v; } }
      if (bd <= max && best !== s) { fixes.push({ from: w, to: best }); return best; }
      return bd <= max ? best : w;
    });
  }

  function expand(qstr, tokens, synonyms) {
    const padded = " " + qstr + " "; const out = new Map();
    const has = p => padded.includes(" " + p + " ") || (p.length > 3 && padded.includes(" " + p));
    for (const [key, rel] of Object.entries(synonyms)) {
      const group = [key, ...rel].map(norm);
      const hit = group.find(g => has(g));
      if (hit) group.forEach(g => { if (g !== hit && !has(g)) out.set(g, SYN_FACTOR); });
    }
    return out;
  }

  /* whole-word match (plural/-es tolerated), so "wave" no longer matches "wavelength" */
  function matchField(text, term) { return new RegExp("(^| )" + esc(term) + "(s|es)?( |$)").test(text); }

  function search(index, query) {
    const { hints, used, rest } = parseHints(query);
    let tokens = rest.split(" ").filter(w => w && !STOP.has(w));
    const corrections = [];
    tokens = fixTypos(tokens, index.vocab, corrections);
    const qstr = tokens.join(" ");
    const expanded = expand(qstr, tokens, index.synonyms);
    const terms = new Map();
    tokens.forEach(t => terms.set(stem(t), 1));
    expanded.forEach((f, t) => { if (!terms.has(t)) terms.set(t, f); });
    const info = { hints, used, corrected: qstr, corrections, expanded: [...expanded.keys()].slice(0, 6), concepts: [] };
    // Filter-only query ("2026", "numericals", "case study"): no topic words, so return everything and let the filters narrow it.
    if (!terms.size) {
      const all = Object.keys(hints).length ? index.docs.map(d => ({ q: d.q, score: 0, why: [] })) : [];
      return { ...info, results: all, filterOnly: true };
    }
    const results = [];
    const coreTerms = tokens.map(stem);
    for (const d of index.docs) {
      let score = 0; const why = new Set(); let exact = 0;
      for (const [term, factor] of terms) {
        const isPhrase = term.includes(" ");
        d.topic.forEach(t => { if (matchField(t, term) || (isPhrase && qstr.includes(t))) { score += W.topic * factor * (isPhrase ? 1.5 : 1); why.add("topic: " + t); } });
        d.keyword.forEach(k => { if (matchField(k, term)) { score += W.keyword * factor; why.add("keyword: " + k); } });
        if (matchField(d.chapter, term)) { score += W.chapter * factor; why.add("chapter: " + d.q.chapter); }
        if (matchField(d.question, term)) score += W.question * factor;
        else if (matchField(d.solution, term)) score += W.solution * factor;
      }
      // whole-topic-in-query bonus
      d.topic.forEach(t => { if (t.length > 4 && qstr.includes(t)) score += 4; });
      // exact chapter / topic phrase match outranks generic single-word matches
      if (qstr.length > 3 && (d.chapter === qstr || (qstr.includes(" ") && d.chapter.includes(qstr)))) { score += 12; exact = 1; info.concepts.indexOf(d.q.chapter) < 0 && info.concepts.push(d.q.chapter); }
      if (qstr.length > 3 && d.topic.some(t => t === qstr || t === qstr + " effect" || t.replace(/ effect$/, "") === qstr)) { score += 8; exact = 1; }
      // coverage: a multi-word query should match all its words; partial matches are demoted
      if (coreTerms.length > 1) {
        const cov = coreTerms.filter(t => [d.topic, d.keyword].some(a => a.some(x => matchField(x, t))) || matchField(d.chapter, t) || matchField(d.question, t)).length / coreTerms.length;
        score *= 0.35 + 0.65 * cov;
        if (cov === 1) score += 3;
      }
      if (score > 0) results.push({ q: d.q, score, exact, why: [...why].slice(0, 3) });
    }
    results.sort((a, b) => b.score - a.score || b.q.year - a.q.year);
    const top = results.length ? results[0].score : 0;
    return { ...info, results: results.filter(r => r.score >= top * (coreTerms.length > 1 ? 0.4 : 0.25)) };
  }

  /* Concept name shown in "Understanding your search": the most common matched topic that contains every query word, else the chapter. */
  function concept(res) {
    if (res.filterOnly || !res.results.length) return "";
    const core = res.corrected.split(" ").filter(Boolean).map(stem);
    const tally = (kind, need) => {
      const c = new Map();
      res.results.slice(0, 6).forEach(r => r.why.forEach(w => {
        if (!w.startsWith(kind + ": ")) return;
        const name = w.slice(kind.length + 2), n = norm(name);
        if (!need || core.every(t => matchField(n, t))) c.set(name, (c.get(name) || 0) + 1);
      }));
      return [...c.entries()].sort((x, y) => y[1] - x[1] || x[0].length - y[0].length)[0];
    };
    const best = tally("chapter", true) || tally("topic", true);
    const name = best ? best[0] : res.corrected;
    return name.replace(/\b[a-z]/g, m => m.toUpperCase());
  }

  const api = { buildIndex, search, parseHints, norm, concept };
  if (typeof module !== "undefined") module.exports = api; else root.PYQSearch = api;
})(typeof window !== "undefined" ? window : globalThis);
