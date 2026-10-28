/* ============================================================
   IZI — product showcase
   Full-screen product viewer. The stage colour follows the product,
   the next piece waits as a small thumbnail, and moving on flies the
   current one out and the next one in.

   openModal() / closeModal() keep their old names so every "view
   product" button on the site (cards, search, Frequency) still works.
   Sizes, quantity and Add to Bag reuse selectModalSize(),
   changeModalQty() and addModalToBag() from app.js.
   ============================================================ */

const PV_REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");
const PV_DEFAULT_TONE = "#2b2a28";
const PV_FLY = { duration: 640, easing: "cubic-bezier(0.65, 0, 0.35, 1)" };

const pvToneCache = {};
let pvItems = [];
let pvIndex = 0;
let pvBusy = false;
let pvReturnFocus = null;

const pvEl = (id) => document.getElementById(id);
const pvPad = (n) => String(n).padStart(2, "0");

/* ---------- image handling ---------- */

/* Studio renders have a solid black background and are blended into the
   stage. Real photos (jpg) are shown as a framed picture instead. */
function pvIsPhoto(p) {
  const img = p.image || "";
  return (
    p.photo === true ||
    /\.jpe?g(\?|$)/i.test(img) ||
    /^data:image\/jpe?g/i.test(img)
  );
}

function pvPreload(src) {
  return new Promise((resolve) => {
    if (!src) return resolve();
    const im = new Image();
    im.onload = resolve;
    im.onerror = resolve;
    im.src = src;
    setTimeout(resolve, 700);
  });
}

/* ---------- stage colour ---------- */

function pvToneKey(p) {
  return p.id + "|" + String(p.image || "").slice(-48);
}

/* Reads the dominant colour of the garment from its image. Black prints on
   black garments return null (neutral stage); white garments return grey. */
function pvToneFromImage(img) {
  const W = 72;
  const H = 90;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
  const total = W * H;
  const buckets = Array.from({ length: 24 }, () => ({ n: 0, r: 0, g: 0, b: 0 }));
  let chroma = 0;
  let light = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max < 60) continue;
    const d = max - min;
    const s = d / max;
    if (s > 0.38) {
      let h;
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
      const k = buckets[Math.floor(h / 15)];
      k.n++;
      k.r += r;
      k.g += g;
      k.b += b;
      chroma++;
    } else if (max > 190 && s < 0.18) {
      light++;
    }
  }

  if (chroma / total >= 0.03) {
    const k = buckets.reduce((a, b) => (b.n > a.n ? b : a));
    return `rgb(${Math.round(k.r / k.n)}, ${Math.round(k.g / k.n)}, ${Math.round(k.b / k.n)})`;
  }
  if (light / total >= 0.12) return "#8d949a";
  return null;
}

function pvKnownTone(p) {
  if (p.accent) return p.accent;
  const key = pvToneKey(p);
  return key in pvToneCache ? pvToneCache[key] : undefined;
}

function pvDetectTone(p) {
  const known = pvKnownTone(p);
  if (known !== undefined) return Promise.resolve(known);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let tone = null;
      try {
        tone = pvToneFromImage(img);
      } catch (e) {
        /* canvas blocked (e.g. file://) — keep the neutral stage */
      }
      pvToneCache[pvToneKey(p)] = tone;
      resolve(tone);
    };
    img.onerror = () => resolve(null);
    img.src = productImageSrc(p.image);
  });
}

function pvApplyTone(p) {
  const overlay = pvEl("modalOverlay");
  const known = pvKnownTone(p);
  if (known !== undefined) {
    overlay.style.setProperty("--pv-tone", known || PV_DEFAULT_TONE);
    return;
  }
  pvDetectTone(p).then((tone) => {
    if (modalProduct !== p) return;
    overlay.style.setProperty("--pv-tone", tone || PV_DEFAULT_TONE);
  });
}

/* ---------- content ---------- */

function pvFill(p) {
  const sizes = Array.isArray(p.sizes) && p.sizes.length ? p.sizes : SIZES.slice();
  modalProduct = p;
  modalSize = sizes[0];
  modalQty = 1;

  pvEl("mCat").textContent = [p.category, p.subcategory, p.shade]
    .filter(Boolean)
    .join(" / ");
  pvEl("mName").textContent = p.name;
  pvEl("mDesc").textContent = p.description || "";
  pvEl("mPrice").innerHTML = priceLine(p);
  pvEl("pvNote").hidden = p.inStock !== false;
  pvEl("mQty").textContent = "1";
  pvEl("mSizes").innerHTML = sizes
    .map(
      (s) =>
        `<button type="button" class="${s === modalSize ? "active" : ""}" onclick="selectModalSize('${String(s).replace(/'/g, "\\'")}')">${escapeHtml(s)}</button>`
    )
    .join("");

  const addBtn = pvEl("mAddBtn");
  if (p.inStock === false || p.comingSoon) {
    addBtn.disabled = true;
    addBtn.textContent = p.comingSoon ? "Coming Soon" : "Out of Stock";
  } else {
    addBtn.disabled = false;
    addBtn.textContent = "Add to Bag →";
  }

  const many = pvItems.length > 1;
  pvEl("pvCount").textContent = `${pvPad(pvIndex + 1)} / ${pvPad(pvItems.length)}`;
  pvEl("pvPager").hidden = !many;
  pvEl("pvPeek").hidden = !many;
  if (many) {
    const next = pvItems[(pvIndex + 1) % pvItems.length];
    pvEl("pvPeekImg").src = productImageSrc(next.image);
    pvEl("pvPeek").setAttribute("aria-label", "Next product: " + next.name);
    pvEl("pvPeek").classList.toggle("is-photo", pvIsPhoto(next));
  }
}

