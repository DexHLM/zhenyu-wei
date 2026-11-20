const root = document.documentElement;
const themeToggle = document.querySelector("#theme-toggle");
const themeColor = document.querySelector('meta[name="theme-color"]');
const themeKey = "zhenyu-wei-theme";

function applyTheme(theme) {
  const isDark = theme === "dark";
  root.dataset.theme = theme;
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeColor.content = isDark ? "#0b0e14" : "#fafafa";
}

function syncTheme() {
  try {
    const saved = localStorage.getItem(themeKey);
    applyTheme(saved === "light" || saved === "dark" ? saved : "light");
  } catch {
    applyTheme(root.dataset.theme);
  }
}

applyTheme(root.dataset.theme);
themeToggle.addEventListener("click", () => {
  const theme = root.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(theme);
  try {
    localStorage.setItem(themeKey, theme);
  } catch {
    // Keep the current page interactive when storage is disabled.
  }
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) syncTheme();
});
window.addEventListener("storage", (event) => {
  if (event.key === themeKey || event.key === null) syncTheme();
});

const reveals = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.08, rootMargin: "0px 0px -5% 0px" });
  reveals.forEach((item) => observer.observe(item));
} else {
  reveals.forEach((item) => item.classList.add("visible"));
}

// Fetch a later cover only when it is requested; keep the first frame usable without JS.
const coverScenes = [
  { image: 3, alt: "DexHLM human demonstrations of sweeping, cooking, and carrying a basket" },
  { image: 2, alt: "DexHLM human demonstrations of cleaning and preparing drinks in a kitchen" },
  { image: 1, alt: "DexHLM human demonstrations of reading, handling objects, and drinking in a study" },
];
const coverMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

for (const carousel of document.querySelectorAll(".cover-carousel")) {
  const link = carousel.querySelector(".cover-link");
  const first = link.querySelector("img");
  const dots = [...carousel.querySelectorAll("button[data-slide]")];
  const toggle = carousel.querySelector(".cover-toggle");
  const controls = carousel.querySelector(".cover-controls");
  const square = carousel.classList.contains("grid-video");
  const frames = [first];
  const pending = new Map();
  let active = 0;
  let requested = 0;
  let revision = 0;
  let visible = false;
  let paused = coverMotion.matches;
  let hovered = false;
  let focused = false;
  let timer;

  function schedule() {
    window.clearTimeout(timer);
    if (visible && !document.hidden && !paused && !hovered && !focused) {
      timer = window.setTimeout(() => select((requested + 1) % coverScenes.length), 4000);
    }
  }

  function setPaused(value) {
    paused = value;
    toggle.dataset.paused = String(paused);
    toggle.setAttribute("aria-label", paused ? "Play cover slideshow" : "Pause cover slideshow");
    schedule();
  }

  function loadFrame(index) {
    if (pending.has(index)) return pending.get(index);
    if (frames[index]) return Promise.resolve(frames[index]);
    const frame = new Image(Number(first.getAttribute("width")), Number(first.getAttribute("height")));
    frame.className = "cover-frame";
    frame.alt = coverScenes[index].alt;
    frame.decoding = "async";
    frame.setAttribute("aria-hidden", "true");
    const ready = new Promise((resolve, reject) => {
      frame.onload = resolve;
      frame.onerror = () => reject(new Error("Cover image unavailable"));
    });
    const stem = `assets/media/dexhlm-${coverScenes[index].image}`;
    if (!square) {
      frame.sizes = first.sizes;
      frame.srcset = `${stem}-480.webp 480w, ${stem}-960.webp 960w`;
    }
    frame.src = square ? `${stem}-square.webp` : `${stem}-480.webp`;
    frames[index] = frame;
    link.append(frame);
    const loaded = ready.then(async () => {
      if (frame.decode) await frame.decode();
      return frame;
    }).catch((error) => {
      frame.remove();
      frames[index] = undefined;
      throw error;
    }).finally(() => pending.delete(index));
    pending.set(index, loaded);
    return loaded;
  }

  async function select(index, manual = false) {
    const currentRevision = ++revision;
    requested = index;
    window.clearTimeout(timer);
    if (manual) setPaused(true);
    try {
      await loadFrame(index);
      // A slow download must never override a more recent selection.
      if (currentRevision !== revision) return;
      if (index !== active) {
        frames.forEach((frame, i) => {
          if (!frame) return;
          frame.classList.toggle("is-previous", i === active);
          frame.classList.toggle("is-active", i === index);
          frame.setAttribute("aria-hidden", String(i !== index));
        });
        active = index;
        controls.style.setProperty("--active-slide", String(active));
        dots.forEach((dot, i) => dot.setAttribute("aria-pressed", String(i === active)));
      }
    } catch {
      // Retain the current picture; the next automatic turn tries the next scene.
    } finally {
      if (currentRevision === revision) schedule();
    }
  }

  dots.forEach((dot, index) => dot.addEventListener("click", () => select(index, true)));
  let glassFrame;
  controls.addEventListener("pointermove", (event) => {
    if (coverMotion.matches || event.pointerType !== "mouse") return;
    window.cancelAnimationFrame(glassFrame);
    glassFrame = window.requestAnimationFrame(() => {
      const bounds = controls.getBoundingClientRect();
      controls.style.setProperty("--glass-x", `${100 * (event.clientX - bounds.left) / bounds.width}%`);
    });
  });
  controls.addEventListener("pointerleave", () => {
    window.cancelAnimationFrame(glassFrame);
    controls.style.removeProperty("--glass-x");
  });
  toggle.addEventListener("click", () => {
    if (paused) {
      // An explicit Play action also resumes after keyboard or pointer interaction.
      focused = false;
      hovered = false;
    }
    setPaused(!paused);
  });
  carousel.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "mouse") return;
    hovered = true;
    schedule();
  });
  carousel.addEventListener("pointerleave", () => { hovered = false; schedule(); });
  carousel.addEventListener("focusin", () => { focused = true; schedule(); });
  carousel.addEventListener("focusout", (event) => {
    if (!carousel.contains(event.relatedTarget)) { focused = false; schedule(); }
  });
  document.addEventListener("visibilitychange", schedule);
  coverMotion.addEventListener("change", () => {
    if (coverMotion.matches) setPaused(true);
  });
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    }, { threshold: 0.1 });
    observer.observe(carousel);
  } else {
    visible = true;
  }
  setPaused(paused);
}

