"use strict";

const TIERS = ["goat", "rewatch", "once", "regret"];
const TIER_LABEL = { goat: "goat", rewatch: "rewatch", once: "1&done", regret: "regret" };
const MOODS = {
  mass: ["Action"],
  thriller: ["Thriller", "Crime", "Mystery"],
  "feel-good": ["Comedy", "Romance", "Family"],
  "mind-bender": ["Science Fiction", "Sci-Fi", "Mystery"],
};
const LANGUAGE_ORDER = ["Telugu", "Tamil", "English"];

/* ---- Pure functions: no DOM, no globals. ---- */

// All filters are optional; "all" (or null) means no restriction.
function filterFilms(films, { language = "all", tier = "all", mood = "all" } = {}) {
  const genres = mood === "all" ? null : MOODS[mood] || [];
  return films.filter((f) =>
    (language === "all" || f.language === language) &&
    (tier === "all" || f.tier === tier) &&
    (!genres || (f.genres || []).some((g) => genres.includes(g))));
}

// Newest year first; same year: goat, rewatch, 1&done, regret, then title. Films without a year go last.
function sortFilms(films) {
  return [...films].sort((a, b) =>
    (b.year || 0) - (a.year || 0) ||
    TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || a.title.localeCompare(b.title));
}

// n random goat films; fewer if there are fewer. `rng` is injectable for checks.
function pickHero(films, n = 6, rng = Math.random) {
  const pool = films.filter((f) => f.tier === "goat");
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

function languagesIn(films) {
  const present = [...new Set(films.map((f) => f.language).filter(Boolean))];
  const rank = (l) => (LANGUAGE_ORDER.includes(l) ? LANGUAGE_ORDER.indexOf(l) : LANGUAGE_ORDER.length);
  return present.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

if (typeof module !== "undefined") module.exports = { filterFilms, sortFilms, pickHero, languagesIn, MOODS };

/* ---- DOM ---- */
if (typeof document !== "undefined") {
  const state = { language: "all", tier: "goat", mood: "all" };
  let films = [];
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const TIER_TAG = { goat: "fill", rewatch: "accent", once: "", regret: "fail" };

  function filmCard(f) {
    const card = el("article", "film");
    if (f.poster) {
      const img = el("img", "poster");
      img.src = f.poster;
      img.alt = `${f.title} poster`;
      img.loading = "lazy";
      img.onerror = () => img.replaceWith(el("div", "poster ph", f.title));
      card.append(img);
    } else {
      card.append(el("div", "poster ph", f.title));
    }
    card.append(el("div", "t", f.title));
    card.append(el("div", "m", [f.year, f.language].filter(Boolean).join(" · ")));
    card.append(el("span", `tag ${TIER_TAG[f.tier] || ""}`, TIER_LABEL[f.tier] || f.tier));
    return card;
  }

  function toggle(label, key, options) {
    const group = el("div", "group");
    group.append(el("span", "label", label));
    const row = el("div", "toggle");
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", label);
    for (const [value, text] of options) {
      const b = el("button", null, text);
      b.type = "button";
      b.setAttribute("aria-pressed", String(state[key] === value));
      b.onclick = () => { state[key] = value; renderFilters(); renderGrid(); };
      row.append(b);
    }
    group.append(row);
    return group;
  }

  function renderFilters() {
    const box = $("filters");
    box.replaceChildren(
      toggle("Language", "language", [["all", "All"], ...languagesIn(films).map((l) => [l, l])]),
      toggle("Tier", "tier", [["all", "All"], ...TIERS.map((t) => [t, TIER_LABEL[t]])]),
      toggle("Mood", "mood", [["all", "Any"], ...Object.keys(MOODS).map((m) => [m, m])]));
  }

  function renderGrid() {
    const shown = sortFilms(filterFilms(films, state));
    $("grid").replaceChildren(...shown.map(filmCard));
    $("count").textContent = String(shown.length).padStart(2, "0");
    $("empty").hidden = shown.length > 0;
  }

  function renderHero() {
    const box = $("hero");
    box.replaceChildren(...pickHero(films).map(filmCard));
    box.closest(".hero").querySelector(".hero-label").hidden = box.children.length === 0;
  }

  fetch("data/movies.json")
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => {
      films = data.films || [];
      $("generated").textContent = `UPDATED ${data.generated || ""}`;
      renderHero();
      renderFilters();
      renderGrid();
    })
    .catch(() => {
      $("empty").hidden = false;
      $("empty").textContent = "COULD NOT LOAD FILMS — if you opened this as a file, serve it with python -m http.server";
    });
}
