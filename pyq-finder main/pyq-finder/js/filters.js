/* filters.js - structured filtering applied on top of browse mode or search results. */
(function (root) {
  const FACETS = ["year", "type", "nature", "difficulty"];
  const empty = () => ({ subject: "", chapter: "", year: "", type: "", nature: "", difficulty: "", marks: "" });
  function matches(q, f, skip) {
    if (f.subject && q.subject !== f.subject) return false;
    if (f.chapter && q.chapter !== f.chapter) return false;
    for (const k of FACETS) if (k !== skip && f[k] !== "" && String(q[k]) !== String(f[k])) return false;
    if (skip !== "marks" && f.marks !== "" && q.marks !== +f.marks) return false;
    return true;
  }
  const apply = (list, f) => list.filter(q => matches(q, f));
  function counts(list, f, facet) {
    const c = {};
    list.filter(q => matches(q, f, facet)).forEach(q => (c[q[facet]] = (c[q[facet]] || 0) + 1));
    return c;
  }
  const api = { FACETS, empty, apply, counts, matches };
  if (typeof module !== "undefined") module.exports = api; else root.PYQFilters = api;
})(typeof window !== "undefined" ? window : globalThis);