const newsToggle = document.querySelector("#news-more");
if (newsToggle) {
  const extraNews = document.querySelectorAll(".news-extra");
  const label = newsToggle.querySelector(".news-more-label");
  newsToggle.hidden = !extraNews.length;
  label.textContent = extraNews.length + " more";
  newsToggle.addEventListener("click", () => {
    const open = newsToggle.getAttribute("aria-expanded") === "true";
    newsToggle.setAttribute("aria-expanded", String(!open));
    extraNews.forEach((item) => { item.hidden = open; });
    label.textContent = open ? extraNews.length + " more" : "Show less";
  });
}

const researchToggle = document.querySelector("#research-expand-toggle");
if (researchToggle) {
  const grid = document.querySelector("#research-grid-view");
  const list = document.querySelector("#research-list-view");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let previousY = window.scrollY;

  // Fade the grid, then replace it in one update so both views never take up space together.
  function expand() {
    if (researchToggle.getAttribute("aria-expanded") === "true") return;
    researchToggle.setAttribute("aria-expanded", "true");
    window.removeEventListener("scroll", expandOnScroll);

    function showList() {
      const moveFocus = grid.contains(document.activeElement);
      grid.hidden = true;
      list.removeAttribute("data-collapsed");
      if (moveFocus) list.focus({ preventScroll: true });
    }

    if (reducedMotion.matches) {
      showList();
    } else {
      grid.classList.add("collapsed-hidden");
      window.setTimeout(showList, 240);
    }
  }

  function expandOnScroll() {
    const currentY = window.scrollY;
    const movingDown = currentY > previousY;
    previousY = currentY;
    if (!movingDown) return;
    const { top, bottom } = researchToggle.getBoundingClientRect();
    if (bottom > 0 && top < innerHeight * 0.8) expand();
  }

  researchToggle.addEventListener("click", expand);
  window.addEventListener("scroll", expandOnScroll, { passive: true });
}

for (const button of document.querySelectorAll(".pub-tag-tldr[aria-controls]")) {
  const summary = document.getElementById(button.getAttribute("aria-controls"));

  function showSummary(open) {
    summary.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  }

  button.addEventListener("click", () => showSummary(summary.hidden));
  document.addEventListener("click", (event) => {
    if (!summary.hidden && !summary.contains(event.target) && !button.contains(event.target)) {
      showSummary(false);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !summary.hidden) {
      showSummary(false);
      button.focus();
    }
  });
}

const filters = [...document.querySelectorAll(".pub-filter")];
if (filters.length) {
  const papers = [...document.querySelectorAll(".pub[data-topics]")];
  const groups = new Set(papers.map((paper) => paper.closest("section")));

  for (const filter of filters) {
    filter.addEventListener("click", () => {
      const topic = filter.dataset.topic;

      for (const option of filters) {
        const active = option === filter;
        option.classList.toggle("active", active);
        option.setAttribute("aria-pressed", String(active));
      }

      for (const paper of papers) {
        const matches = topic === "all" || (paper.dataset.topics || "").split(/\s+/).includes(topic);
        paper.classList.toggle("hidden", !matches);
      }

      for (const group of groups) {
        group.hidden = !group.querySelector(".pub[data-topics]:not(.hidden)");
      }
    });
  }
}

const year = document.querySelector("#year");
if (year) year.textContent = String(new Date().getFullYear());

const fox = document.querySelector("#footer-fox");
if (fox) {
  fox.addEventListener("click", () => fox.classList.toggle("revealed"));
}

for (const cover of document.querySelectorAll("button[data-video-src]")) {
  cover.addEventListener("click", () => {
    const frame = cover.closest(".pub-media");
    const video = document.createElement("video");
    const poster = cover.querySelector("img");
    const status = frame.querySelector("[data-video-status]");
    const hadFocus = document.activeElement === cover;

    video.controls = true;
    video.playsInline = true;
    video.preload = "none";
    video.tabIndex = 0;
    video.setAttribute("aria-label", cover.dataset.videoLabel || "Research video");
    if (poster) video.poster = poster.currentSrc || poster.src;
    if (status) status.textContent = "";

    video.addEventListener("error", () => {
      const returnFocus = document.activeElement === video;
      video.remove();
      cover.hidden = false;
      if (status) status.textContent = "Video unavailable. Try again.";
      if (returnFocus) cover.focus({ preventScroll: true });
    }, { once: true });

    cover.hidden = true;
    frame.append(video);
    video.src = cover.dataset.videoSrc;
    if (hadFocus) video.focus({ preventScroll: true });
    // The native controls remain available if the browser declines playback.
    video.play().catch(() => {});
  });
}
