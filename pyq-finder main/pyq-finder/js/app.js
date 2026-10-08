/* app.js - state + event wiring. Browse mode (no query) or search mode (query) + filters on top. */
(function () {
  const { $, fillSelect, renderFacets, renderResults, renderDetected, modal } = PYQUI;
  const D = window.PYQ_DATA, F = PYQFilters;
  const index = PYQSearch.buildIndex(D.questions, D.synonyms);
  const SUBJECTS = { "10": ["Science", "Maths"], "12": ["Physics", "Chemistry"] };
  const clsQ = () => D.questions.filter(q => String(q.class) === state.cls);
  const uniq = k => [...new Set(clsQ().map(q => q[k]))];
  const ORDER = { type: ["MCQ", "Assertion-Reason", "Very Short Answer", "Short Answer", "Case Study", "Long Answer"], difficulty: ["Easy", "Medium", "Hard"] };
  const facets = () => [
    { key: "year", label: "Year", values: uniq("year").sort() },
    { key: "type", label: "Type", values: ORDER.type.filter(t => uniq("type").includes(t)) },
    { key: "nature", label: "Nature", values: ["Numerical", "Derivation", "Theory", "Reasoning", "Conceptual", "Proof", "Application"].filter(t => uniq("nature").includes(t)) },
    { key: "difficulty", label: "Difficulty", values: ORDER.difficulty },
  ];
  const EXAMPLES = ["hard numericals on photoelectrc 2026", "photoelectric effect", "mirror formula problems", "derivation of dipole field", "transformer numerical", "aniline basicity", "first order rate constant", "electrolysis products", "kinetics case study", "transition elements reasons"];

  const state = { cls: localStorage.getItem("pyqClass") || "10", filters: F.empty(), query: "", dismissed: new Set(), list: [], pos: 0, searchInfo: null };

  // Detected hints (year, difficulty, ...) act as filters, but are relaxed automatically if they would leave 0 results.
  const DROP_ORDER = ["difficulty", "marks", "nature", "year", "type", "subject"];
  function activeHints() {
    const h = state.searchInfo ? state.searchInfo.hints : {};
    const label = { year: String(h.year), marks: h.marks + " marks", difficulty: h.difficulty, nature: h.nature, type: h.type, subject: h.subject };
    const out = {};
    DROP_ORDER.forEach(k => { if (h[k] !== undefined && state.filters[k] === "" && !state.dismissed.has(label[k])) out[k] = { v: h[k], label: label[k] }; });
    return out;
  }

  // What the query-understanding step recognised, in a form the UI can show.
  function understanding(s, relaxed) {
    const h = s.hints, kinds = { year: "year", marks: "marks", difficulty: "difficulty", nature: "question nature", type: "question type", subject: "subject" };
    const lab = { year: String(h.year), marks: h.marks + " marks", difficulty: h.difficulty, nature: h.nature, type: h.type, subject: h.subject };
    const filters = Object.keys(kinds).filter(k => h[k] !== undefined).map(k => ({ label: lab[k], kind: kinds[k] + (relaxed.includes(lab[k]) ? " · no match, relaxed" : "") }));
    return { corrections: s.corrections, concept: PYQSearch.concept(s), filters, expanded: s.expanded };
  }

  function refresh() {
    state.searchInfo = state.query.trim() ? PYQSearch.search(index, state.query) : null;
    const FACETS = facets();
    const base = (state.searchInfo ? state.searchInfo.results : D.questions.map(q => ({ q, why: [] }))).filter(r => String(r.q.class) === state.cls);
    const hints = activeHints(), relaxed = [];
    const build = () => { const f = { ...state.filters }; Object.entries(hints).forEach(([k, o]) => { f[k] = o.v; }); return f; };
    let f = build(), list = base.filter(r => F.matches(r.q, f));
    for (const k of DROP_ORDER) {
      if (list.length || !hints[k]) continue;
      relaxed.push(hints[k].label); delete hints[k]; f = build(); list = base.filter(r => F.matches(r.q, f));
    }
    if (!state.searchInfo) { // browse mode: chapter order, newest first
      const chs = D.chapters[state.cls];
      const ci = q => (chs[q.subject] || []).indexOf(q.chapter);
      list.sort((a, b) => a.q.subject.localeCompare(b.q.subject) || ci(a.q) - ci(b.q) || b.q.year - a.q.year || a.q.id.localeCompare(b.q.id));
    }
    state.list = list;

    const subj = f.subject || "";
    fillSelect($("f-subject"), SUBJECTS[state.cls], "All subjects", subj);
    $("subjects").innerHTML = SUBJECTS[state.cls].map(s => `<button type="button" data-s="${s}">${s}</button>`).join("");
    document.querySelectorAll("#classes button").forEach(b => b.classList.toggle("on", b.dataset.c === state.cls));
    const CH = D.chapters[state.cls];
    const chapters = subj ? (CH[subj] || []) : SUBJECTS[state.cls].flatMap(s => CH[s] || []);
    if (state.filters.chapter && !chapters.includes(state.filters.chapter)) state.filters.chapter = "";
    fillSelect($("f-chapter"), chapters, "All chapters", state.filters.chapter);
    const counts = {};
    FACETS.forEach(fc => (counts[fc.key] = F.counts(base.map(r => r.q), f, fc.key)));
    renderFacets($("facets"), FACETS, f, counts);
    renderDetected($("detected"), state.searchInfo ? understanding(state.searchInfo, relaxed) : null, state.dismissed);
    const s = state.searchInfo;
    $("status").textContent = (s ? `${list.length} result${list.length === 1 ? "" : "s"} for “${state.query.trim()}”, best match first` : `Browsing all ${list.length} questions`)
      + (relaxed.length ? ` · no exact match for ${relaxed.join(" + ")}, so that filter was relaxed` : "")
;
    renderResults($("results"), list);
    if (!list.length && !state.query.trim() && state.cls === "10" && subj === "Maths" && !clsQ().some(q => q.subject === "Maths")) $("results").innerHTML = `<div class="empty"><b>Maths questions are being added.</b><br>Check back soon.</div>`;
    document.querySelectorAll("#subjects button").forEach(b => b.classList.toggle("on", b.dataset.s === subj));
  }

  function setFilter(k, v) { state.filters[k] = state.filters[k] === v ? "" : v; refresh(); }
  function openAt(i) {
    state.pos = i; const r = state.list[i];
    modal.open(r, i, state.list.length, picked => modal.grade(r.q, picked));
  }
  const step = d => { const n = state.pos + d; if (n >= 0 && n < state.list.length) openAt(n); };
  const runSearch = () => {
    state.query = $("q").value; state.dismissed = new Set();
    const r = state.query.trim() ? PYQSearch.search(index, state.query) : null;
    const n = c => r.results.filter(x => String(x.q.class) === c).length;
    if (r && !n(state.cls) && n(state.cls === "10" ? "12" : "10")) { // e.g. a Physics query while Class 10 is selected
      state.cls = state.cls === "10" ? "12" : "10"; try { localStorage.setItem("pyqClass", state.cls); } catch (_) {} state.filters = F.empty(); setExamples();
    }
    refresh();
  };

  $("subjects").onclick = e => { const b = e.target.closest("button"); if (b) setFilter("subject", b.dataset.s), state.filters.chapter = ""; };
  $("classes").onclick = e => { const b = e.target.closest("button"); if (!b) return; state.cls = b.dataset.c; try { localStorage.setItem("pyqClass", state.cls); } catch (_) {} state.filters = F.empty(); state.query = ""; state.dismissed = new Set(); $("q").value = ""; setExamples(); refresh(); };
  $("go").onclick = runSearch;
  $("q").addEventListener("keydown", e => { if (e.key === "Enter") runSearch(); });
  $("q").addEventListener("input", () => { if (!$("q").value.trim()) runSearch(); });
  $("f-subject").onchange = e => { state.filters.subject = e.target.value; state.filters.chapter = ""; refresh(); };
  $("f-chapter").onchange = e => {
    state.filters.chapter = e.target.value;
    if (e.target.value && !state.filters.subject) { // infer subject
      state.filters.subject = SUBJECTS[state.cls].find(s => (D.chapters[state.cls][s] || []).includes(e.target.value)) || "";
    }
    refresh();
  };
  $("clear").onclick = () => { state.filters = F.empty(); state.query = ""; state.dismissed = new Set(); $("q").value = ""; refresh(); };
  $("facets").onclick = e => { const b = e.target.closest(".chip"); if (b) setFilter(b.dataset.k, b.dataset.k === "year" ? +b.dataset.v : b.dataset.v); };
  $("detected").onclick = e => { const c = e.target.closest(".uchip[data-u]"); if (c) { state.dismissed.add(c.dataset.u); refresh(); } };
  $("results").onclick = e => { const c = e.target.closest(".card"); if (c) openAt(+c.dataset.i); };
  const EX10 = ["quadratic equations word problems", "trigonometric identities", "Ohm's law numerical", "carbon compounds", "light refraction lens", "arithmetic progression sum", "acids bases and salts", "heredity"];
  const setExamples = () => { $("q").placeholder = state.cls === "10" ? 'Search e.g. "Ohm\'s law" or "quadratic equations"' : 'Search e.g. "Capacitance"'; $("examples").innerHTML = (state.cls === "10" ? EX10 : EXAMPLES).map(t => `<button type="button">${t}</button>`).join(""); };
  setExamples();
  $("examples").onclick = e => { if (e.target.tagName === "BUTTON") { $("q").value = e.target.textContent; runSearch(); window.scrollTo({ top: 0, behavior: "smooth" }); } };
  $("m-close").onclick = modal.close;
  $("modal").onclick = e => { if (e.target.id === "modal") modal.close(); };
  $("m-show").onclick = modal.toggleSolution;
  $("m-prev").onclick = () => step(-1); $("m-next").onclick = () => step(1);
  document.addEventListener("keydown", e => {
    if ($("modal").hidden) return;
    if (e.key === "Escape") modal.close(); else if (e.key === "ArrowLeft") step(-1); else if (e.key === "ArrowRight") step(1);
  });
  refresh();
})();
