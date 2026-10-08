/* ui.js - rendering only. No state lives here. */
(function (root) {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LET = "ABCD";
  const YEAR_NOTE = "2026 is inferred from the paper files' creation dates; the papers do not print a year.";
  const yr = y => y === 2026 ? `<span class="tagx" title="${esc(YEAR_NOTE)}">2026*</span>` : `<span class="tagx">${y}</span>`;

  function fillSelect(sel, items, placeholder, value) {
    sel.innerHTML = `<option value="">${esc(placeholder)}</option>` + items.map(i => `<option${i === value ? " selected" : ""}>${esc(i)}</option>`).join("");
  }

  function renderFacets(host, facets, filters, countsByFacet) {
    host.innerHTML = facets.map(({ key, label, values }) => {
      const c = countsByFacet[key] || {};
      const chips = values.map(v => {
        const n = c[v] || 0, on = String(filters[key]) === String(v);
        return `<button type="button" class="chip${on ? " on" : ""}${!n && !on ? " zero" : ""}" data-k="${key}" data-v="${esc(v)}"${v === 2026 ? ` title="${esc(YEAR_NOTE)}"` : ""}>${esc(v)}${v === 2026 ? "*" : ""}<small>${n}</small></button>`;
      }).join("");
      return `<div class="grp"><b>${esc(label)}</b>${chips}</div>`;
    }).join("");
  }

  function card(r, i) {
    const q = r.q;
    const snip = q.question.split("\n")[0];
    return `<button type="button" class="card" data-i="${i}">
      <div class="meta"><span class="tagx ${q.subject}">${q.subject}</span><span class="tagx">${esc(q.chapter)}</span>
        <span class="tagx">${q.type}</span><span class="tagx">${q.nature}</span><span class="tagx">${q.marks} mark${q.marks > 1 ? "s" : ""}</span>
        <span class="tagx ${q.difficulty}">${q.difficulty}</span>${yr(q.year)}</div>
      <div class="snip">${esc(snip)}</div>
      ${r.why && r.why.length ? `<div class="why">Matched → ${r.why.map(esc).join(" · ")}</div>` : ""}
    </button>`;
  }

  function renderResults(host, list) {
    host.innerHTML = list.length ? list.map(card).join("")
      : `<div class="empty"><b>No questions match.</b><br>Try a broader phrase (e.g. “kinetics”, “lens”, “amines”) or reset the filters.</div>`;
  }

  /* "Understanding your search" panel: shows what the offline query-understanding step recognised. */
  function renderDetected(host, u, dismissed) {
    if (!u) { host.hidden = true; host.innerHTML = ""; return; }
    const chip = (cls, main, sub, key) => `<span class="uchip ${cls}${key && dismissed.has(key) ? " off" : ""}"${key ? ` data-u="${esc(key)}" title="Click to ignore this filter"` : ""}>${esc(main)}<small>${esc(sub)}</small></span>`;
    const parts = [];
    u.corrections.forEach(c => parts.push(chip("fix", c.from + " → " + c.to, "spelling corrected")));
    if (u.concept) parts.push(chip("topic", u.concept, "topic / chapter"));
    u.filters.forEach(f => parts.push(chip("flt", f.label, f.kind, f.label)));
    const ex = u.expanded.filter(e => e !== (u.concept || "").toLowerCase() && !(u.corrections.some(c => c.to === e)));
    const syn = ex.length ? `<div class="usyn"><b>Synonym mapping:</b> also searching ${ex.slice(0, 4).map(esc).join(", ")}</div>` : "";
    if (!parts.length && !syn) { host.hidden = true; host.innerHTML = ""; return; }
    host.hidden = false;
    host.innerHTML = `<div class="uhead"><span class="spark">✦</span> Understanding your search <em>AI-assisted query understanding · runs offline</em></div><div class="uchips">${parts.join("")}</div>${syn}`;
  }

  const modal = {
    open(r, pos, total, onPick) {
      const q = r.q;
      $("m-meta").innerHTML = `<span class="tagx ${q.subject}">${q.subject}</span><span class="tagx">${esc(q.chapter)}</span><span class="tagx">${q.type}</span>
        <span class="tagx">${q.marks} mark${q.marks > 1 ? "s" : ""}</span><span class="tagx ${q.difficulty}">${q.difficulty}</span>${yr(q.year)}`;
      $("m-q").textContent = q.question;
      const opts = $("m-opts"); opts.innerHTML = ""; $("m-feedback").hidden = true;
      if (q.options) q.options.forEach((o, i) => {
        const b = document.createElement("button"); b.type = "button"; b.className = "opt";
        b.innerHTML = `<span class="l">${LET[i]}</span><span>${esc(o)}</span>`;
        b.onclick = () => onPick(i); opts.appendChild(b);
      });
      $("m-sol").hidden = true; $("m-sol").textContent = q.solution;
      $("m-show").textContent = "Show solution";
      $("m-src").textContent = "Source: " + q.source + (q.year === 2026 ? " · Year 2026 is inferred from the paper file dates (not printed on the paper)" : "") + " · Solution prepared by the project team, not the official CBSE marking scheme";
      $("m-pos").textContent = `${pos + 1} / ${total}`;
      $("m-prev").disabled = pos === 0; $("m-next").disabled = pos === total - 1;
      $("modal").hidden = false; document.body.style.overflow = "hidden";
      $("modal").querySelector(".sheet").scrollTop = 0; $("modal").scrollTop = 0;
    },
    grade(q, picked) {
      [...$("m-opts").children].forEach((b, i) => {
        b.disabled = true;
        if (i === q.answer) b.classList.add("ok"); else if (i === picked) b.classList.add("bad");
      });
      const f = $("m-feedback"), right = picked === q.answer;
      f.className = "feedback " + (right ? "ok" : "bad");
      f.textContent = right ? "✓ Correct!" : `✗ Not quite. The correct answer is ${LET[q.answer]}.`;
      f.hidden = false;
    },
    toggleSolution() {
      const s = $("m-sol"); s.hidden = !s.hidden;
      $("m-show").textContent = s.hidden ? "Show solution" : "Hide solution";
    },
    close() { $("modal").hidden = true; document.body.style.overflow = ""; },
  };

  root.PYQUI = { $, fillSelect, renderFacets, renderResults, renderDetected, modal };
})(window);
