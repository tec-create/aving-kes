/* AVING KES — Discovery Hub
 * Static, data-driven: everything renders from /data/stories.json.
 * Routes (hash): #/  #/edition/2026  #/awards  #/videos  #/all  #/article/12345
 * Article bodies load on demand from /data/body/<id>.json (fallback: lead + link to AVING USA).
 */
(() => {
  "use strict";

  const ORIGINAL = (id) =>
    `https://us.aving.net/news/articleView.html?idxno=${id}`;
  const ARTICLE = (id) => `#/article/${id}`;
  const SITE_TITLE = document.title;
  const YT_THUMB = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  const PAGE = 24;

  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const fmtDate = (d) => (d || "").slice(0, 10).replace(/-/g, ".");
  const view = $("#view");

  let DB = null;
  const syncHeroMotion = () => {
    const hero = $(".hero__masthead");
    if (hero)
      hero.style.animationPlayState =
        !document.hidden && hero.dataset.inView === "true"
          ? "running"
          : "paused";
  };
  const heroMotionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.dataset.inView = String(entry.isIntersecting);
    });
    syncHeroMotion();
  });
  document.addEventListener("visibilitychange", syncHeroMotion);

  let destroyHeroCells = () => {};
  function mountHeroCells(hero) {
    const canvas = hero.querySelector(".hero__cells");
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    const motion = matchMedia("(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)");
    let cells = [], width = 0, height = 0, step = 26;
    let frame = 0, visible = false, lastPaint = 0;
    const colors = [[41, 182, 232], [137, 105, 239], [255, 65, 105]];

    function paint(now) {
      ctx.clearRect(0, 0, width, height);
      let active = false;
      for (const cell of cells) {
        const life = Math.max(0, 1 - (now - cell.hit) / 1200);
        const glow = cell.energy * life * life;
        if (glow > 0.002) active = true;
        ctx.fillStyle = `rgba(${cell.color},${cell.base + glow * cell.shade})`;
        ctx.fillRect(cell.x, cell.y, step - 5, step - 5);
      }
      return active;
    }
    function tick(now) {
      frame = 0;
      if (!visible || document.hidden || !motion.matches) return;
      // A bounded 30fps trail; no animation loop remains once the cells settle.
      if (now - lastPaint < 32) {
        frame = requestAnimationFrame(tick);
        return;
      }
      lastPaint = now;
      if (paint(now)) frame = requestAnimationFrame(tick);
    }
    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      for (const cell of cells) cell.energy = 0;
      paint(performance.now());
    }
    function resize() {
      const rect = hero.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      step = width < 600 ? 24 : 28;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cells = [];
      for (let y = 0, row = 0; y < height; y += step, row++) {
        for (let x = 0, col = 0; x < width; x += step, col++) {
          const noise = ((col * 17 + row * 31 + col * row * 7) % 101) / 100;
          const band = (Math.sin(col * .17 + row * .32) + 1) / 2;
          const blend = Math.min(1.999, x / Math.max(width, 1) * 2);
          const index = Math.floor(blend), mix = blend - index;
          const color = colors[index].map((v, i) => Math.round(v + (colors[index + 1][i] - v) * mix)).join(",");
          // Keep the central reading area quieter than the outer cell field.
          const edge = Math.min(1, Math.abs(x / Math.max(width, 1) - .5) * 3);
          cells.push({ x, y, color, base: (.025 + noise * .04 + band * .055) * (.4 + edge * .6), shade: .22 + edge * .35, hit: -Infinity, energy: 0 });
        }
      }
      reset();
    }
    function move(event) {
      if (!motion.matches || !visible || document.hidden || event.pointerType === "touch") return;
      const rect = hero.getBoundingClientRect();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      const now = performance.now(), radius = step * 4;
      for (const cell of cells) {
        const distance = Math.hypot(cell.x + (step - 5) / 2 - x, cell.y + (step - 5) / 2 - y);
        if (distance >= radius) continue;
        const remaining = cell.energy * Math.max(0, 1 - (now - cell.hit) / 1200) ** 2;
        cell.energy = Math.max(remaining, (1 - distance / radius) ** 1.3);
        cell.hit = now;
      }
      if (!frame) frame = requestAnimationFrame(tick);
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) reset();
    });
    const sizing = new ResizeObserver(resize);
    observer.observe(hero);
    sizing.observe(hero);
    hero.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("visibilitychange", reset);
    motion.addEventListener("change", reset);
    resize();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      sizing.disconnect();
      hero.removeEventListener("pointermove", move);
      document.removeEventListener("visibilitychange", reset);
      motion.removeEventListener("change", reset);
    };
  }

  /* ---------- helpers ---------- */
  const storyLabels = (s) =>
    [
      s.tags.includes("awards")
        ? '<span class="story-label">Innovation Awards</span>'
        : "",
      s.tags.includes("interview")
        ? '<span class="story-label">Interview</span>'
        : "",
    ].join(" ");

  const kicker = (s) =>
    `<span class="chip chip--ed">KES ${s.y}</span>${s.sec ? `<span class="chip">· ${esc(s.sec)}</span>` : ""}`;
  const byline = (s) => `<p class="meta">${esc(s.by)} · ${fmtDate(s.d)}</p>`;
  const img = (s) => s.img || (s.yt ? YT_THUMB(s.yt) : "/assets/og.png");

  const card = (s, { lead = false, priority = false, labels = true } = {}) => `
    <a class="card" href="${ARTICLE(s.id)}">
      <div class="thumb">
        <img src="${esc(img(s))}" alt="" loading="${priority ? "eager" : "lazy"}" ${priority ? 'fetchpriority="high"' : ""} decoding="async">
      </div>
      <div class="card__copy">${labels ? `<div class="story-meta">${kicker(s)} ${storyLabels(s)}${s.yt ? '<span class="story-label">Video</span>' : ""}</div>` : ""}
      <h3>${esc(s.t)}</h3>
      ${lead && s.lead ? `<p class="lead">${esc(s.lead)}</p>` : ""}
      ${byline(s)}</div>
    </a>`;

  const row = (s) => `
    <a class="row card" href="${ARTICLE(s.id)}">
      <div class="thumb"><img src="${esc(img(s))}" alt="" loading="lazy" decoding="async"></div>
      <div>
        <div>${kicker(s)} ${storyLabels(s)}</div>
        <h3>${esc(s.t)}</h3>
        ${byline(s)}
      </div>
    </a>`;

  const setNav = (hash) => {
    document
      .querySelectorAll(".nav a")
      .forEach((a) =>
        a.classList.toggle("is-on", a.getAttribute("href") === hash),
      );
  };

  // Editorial browsing topics; the source section remains unchanged.
  const TOPICS = [
    { id: "ai", label: "AI & software", ids: [54790, 54794, 54808, 54820, 54822, 54747, 54748] },
    { id: "xr", label: "XR & display", ids: [54933, 54937, 54813, 54815, 54744, 54746, 54749] },
    { id: "robotics", label: "Robotics", ids: [54788, 54789, 54800, 54812, 54821, 54751] },
    { id: "health", label: "Health & living", ids: [54932, 54935, 54841, 54791, 54793, 54796, 54798, 54802, 54811, 54814, 54745, 54694] },
    { id: "components", label: "Components", ids: [54934, 54936, 54938, 54846, 54792, 54795, 54797, 54799, 54804, 54805, 54806, 54807, 54817, 54818, 54819, 54823, 54750, 54692] },
    { id: "show", label: "Show floor", ids: [54809, 54816] },
  ];

  // KES 2027 추진계획(안) — KEA 발표 자료 기준. 일정·전시장이 바뀌면 여기만 고치면 됩니다.
  const NEXT_SHOW = {
    year: 2027,
    status: "Planned",
    note: "Two venues, two roles: KES 2027 is planned across COEX and KINTEX, each with its own focus.",
    venues: [
      {
        id: "coex",
        venue: "COEX",
        city: "Seoul",
        dates: "Oct 12 – 15, 2027",
        days: "4 days",
        halls: "Hall B · Grand Ballroom · Lobby",
        theme: "Life Tech",
        focus: "AI home appliances, smart home, beauty and digital health",
        programs: "Media Day · Opening Keynote · CES Asia Unveiled Seoul",
      },
      {
        id: "kintex",
        venue: "KINTEX",
        city: "Goyang",
        dates: "Oct 20 – 22, 2027",
        days: "3 days",
        halls: "Hall 4 (to be confirmed)",
        theme: "Industry Tech",
        focus: "Advanced electronic components, materials, manufacturing AX and physical AI",
        programs: "KES Match · Biz Connect · K STAGE · K Connect AI",
      },
    ],
    scale: "250 exhibitors · 600 booths per venue",
  };

  const nextShow = () => `
          <section class="next-show" aria-labelledby="next-show-title">
            <div class="next-show__head">
              <h2 id="next-show-title"><span class="next-show__status">${NEXT_SHOW.status}</span> KES ${NEXT_SHOW.year}</h2>
              <p>${NEXT_SHOW.note}</p>
            </div>
            <div class="next-show__venues">
              ${NEXT_SHOW.venues
                .map(
                  (v) => `
              <article class="next-show__venue next-show__venue--${v.id}">
                <p class="next-show__theme">${esc(v.theme)}</p>
                <h3>${esc(v.venue)} <span>${esc(v.city)}</span></h3>
                <p class="next-show__dates">${esc(v.dates)} <span>· ${esc(v.days)}</span></p>
                <dl>
                  <div><dt>Halls</dt><dd>${esc(v.halls)}</dd></div>
                  <div><dt>Focus</dt><dd>${esc(v.focus)}</dd></div>
                  <div><dt>Programs</dt><dd>${esc(v.programs)}</dd></div>
                </dl>
              </article>`,
                )
                .join("")}
            </div>
            <p class="next-show__foot">${esc(NEXT_SHOW.scale)} · Dates and halls may change. Official details: <a href="https://www.kes.org/eng/" target="_blank" rel="noopener">kes.org ↗</a></p>
          </section>`;

  /* ---------- home ---------- */
  function renderHome() {
    view.onclick = null;
    const { items, meta } = DB;
    const latestEd = meta.editions[0];
    const vids = items.filter((s) => s.yt);
    const awards = items.filter((s) => s.tags.includes("awards"));
    // Keep the featured video outside the opening three stories.
    const featured =
      vids.find((s) => !items.slice(0, 3).includes(s)) || vids[0];

    view.innerHTML = `
      <section class="hero" aria-labelledby="archive-title">
        <canvas class="hero__cells" aria-hidden="true"></canvas>
        <div class="wrap hero__in">
          <h1 class="hero__masthead" id="archive-title"><span>KES</span> <span class="hero__year">${latestEd.y}</span></h1>
          <div class="hero__intro">
            <div>
              <h2 class="hero__name">Korea Electronics <span>Show.</span></h2>
              <p class="hero__place">COEX, Seoul · Korea</p>
            </div>
            <div class="hero__copy">
              <p class="hero__topics">AI, robotics, mobility and digital health.</p>
              <p class="hero__lede">The companies, products and people shaping technology come together at KES.</p>
              <p class="hero__archive">Explore the exhibition through AVING’s reporting.  Every KES story, on file.</p>
              <div class="btns">
                <a class="btn btn--primary" href="#/all">Explore the archive →</a>
                <a class="btn btn--outline" href="#/awards">Innovation Awards →</a>
              </div>
            </div>
          </div>
          <nav class="archive-index" aria-label="Explore the KES archive">
            <a class="archive-index__entry archive-index__entry--edition" href="#/edition/${latestEd.y}">
              <span class="archive-index__title">Inside KES ${latestEd.y}</span>
              <span class="archive-index__detail">Explore this edition <span aria-hidden="true">↗</span></span>
            </a>
            <a class="archive-index__entry" href="#/all">
              <span class="archive-index__title">Stories <span class="archive-index__count">${latestEd.n.toLocaleString("en-US")}</span></span>
              <span class="archive-index__detail">Read the coverage <span aria-hidden="true">↗</span></span>
            </a>
            <a class="archive-index__entry archive-index__entry--video" href="#/videos">
              <span class="archive-index__title">With video <span class="archive-index__count">${latestEd.v}</span></span>
              <span class="archive-index__detail">Explore video stories <span aria-hidden="true">↗</span></span>
            </a>
          </nav>
          ${nextShow()}
          <p class="archive-credit"><span>Reporting by <strong>AVING NEWS</strong></span><span>COEX, Seoul · Korea</span></p>
        </div>
      </section>

      <section class="sec sec--latest" aria-labelledby="latest-title"><div class="wrap">
        <div class="sec__head"><h2 id="latest-title">Latest stories</h2><a class="more" href="#/all">All stories →</a></div>
        ${
          items.length
            ? `<div class="section-grid">${items
                .slice(0, 3)
                .map((s) => card(s, { labels: false }))
                .join("")}</div>`
            : '<p class="empty">More stories will appear here as they are published.</p>'
        }
      </div></section>

      ${
        awards.length
          ? `
      <section class="sec sec--awards" aria-labelledby="awards-title"><div class="wrap awards-layout">
        <div class="awards-intro"><h2 id="awards-title">KES Innovation Awards</h2><p>${awards.length} stories on the products recognized by the KES Innovation Awards.</p><a class="btn btn--outline" href="#/awards">See all winners →</a></div>
        <div class="editorial-list awards-stories">${awards
          .slice(0, 3)
          .map((s) => card(s, { labels: false }))
          .join("")}</div>
      </div></section>`
          : ""
      }

      ${
        featured
          ? `
      <section class="sec"><div class="wrap">
        <div class="sec__head"><h2>From the show floor</h2><a class="more" href="#/videos">All videos →</a></div>
        <div class="feature">
          <div class="feature__media">
            <img src="${YT_THUMB(featured.yt)}" alt="" loading="lazy">
            <button data-yt="${featured.yt}" aria-label="Play video: ${esc(featured.t)}"><span><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l11 7-11 7z" fill="currentColor"/></svg></span></button>
          </div>
          <div>
            <p class="meta">Video · KES ${featured.y}</p>
            <h3>${esc(featured.t)}</h3>
            ${byline(featured)}
            <div class="btns">
              <a class="btn btn--ghost" href="${ARTICLE(featured.id)}">Read the story →</a>
              <a class="btn btn--outline" href="https://www.youtube.com/watch?v=${featured.yt}" target="_blank" rel="noopener">Watch on YouTube ↗</a>
            </div>
          </div>
        </div>
      </div></section>`
          : ""
      }

      <section class="sec sec--editions"><div class="wrap">
        <div class="sec__head"><h2>Explore the editions</h2></div>
        <div class="eds">${meta.editions
          .map(
            (e) => `
          <a class="ed" href="#/edition/${e.y}">
            <b>KES ${e.y}</b>
            <span>${e.n} stories${e.v ? ` · ${e.v} videos` : ""}</span>
            <em>Open edition →</em>
          </a>`,
          )
          .join("")}
        </div>
      </div></section>

      <section class="sec sec--more" aria-labelledby="more-title"><div class="wrap">
        <div class="sec__head"><div><h2 id="more-title">Explore KES by topic</h2><p>Find the companies, products and ideas that interest you.</p></div></div>
        <div class="topic-filters" role="group" aria-label="Filter stories by topic">
          <button class="topic-filter is-on" aria-pressed="true" aria-controls="topic-stories" data-topic="">All <span>${latestEd.n}</span></button>
          ${TOPICS.map(t => {
            const count = items.filter(s => s.y === latestEd.y && t.ids.includes(s.id)).length;
            return count ? `<button class="topic-filter" aria-pressed="false" aria-controls="topic-stories" data-topic="${t.id}">${esc(t.label)} <span>${count}</span></button>` : "";
          }).join("")}
        </div>
        <p class="topic-status" id="topic-status" role="status"></p>
        <div class="section-grid topic-stories" id="topic-stories"></div>
        <div class="topic-footer"><a class="btn btn--outline" id="topic-all" href="#/edition/${latestEd.y}"></a></div>
      </div></section>`;
    const drawTopic = (id = "") => {
      const topic = TOPICS.find(t => t.id === id);
      const stories = items.filter(s => s.y === latestEd.y && (!topic || topic.ids.includes(s.id)));
      $("#topic-stories").innerHTML = stories.slice(0, 6).map(s => card(s, { labels: false })).join("");
      $("#topic-status").textContent = `${topic ? topic.label : "All topics"} · Showing ${Math.min(6, stories.length)} of ${stories.length} stories`;
      $("#topic-all").textContent = `View all ${stories.length} ${topic ? topic.label + " stories" : "stories"} →`;
      $("#topic-all").href = `#/edition/${latestEd.y}${topic ? "/" + topic.id : ""}`;
    };
    view.onclick = (e) => {
      const button = e.target.closest(".topic-filter");
      if (!button) return;
      view.querySelectorAll(".topic-filter").forEach(b => {
        b.classList.toggle("is-on", b === button);
        b.setAttribute("aria-pressed", String(b === button));
      });
      drawTopic(button.dataset.topic);
    };
    drawTopic();
    heroMotionObserver.observe($(".hero__masthead"));
    destroyHeroCells = mountHeroCells($(".hero"));
  }

  /* ---------- list pages ---------- */
  function renderList({ title, desc, items, edition }) {
    const secs = [...new Set(items.map((s) => s.sec).filter(Boolean))];
    let sec = "",
      shown = PAGE;

    view.innerHTML = `
      <section class="page-head"><div class="wrap">
        <h1>${title}</h1>
        <p>${desc}</p>
      </div></section>
      <div class="wrap">
        ${
          edition !== undefined && DB.meta.editions.length > 1
            ? `<nav class="edition-nav" aria-label="KES editions by year">
          <a class="pill${edition === 0 ? " is-on" : ""}" href="#/all"${edition === 0 ? ' aria-current="page"' : ""}>All years · ${DB.items.length}</a>
          ${DB.meta.editions.map((e) => `<a class="pill${e.y === edition ? " is-on" : ""}" href="#/edition/${e.y}"${e.y === edition ? ' aria-current="page"' : ""}>KES ${e.y} · ${e.n}</a>`).join("")}
        </nav>`
            : ""
        }
        ${
          secs.length > 1
            ? `<div class="filters" role="toolbar" aria-label="Filter by section">
          <button class="pill is-on" aria-pressed="true" data-sec="">All · ${items.length}</button>
          ${secs.map((x) => `<button class="pill" aria-pressed="false" data-sec="${esc(x)}">${esc(x)} · ${items.filter((s) => s.sec === x).length}</button>`).join("")}
        </div>`
            : ""
        }
        <div class="list-wrap"><div class="editorial-list" id="list"></div><div class="loadmore" id="more"></div></div>
      </div>`;

    const draw = () => {
      const list = sec ? items.filter((s) => s.sec === sec) : items;
      $("#list").innerHTML = list.length
        ? list
            .slice(0, shown)
            .map((s) => card(s, { lead: true }))
            .join("")
        : '<p class="empty">No stories yet.</p>';
      $("#more").innerHTML =
        list.length > shown
          ? `<button class="btn btn--ghost">Load more (${list.length - shown})</button>`
          : "";
    };
    view.onclick = (e) => {
      const p = e.target.closest(".pill");
      if (p) {
        sec = p.dataset.sec;
        shown = PAGE;
        view.querySelectorAll(".pill").forEach((b) => {
          b.classList.toggle("is-on", b === p);
          b.setAttribute("aria-pressed", String(b === p));
        });
        draw();
      }
      if (e.target.closest("#more button")) {
        shown += PAGE;
        draw();
      }
    };
    draw();
  }

  /* ---------- article page ---------- */
  const bodyCache = new Map();
  const loadBody = (id) => {
    if (!bodyCache.has(id)) {
      bodyCache.set(
        id,
        fetch(`/data/body/${id}.json`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      );
    }
    return bodyCache.get(id);
  };

  const block = (b) => {
    switch (b.t) {
      case "p":
        return `<p>${esc(b.x)}</p>`;
      case "h":
        return `<h2>${esc(b.x)}</h2>`;
      case "img":
        return `<figure><img src="${esc(b.src)}" alt="" loading="lazy" decoding="async">${b.cap ? `<figcaption>${esc(b.cap)}</figcaption>` : ""}</figure>`;
      case "yt":
        return `<div class="art__yt"><iframe src="https://www.youtube-nocookie.com/embed/${esc(b.id)}?rel=0" title="YouTube video" loading="lazy" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
      case "ul":
        return `<ul>${b.li.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
      case "table":
        return `<div class="art__table"><table>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table></div>`;
      default:
        return "";
    }
  };

  async function renderArticle(id) {
    view.onclick = null;
    const s = DB.items.find((x) => x.id === id);
    if (!s) {
      view.innerHTML = `<section class="page-head"><div class="wrap"><h1>Story not found</h1><p><a class="more" href="#/all">Browse all KES stories →</a></p></div></section>`;
      return;
    }
    document.title = `${s.t} · AVING KES`;
    const related = DB.items
      .filter(
        (x) =>
          x.y === s.y &&
          x.id !== s.id &&
          (x.sec === s.sec || x.tags.some((t) => s.tags.includes(t))),
      )
      .slice(0, 4);

    view.innerHTML = `
      <article class="art">
        <header class="wrap art__head">
          <nav class="art__crumb" aria-label="Breadcrumb">
            <a href="#/edition/${s.y}">KES ${s.y}</a>${s.sec ? `<span>/</span><span>${esc(s.sec)}</span>` : ""}
            ${s.tags.includes("awards") ? '<span>/</span><a href="#/awards">Innovation Awards</a>' : ""}
          </nav>
          <h1>${esc(s.t)}</h1>
          <div class="art__meta">
            <span>${esc(s.by)} · ${esc((s.d || "").replace(/-/g, "."))}</span>
            ${storyLabels(s)}
            <a class="art__orig" href="${ORIGINAL(s.id)}" target="_blank" rel="noopener">Original on AVING USA ↗</a>
          </div>
        </header>
        <div class="wrap art__body" id="artBody">
          ${s.img ? `<figure><img src="${esc(s.img)}" alt=""></figure>` : ""}
          ${s.lead ? `<p>${esc(s.lead)}</p>` : ""}
          <p class="meta">Loading story…</p>
        </div>
      </article>
      ${
        related.length
          ? `
      <section class="sec"><div class="wrap">
        <div class="sec__head"><h2>More from KES ${s.y}</h2><a class="more" href="#/edition/${s.y}">All KES ${s.y} stories →</a></div>
        <div class="news-rows">${related.map(row).join("")}</div>
      </div></section>`
          : ""
      }`;

    const body = await loadBody(id);
    if (location.hash !== ARTICLE(id)) return; // user navigated away meanwhile
    const el = $("#artBody");
    const credit = `<p class="art__credit">This story was first published by <a href="${ORIGINAL(s.id)}" target="_blank" rel="noopener">AVING USA</a>. © AVING NEWS.</p>`;
    if (body?.body?.length) {
      // 본문에 사진이 없는 옛 기사는 대표 이미지를 맨 위에 보여 줌
      const lead = s.img && !body.body.some((b) => b.t === "img") ? `<figure><img src="${esc(s.img)}" alt=""></figure>` : "";
      el.innerHTML = lead + body.body.map(block).join("") + credit;
    } else {
      el.innerHTML = `${s.img ? `<figure><img src="${esc(s.img)}" alt=""></figure>` : ""}<p>${esc(s.lead)}</p>
        <p><a class="btn btn--primary" href="${ORIGINAL(s.id)}" target="_blank" rel="noopener">Read the full story on AVING USA ↗</a></p>`;
    }
  }

  /* ---------- router ---------- */
  function route() {
    if (!DB) return;
    destroyHeroCells();
    heroMotionObserver.disconnect();
    const h = location.hash || "#/";
    const [, a, b, topicId] = h.split("/");
    setNav(h);
    const { items, meta } = DB;

    view.onclick = null;
    closeSearch();
    closePlayer();
    if (a !== "article") document.title = SITE_TITLE;

    if (a === "article" && b) {
      renderArticle(+b);
    } else if (a === "edition" && b) {
      const y = +b;
      const e = meta.editions.find((x) => x.y === y);
      const topic = TOPICS.find(t => t.id === topicId);
      const editionItems = items.filter(s => s.y === y && (!topic || topic.ids.includes(s.id)));
      renderList({
        title: topic ? `${esc(topic.label)} · KES ${y}` : `KES ${y}`,
        desc: topic
          ? `${editionItems.length} stories from the Korea Electronics Show ${y}, selected by topic.`
          : e
            ? `${e.n} stories${e.v ? ` and ${e.v} videos` : ""} from the Korea Electronics Show ${y}.`
            : "No stories for this edition yet.",
        items: editionItems,
        edition: y,
      });
    } else if (a === "awards") {
      renderList({
        title: "KES Innovation Awards",
        desc: "Products and technologies recognized by the KES Innovation Awards, as covered by AVING.",
        items: items.filter((s) => s.tags.includes("awards")),
      });
    } else if (a === "videos") {
      renderList({
        title: "KES on video",
        desc: "On-site interviews and product walk-throughs from the KES show floor at COEX.",
        items: items.filter((s) => s.yt),
      });
    } else if (a === "all") {
      renderList({
        title: "All KES stories",
        desc: `${items.length} stories across ${meta.editions.length} editions, newest first.`,
        items,
        edition: 0,
      });
    } else {
      renderHome();
    }
    scrollTo({ top: 0, behavior: "instant" });
  }

  /* ---------- search ---------- */
  const norm = (s) => s.toLowerCase().normalize("NFKD");
  function search(q) {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    const list = $("#qList"),
      meta = $("#qMeta");
    if (!terms.length) {
      list.innerHTML = "";
      meta.textContent = `${DB.items.length} stories indexed`;
      return;
    }
    const hits = DB.items
      .map((s) => {
        const hay = norm(`${s.t} ${s.lead} ${s.sec} ${s.by}`);
        if (!terms.every((t) => hay.includes(t))) return null;
        const score = terms.reduce(
          (n, t) => n + (norm(s.t).includes(t) ? 2 : 1),
          0,
        );
        return { s, score };
      })
      .filter(Boolean)
      .sort((x, y) => y.score - x.score || (x.s.d < y.s.d ? 1 : -1))
      .slice(0, 40);
    const re = new RegExp(
      `(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
      "gi",
    );
    meta.textContent = `${hits.length}${hits.length === 40 ? "+" : ""} results`;
    list.innerHTML = hits
      .map(
        ({ s }) => `
      <li><a href="${ARTICLE(s.id)}">
        <img src="${esc(img(s))}" alt="" loading="lazy">
        <span><b>${esc(s.t).replace(re, "<mark>$1</mark>")}</b><span class="meta">KES ${s.y} · ${fmtDate(s.d)}</span></span>
      </a></li>`,
      )
      .join("");
  }
  const openSearch = () => {
    if (!DB) return;
    closePlayer();
    $("#search").hidden = false;
    $("#search").showModal();
    $("#q").focus();
    search($("#q").value);
  };
  const closeSearch = () => {
    $("#search").close();
    $("#search").hidden = true;
  };

  /* ---------- video player ---------- */
  const openPlayer = (id) => {
    $("#playerFrame").innerHTML =
      `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="YouTube video"></iframe>`;
    $("#player").hidden = false;
    $("#player").showModal();
  };
  const closePlayer = () => {
    $("#player").close();
    $("#playerFrame").innerHTML = "";
    $("#player").hidden = true;
  };

  /* ---------- wiring ---------- */
  $("#openSearch").addEventListener("click", openSearch);
  $("#closeSearch").addEventListener("click", closeSearch);
  $("#search").addEventListener("click", (e) => {
    if (e.target.id === "search") closeSearch();
  });
  $("#search").addEventListener("cancel", (e) => {
    e.preventDefault();
    closeSearch();
  });
  $("#q").addEventListener("input", (e) => search(e.target.value));
  $("#qList").addEventListener("click", (e) => {
    if (e.target.closest("a")) closeSearch();
  });
  $("#closePlayer").addEventListener("click", closePlayer);
  $("#player").addEventListener("click", (e) => {
    if (e.target.id === "player") closePlayer();
  });
  $("#player").addEventListener("cancel", (e) => {
    e.preventDefault();
    closePlayer();
  });
  $("#openMenu").addEventListener("click", (e) => {
    const d = $("#drawer");
    d.hidden = !d.hidden;
    e.currentTarget.setAttribute("aria-expanded", String(!d.hidden));
  });
  $("#drawer").addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      $("#drawer").hidden = true;
      $("#openMenu").setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-yt]");
    if (b) openPlayer(b.dataset.yt);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSearch();
      closePlayer();
    }
    if (
      (e.key === "/" || (e.key === "k" && (e.metaKey || e.ctrlKey))) &&
      !/INPUT|TEXTAREA/.test(document.activeElement.tagName)
    ) {
      e.preventDefault();
      openSearch();
    }
  });
  addEventListener("hashchange", route);

  /* ---------- boot ---------- */
  fetch("/data/stories.json", { cache: "no-cache" })
    .then((r) => {
      if (!r.ok) throw new Error(`stories.json ${r.status}`);
      return r.json();
    })
    .then((data) => {
      DB = data;
      // footer/drawer 요소가 디자인 변경으로 빠져도 사이트가 멈추지 않도록 존재할 때만 채움
      const upd = $("#updated");
      if (upd) upd.textContent = `Updated ${data.meta.updated}`;
      const eds = $("#drawerEditions");
      if (eds)
        eds.innerHTML = data.meta.editions
          .map((e) => `<a class="pill" href="#/edition/${e.y}">KES ${e.y}</a>`)
          .join("");
      route();
    })
    .catch((err) => {
      console.error("[AVING KES] boot failed:", err);
      view.innerHTML =
        '<p class="loading wrap">Could not load stories. Please refresh.</p>';
    });
})();
