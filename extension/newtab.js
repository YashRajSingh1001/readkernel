// ReadKernel new tab: shows today's brief from https://readkernel.in/api/v1/today.
//
// The last brief is kept in chrome.storage, so a new tab draws instantly (and
// works offline); a fresh copy is fetched when the saved one is over 30 minutes old.
// All text is inserted as text, never as HTML.

const API = new URLSearchParams(location.search).get("api") || "https://readkernel.in"; // ?api= only for local testing
const MAX_AGE_MS = 30 * 60 * 1000;
const hasChrome = typeof chrome !== "undefined" && chrome.storage;

const store = {
  async get(key) {
    if (hasChrome) return (await chrome.storage.local.get(key))[key];
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  },
  async set(key, value) {
    if (hasChrome) return chrome.storage.local.set({ [key]: value });
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // private window: just don't cache
    }
  },
};

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "href") node.href = safeUrl(v);
    else if (k === "src") node.src = safeUrl(v);
    else node.setAttribute(k, v);
  }
  for (const child of children) if (child != null && child !== "") node.append(child);
  return node;
}

// Only ever link to web pages.
function safeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "#";
  } catch {
    return "#";
  }
}

function longDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function meta(story) {
  return el(
    "div",
    { class: "meta" },
    el("span", { class: "tag" }, story.model_release ? "Model release" : story.topic),
    story.source_count > 1 ? el("span", {}, `${story.source_count} sources`) : el("span", {}, story.sources[0]?.name ?? ""),
  );
}

function render(data, note) {
  $("brief-label").textContent = "Today's brief";
  $("brief-title").textContent = longDate(data.date);
  $("status").textContent = note || `${data.stories.length} stories worth your time`;
  $("more").href = safeUrl(data.url);

  const [first, ...rest] = data.stories;
  const lead = $("lead");
  lead.replaceChildren();
  if (first) {
    lead.append(
      el(
        "article",
        { class: "lead" },
        el(
          "div",
          {},
          el("p", { class: "label" }, "Story of the day"),
          meta(first),
          el("h2", {}, el("a", { href: first.url }, first.headline)),
          el("p", { class: "summary" }, first.summary),
          first.why_it_matters ? el("p", { class: "why" }, `Why it matters: ${first.why_it_matters}`) : null,
        ),
        first.image_url ? el("img", { src: first.image_url, alt: "", referrerpolicy: "no-referrer", loading: "lazy" }) : null,
      ),
    );
  }

  $("stories").replaceChildren(
    ...rest.map((s) =>
      el(
        "li",
        {},
        el("span", { class: "rank" }, `${s.rank}`),
        el(
          "div",
          {},
          meta(s),
          el("h3", {}, el("a", { href: s.url }, s.headline)),
          el("p", { class: "summary" }, s.summary),
        ),
      ),
    ),
  );

  $("top").replaceChildren(
    ...data.top_articles.slice(0, 6).map((a) =>
      el(
        "li",
        {},
        el("a", { class: "title", href: a.url }, a.title),
        el(
          "p",
          {},
          a.points != null ? `▲ ${a.points} · ` : "",
          a.discussion ? el("a", { href: a.discussion }, "discussion") : "",
        ),
      ),
    ),
  );

  $("companies").replaceChildren(
    ...data.company_reads.map((p) =>
      el("li", {}, el("p", {}, `${p.company} · ${p.subject}`), el("a", { class: "title", href: p.url }, p.title)),
    ),
  );
}

async function load() {
  const saved = await store.get("brief");
  if (saved?.data) render(saved.data);
  if (saved && Date.now() - saved.fetchedAt < MAX_AGE_MS) return;

  try {
    const response = await fetch(`${API}/api/v1/today`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    await store.set("brief", { data, fetchedAt: Date.now() });
    render(data);
  } catch {
    if (saved?.data) {
      $("status").textContent = "Offline: showing the last brief we saved.";
    } else {
      $("brief-title").textContent = "Couldn't load today's news";
      $("status").textContent = "Check your connection, or open readkernel.in.";
    }
  }
}

// Search: the web with the user's own search engine, or ReadKernel's archive.
$("search").addEventListener("submit", (event) => {
  event.preventDefault();
  const text = $("q").value.trim();
  if (!text) return;
  if (hasChrome && chrome.search) chrome.search.query({ text, disposition: "CURRENT_TAB" });
  else location.href = `https://www.google.com/search?q=${encodeURIComponent(text)}`;
});
$("search-news").addEventListener("click", () => {
  const text = $("q").value.trim();
  location.href = `https://readkernel.in/search${text ? `?q=${encodeURIComponent(text)}` : ""}`;
});

// Summaries on/off, remembered.
const toggle = $("show-summaries");
store.get("showSummaries").then((value) => {
  toggle.checked = value !== false;
  document.body.classList.toggle("headlines-only", !toggle.checked);
});
toggle.addEventListener("change", () => {
  document.body.classList.toggle("headlines-only", !toggle.checked);
  store.set("showSummaries", toggle.checked);
});

load();