function pvSetFigure(p) {
  const img = pvEl("mImg");
  const src = productImageSrc(p.image);
  if (src) {
    img.src = src;
    img.style.display = "";
  } else {
    img.removeAttribute("src");
    img.style.display = "none";
  }
  img.alt = p.name;
  const photo = pvIsPhoto(p);
  pvEl("pvFigure").classList.toggle("is-photo", photo);
  pvEl("pvStage").classList.toggle("has-photo", photo);
}

/* ---------- open / close ---------- */

function openModal(id) {
  const p = catalog.find((x) => x.id === id);
  if (!p) return;
  const visible = catalog.filter((x) => x.visible);
  // A hidden product can still be reached (e.g. from Frequency); keep it first.
  pvItems = visible.some((x) => x.id === id) ? visible : [p].concat(visible);
  pvIndex = pvItems.findIndex((x) => x.id === id);

  const overlay = pvEl("modalOverlay");
  pvReturnFocus = document.activeElement;
  pvBusy = false;

  pvFill(p);
  pvSetFigure(p);
  pvApplyTone(p);

  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("lock-scroll");
  overlay.querySelector(".pv-scroll").scrollTop = 0;
  pvEl("mClose").focus({ preventScroll: true });

  if (!PV_REDUCED.matches) {
    pvEl("pvFigure").animate(
      [
        { opacity: 0, transform: "translateY(36px) scale(0.96)", filter: "blur(8px)" },
        { opacity: 1, transform: "none", filter: "blur(0)" },
      ],
      { duration: 700, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
    );
  }
}

function closeModal() {
  const overlay = pvEl("modalOverlay");
  if (!overlay.classList.contains("open")) {
    modalProduct = null;
    return;
  }
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("lock-scroll");
  modalProduct = null;
  if (pvReturnFocus && document.contains(pvReturnFocus)) {
    pvReturnFocus.focus({ preventScroll: true });
  }
  pvReturnFocus = null;
}

/* ---------- moving between products ---------- */

async function pvStep(dir) {
  if (pvBusy || pvItems.length < 2) return;
  pvBusy = true;

  const stage = pvEl("pvStage");
  const figure = pvEl("pvFigure");
  pvIndex = (pvIndex + dir + pvItems.length) % pvItems.length;
  const to = pvItems[pvIndex];

  // Load the incoming image first so it never pops in half-drawn.
  await pvPreload(productImageSrc(to.image));

  let ghost = null;
  if (!PV_REDUCED.matches) {
    ghost = figure.cloneNode(true);
    ghost.removeAttribute("id");
    ghost.setAttribute("aria-hidden", "true");
    ghost.classList.add("pv-ghost");
    ghost.querySelector("img").removeAttribute("id");
    stage.insertBefore(ghost, figure);
  }

  pvFill(to);
  pvSetFigure(to);
  pvApplyTone(to);

  if (ghost) {
    const upperLeft = "translate(-34%, -24%) scale(0.5)";
    const lowerRight = "translate(44%, 36%) scale(0.3)";
    const leaving = dir > 0 ? upperLeft : lowerRight;
    const arriving = dir > 0 ? lowerRight : upperLeft;

    ghost.animate(
      [
        { opacity: 1, transform: "none", filter: "blur(0)" },
        { opacity: 0, transform: leaving, filter: "blur(10px)" },
      ],
      { ...PV_FLY, fill: "forwards" }
    );
    figure.animate(
      [
        { opacity: 0, transform: arriving, filter: "blur(10px)" },
        { opacity: 1, transform: "none", filter: "blur(0)" },
      ],
      PV_FLY
    );
    setTimeout(() => ghost.remove(), PV_FLY.duration + 80);
  }

  setTimeout(() => {
    pvBusy = false;
  }, PV_REDUCED.matches ? 0 : 420);
}

/* ---------- keyboard and touch ---------- */

document.addEventListener("keydown", (e) => {
  const overlay = pvEl("modalOverlay");
  if (!overlay || !overlay.classList.contains("open")) return;

  if (e.key === "ArrowRight") {
    e.preventDefault();
    pvStep(1);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    pvStep(-1);
  } else if (e.key === "Tab") {
    // Keep focus inside the viewer while it is open.
    const focusable = Array.from(
      overlay.querySelectorAll("button:not([disabled])")
    ).filter((el) => el.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

(function () {
  const stage = pvEl("pvStage");
  if (!stage) return;
  let x0 = 0;
  let y0 = 0;
  stage.addEventListener(
    "touchstart",
    (e) => {
      x0 = e.changedTouches[0].clientX;
      y0 = e.changedTouches[0].clientY;
    },
    { passive: true }
  );
  stage.addEventListener(
    "touchend",
    (e) => {
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        pvStep(dx < 0 ? 1 : -1);
      }
    },
    { passive: true }
  );
})();
