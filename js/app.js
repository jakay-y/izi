/* ============================================================
   IZI — storefront logic
   Catalog, cart, checkout, search, account, frequency, studio
   ============================================================ */

const STORAGE_KEY = "izi-catalog-v10";
const CART_KEY = "izi-cart-v1";
const ORDERS_KEY = "izi-orders-v1";
const ACCOUNT_KEY = "izi-account-v1";
const NEWS_KEY = "izi-newsletter-v1";
const GATE_CODE = "IZI2026";
const FREE_SHIP_AT = 75000;
const SIZES = ["S", "M", "L", "XL", "XXL"];

let catalog = [];
let cart = [];
let orders = [];
let account = null;
let subscribers = [];
let pendingImageData = null;
let editingId = null;
let modalProduct = null;
let modalSize = "M";
let modalQty = 1;
let freqMatchId = null;

/*
  Live drop (restored):
  p1 big  = The Mad Consortium @ ₦50,000
  p2 tall = Craft Youth Tee — Red
  p3      = Go Izi Baby Tee — White
  p4      = Marked As Different
  Hero    = original hero.jpg
  Manifesto bg = craizi girl
*/
const SEED_PRODUCTS = [
  {
    id: "p1",
    name: "The Mad Consortium",
    price: 50000,
    compareAt: null,
    category: "Tops",
    subcategory: "Tees",
    tag: "New",
    size: "big",
    visible: true,
    inStock: true,
    colors: 1,
    description:
      "The Mad Consortium — iZi Executive Club. Heavyweight cotton, cut for a relaxed fit that moves with you.",
    image: "assets/izi-shirt.jpg",
  },
  {
    id: "p2",
    name: "Craft Youth Tee — Red",
    price: 25000,
    compareAt: null,
    category: "Tops",
    subcategory: "Tees",
    tag: "New",
    size: "tall",
    visible: true,
    inStock: true,
    colors: 2,
    description:
      "The flagship Drop 001 piece. Heavyweight cotton, distressed graphic print, cut for a relaxed fit that moves with you.",
    image: "assets/product-craft-youth-red.jpg",
  },
  {
    id: "p3",
    name: "Go Izi Baby Tee — White",
    price: 20000,
    compareAt: null,
    category: "Tops",
    subcategory: "Tees",
    tag: "",
    size: "normal",
    visible: true,
    inStock: true,
    colors: 3,
    description:
      'The signature lip graphic that started it all. Fitted cut, soft-hand print, comes in white and pink.',
    image: "assets/product-go-izi-baby-merch.png",
  },
  {
    id: "p4",
    name: "Marked As Different",
    price: 35000,
    compareAt: null,
    category: "Tops",
    subcategory: "Long Sleeves",
    tag: "Limited",
    size: "normal",
    visible: true,
    inStock: true,
    colors: 1,
    description:
      'Long sleeve statement piece. "IZI iz mad, so are you" — for the ones who never blended in and stopped trying to.',
    image: "assets/product-marked-as-different.jpg",
  },
];

/* ---------- utils ---------- */
function formatNGN(n) {
  const num = Number(n) || 0;
  return (
    "₦" +
    num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function priceLine(p) {
  if (p.compareAt && p.compareAt > p.price) {
    return `<span class="was">${formatNGN(p.compareAt)}</span>${formatNGN(p.price)}`;
  }
  if (p.colors && p.colors > 1) {
    return `FROM ${formatNGN(p.price)}`;
  }
  return formatNGN(p.price);
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : String(str);
  return d.innerHTML;
}

function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/* ---------- storage / boot ---------- */
function loadAll() {
  const stored = lsGet(STORAGE_KEY, null);
  catalog = Array.isArray(stored) && stored.length ? stored : SEED_PRODUCTS.slice();
  if (!stored) lsSet(STORAGE_KEY, catalog);
  normalizeCatalogImages();

  cart = lsGet(CART_KEY, []) || [];
  orders = lsGet(ORDERS_KEY, []) || [];
  account = lsGet(ACCOUNT_KEY, null);
  subscribers = lsGet(NEWS_KEY, []) || [];

  renderBento();
  renderCart();
  updateBagCount();
  setManifestoBackground();
}

function saveCatalog() {
  if (!lsSet(STORAGE_KEY, catalog)) {
    showToast("Could not save — storage full or blocked.", true);
    return false;
  }
  return true;
}

function saveCart() {
  lsSet(CART_KEY, cart);
  updateBagCount();
  renderCart();
}

function saveOrders() {
  lsSet(ORDERS_KEY, orders);
}

/* Keep known seed products on the correct images (fixes stale localStorage) */
const SEED_IMAGE_BY_ID = Object.fromEntries(
  SEED_PRODUCTS.map((p) => [p.id, p.image])
);

function normalizeCatalogImages() {
  let changed = false;
  catalog = catalog.map((p) => {
    const seedImg = SEED_IMAGE_BY_ID[p.id];
    if (seedImg && p.image !== seedImg) {
      changed = true;
      return { ...p, image: seedImg };
    }
    // Fix old wrong filenames from earlier builds
    if (p.image && /product-craft-red\.jpg|product-go-izi\.jpg|product-marked\.jpg|product-craft-white\.jpg/.test(p.image)) {
      const byName = SEED_PRODUCTS.find((s) => s.id === p.id || s.name === p.name);
      if (byName) {
        changed = true;
        return { ...p, image: byName.image };
      }
    }
    return p;
  });
  if (changed) lsSet(STORAGE_KEY, catalog);
}

/* ---------- storefront render ---------- */
function renderBento() {
  const grid = document.getElementById("bentoGrid");
  if (!grid) return;
  normalizeCatalogImages();

  // Fixed display order so mobile never reshuffles tiles
  const order = ["p1", "p2", "p3", "p4"];
  const visible = catalog
    .filter((p) => p.visible)
    .slice()
    .sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

  const stat = document.getElementById("statCount");
  if (stat) stat.textContent = String(visible.length).padStart(2, "0");

  if (!visible.length) {
    grid.innerHTML =
      '<div class="empty-state" style="grid-column:1/-1;">No drops live right now — check back soon.</div>';
    return;
  }

  grid.innerHTML = visible
    .map(
      (p) => `
    <div class="bento-item" data-product="${escapeHtml(p.id)}" data-size="${p.size || "normal"}" onclick="openModal('${p.id}')"
         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openModal('${p.id}');}"
         role="button" tabindex="0" aria-label="View ${escapeHtml(p.name)}">
      <img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async">
      <div class="shade"></div>
      ${p.tag ? `<span class="badge">${escapeHtml(p.tag)}</span>` : ""}
      <div class="info">
        <div class="cat">${escapeHtml(p.category)}</div>
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="price">${priceLine(p)}</div>
      </div>
    </div>`
    )
    .join("");
}

/* ---------- product modal ---------- */
function openModal(id) {
  const p = catalog.find((x) => x.id === id);
  if (!p) return;
  modalProduct = p;
  modalSize = "M";
  modalQty = 1;

  document.getElementById("mImg").src = p.image;
  document.getElementById("mImg").alt = p.name;
  // Flat product shots (front+back shirt) — zoom out in modal
  const mImgWrap = document.querySelector("#modalOverlay .m-img");
  if (mImgWrap) {
    mImgWrap.classList.toggle(
      "flat-product",
      p.id === "p1" || /izi-shirt/i.test(p.image || "")
    );
  }
  document.getElementById("mCat").textContent =
    p.category + (p.subcategory ? " · " + p.subcategory : "");
  document.getElementById("mName").textContent = p.name;
  document.getElementById("mPrice").innerHTML =
    priceLine(p) +
    (p.colors > 1
      ? ` <span style="color:var(--fg-dim); font-size:12px;">— Available in ${p.colors} colors</span>`
      : "") +
    (p.inStock === false
      ? ` <span style="color:var(--riot-2); font-size:12px;">— Out of stock</span>`
      : "");
  document.getElementById("mDesc").textContent = p.description || "";
  document.getElementById("mQty").textContent = "1";

  const sizes = document.getElementById("mSizes");
  sizes.innerHTML = SIZES.map(
    (s) =>
      `<button type="button" class="${s === modalSize ? "active" : ""}" onclick="selectModalSize('${s}')">${s}</button>`
  ).join("");

  const addBtn = document.getElementById("mAddBtn");
  if (p.inStock === false) {
    addBtn.disabled = true;
    addBtn.textContent = "Out of Stock";
  } else {
    addBtn.disabled = false;
    addBtn.textContent = "Add to Bag →";
  }

  document.getElementById("modalOverlay").classList.add("open");
  document.getElementById("mClose").focus();
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
  modalProduct = null;
}

function selectModalSize(s) {
  modalSize = s;
  document.querySelectorAll("#mSizes button").forEach((btn) => {
    btn.classList.toggle("active", btn.textContent === s);
  });
}

function changeModalQty(delta) {
  modalQty = Math.max(1, Math.min(10, modalQty + delta));
  document.getElementById("mQty").textContent = String(modalQty);
}

function addModalToBag() {
  if (!modalProduct || modalProduct.inStock === false) return;
  addToCart(modalProduct.id, modalSize, modalQty);
  closeModal();
  openCart();
  showToast("Added to bag");
}

/* ---------- cart ---------- */
function cartKey(id, size) {
  return id + "::" + size;
}

function addToCart(productId, size, qty) {
  const p = catalog.find((x) => x.id === productId);
  if (!p) return;
  const key = cartKey(productId, size || "M");
  const existing = cart.find((c) => c.key === key);
  if (existing) {
    existing.qty = Math.min(10, existing.qty + (qty || 1));
  } else {
    cart.push({
      key,
      productId,
      size: size || "M",
      qty: qty || 1,
      name: p.name,
      price: p.price,
      image: p.image,
    });
  }
  saveCart();
}

function updateCartQty(key, delta) {
  const line = cart.find((c) => c.key === key);
  if (!line) return;
  line.qty += delta;
  if (line.qty <= 0) cart = cart.filter((c) => c.key !== key);
  saveCart();
}

function removeFromCart(key) {
  cart = cart.filter((c) => c.key !== key);
  saveCart();
  showToast("Removed from bag");
}

function cartCount() {
  return cart.reduce((s, c) => s + c.qty, 0);
}

function cartSubtotal() {
  return cart.reduce((s, c) => s + c.price * c.qty, 0);
}

function updateBagCount() {
  const n = cartCount();
  document.querySelectorAll(".bag-count").forEach((el) => {
    el.textContent = String(n);
  });
}

function renderCart() {
  const body = document.getElementById("cartBody");
  const foot = document.getElementById("cartFoot");
  if (!body) return;

  if (!cart.length) {
    body.innerHTML = `
      <div class="cart-empty">
        <p>Your bag is empty</p>
        <button type="button" class="btn-primary" onclick="closeCart();goShop('All');">Shop the Drop →</button>
      </div>`;
    if (foot) foot.hidden = true;
    return;
  }

  body.innerHTML = cart
    .map(
      (line) => `
    <div class="cart-line">
      <img src="${line.image}" alt="">
      <div>
        <div class="cl-name">${escapeHtml(line.name)}</div>
        <div class="cl-meta">Size ${escapeHtml(line.size)}</div>
        <div class="qty-control">
          <button type="button" onclick="updateCartQty('${line.key}',-1)" aria-label="Decrease">−</button>
          <span>${line.qty}</span>
          <button type="button" onclick="updateCartQty('${line.key}',1)" aria-label="Increase">+</button>
        </div>
        <button type="button" class="cl-remove" onclick="removeFromCart('${line.key}')">Remove</button>
      </div>
      <div class="cl-price">${formatNGN(line.price * line.qty)}</div>
    </div>`
    )
    .join("");

  if (foot) {
    foot.hidden = false;
    const sub = cartSubtotal();
    document.getElementById("cartSubtotal").textContent = formatNGN(sub);
    const note = document.getElementById("cartShipNote");
    if (sub >= FREE_SHIP_AT) {
      note.textContent = "You qualify for free shipping.";
    } else {
      note.textContent =
        "Free shipping on orders over ₦75,000 — " +
        formatNGN(FREE_SHIP_AT - sub) +
        " away.";
    }
  }
}

function openCart() {
  closeAccount();
  closeSearch();
  document.getElementById("cartDrawer").classList.add("open");
  document.getElementById("cartScrim").classList.add("open");
  renderCart();
}

function closeCart() {
  document.getElementById("cartDrawer").classList.remove("open");
  document.getElementById("cartScrim").classList.remove("open");
}

/* ---------- checkout ---------- */
function hideAllMainViews() {
  document.getElementById("view-site").style.display = "none";
  document.getElementById("view-shop").style.display = "none";
  document.getElementById("view-admin").classList.remove("active");
  document.getElementById("view-checkout").classList.remove("active");
  document.getElementById("view-success").classList.remove("active");
  closeCart();
  closeAccount();
  closeSearch();
  closeFrequency();
  closeModal();
  closeMobileMenu();
}

function goCheckout() {
  if (!cart.length) {
    showToast("Your bag is empty.", true);
    return;
  }
  hideAllMainViews();
  document.getElementById("view-checkout").classList.add("active");
  document.body.classList.remove("lock-scroll");

  if (account) {
    if (account.name) document.getElementById("coName").value = account.name;
    if (account.email) document.getElementById("coEmail").value = account.email;
  }

  renderCheckoutSummary();
  window.scrollTo(0, 0);
}

function closeCheckout() {
  document.getElementById("view-checkout").classList.remove("active");
  document.getElementById("view-site").style.display = "";
  openCart();
}

function renderCheckoutSummary() {
  const lines = document.getElementById("checkoutLines");
  const totals = document.getElementById("checkoutTotals");
  if (!lines) return;

  lines.innerHTML = cart
    .map(
      (line) => `
    <div class="order-summary-line">
      <img src="${line.image}" alt="">
      <div style="flex:1;">
        <div class="os-name">${escapeHtml(line.name)}</div>
        <div class="os-meta">Size ${escapeHtml(line.size)} · Qty ${line.qty}</div>
      </div>
      <div class="os-meta">${formatNGN(line.price * line.qty)}</div>
    </div>`
    )
    .join("");

  const sub = cartSubtotal();
  const ship = sub >= FREE_SHIP_AT ? 0 : 3500;
  const total = sub + ship;

  totals.innerHTML = `
    <div class="row"><span>Subtotal</span><span>${formatNGN(sub)}</span></div>
    <div class="row"><span>Shipping</span><span>${ship === 0 ? "Free" : formatNGN(ship)}</span></div>
    <div class="row total"><span>Total</span><span>${formatNGN(total)}</span></div>`;
}

function selectPay(input) {
  document.querySelectorAll(".pay-opt").forEach((el) => el.classList.remove("active"));
  input.closest(".pay-opt").classList.add("active");
}

function placeOrder(e) {
  e.preventDefault();
  if (!cart.length) {
    showToast("Your bag is empty.", true);
    return false;
  }

  const name = document.getElementById("coName").value.trim();
  const email = document.getElementById("coEmail").value.trim();
  const phone = document.getElementById("coPhone").value.trim();
  const address = document.getElementById("coAddress").value.trim();
  const city = document.getElementById("coCity").value.trim();
  const state = document.getElementById("coState").value.trim();
  const notes = document.getElementById("coNotes").value.trim();
  const payMethod =
    (document.querySelector('input[name="payMethod"]:checked') || {}).value || "card";

  if (!name || !email || !phone || !address || !city || !state) {
    showToast("Fill in all required fields.", true);
    return false;
  }

  const sub = cartSubtotal();
  const ship = sub >= FREE_SHIP_AT ? 0 : 3500;
  const total = sub + ship;
  const ref = "IZI-" + Date.now().toString(36).toUpperCase();

  const order = {
    id: uid("ord_"),
    ref,
    createdAt: new Date().toISOString(),
    status: "paid",
    payMethod,
    customer: { name, email, phone, address, city, state, notes },
    items: cart.map((c) => ({ ...c })),
    subtotal: sub,
    shipping: ship,
    total,
  };

  orders.unshift(order);
  saveOrders();

  account = { name, email };
  lsSet(ACCOUNT_KEY, account);

  cart = [];
  saveCart();

  hideAllMainViews();
  document.getElementById("view-success").classList.add("active");
  document.getElementById("successRef").textContent =
    "Order " + ref + " · " + formatNGN(total);
  document.getElementById("checkoutForm").reset();
  showToast("Order placed");
  return false;
}

/* ---------- search ---------- */
function openSearch() {
  closeCart();
  closeAccount();
  const el = document.getElementById("searchOverlay");
  el.classList.add("open");
  document.body.classList.add("lock-scroll");
  const input = document.getElementById("searchInput");
  input.value = "";
  onSearchInput();
  setTimeout(() => input.focus(), 50);
}

function closeSearch() {
  document.getElementById("searchOverlay").classList.remove("open");
  if (!document.getElementById("mobileMenu").classList.contains("open")) {
    document.body.classList.remove("lock-scroll");
  }
}

function onSearchInput() {
  const q = (document.getElementById("searchInput").value || "").trim().toLowerCase();
  const results = document.getElementById("searchResults");
  const hint = document.getElementById("searchHint");
  let items = catalog.filter((p) => p.visible);

  if (q) {
    items = items.filter((p) => {
      const hay = [p.name, p.category, p.subcategory, p.tag, p.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    hint.textContent =
      items.length + (items.length === 1 ? " result" : " results") + " for “" + q + "”";
  } else {
    hint.textContent = "Type a name, category, or tag";
    items = items.slice(0, 6);
  }

  if (!items.length) {
    results.innerHTML =
      '<div class="empty-state" style="grid-column:1/-1;">No pieces match — try another word.</div>';
    return;
  }

  results.innerHTML = items
    .map(
      (p) => `
    <div class="search-hit" onclick="closeSearch();openModal('${p.id}');" role="button" tabindex="0"
         onkeydown="if(event.key==='Enter'){closeSearch();openModal('${p.id}');}">
      <img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy">
      <div class="sh-body">
        <div class="sh-name">${escapeHtml(p.name)}</div>
        <div class="sh-price">${priceLine(p)}</div>
      </div>
    </div>`
    )
    .join("");
}

/* ---------- account (removed from UI — guest checkout only) ---------- */
function openAccount() {
  /* no customer account UI */
}
function closeAccount() {
  /* no-op */
}

/* ---------- newsletter ---------- */
function submitNewsletter(e) {
  e.preventDefault();
  const input = document.getElementById("newsEmail");
  const note = document.getElementById("newsNote");
  const email = (input.value || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    showToast("Enter a valid email.", true);
    return false;
  }
  if (!subscribers.includes(email)) {
    subscribers.push(email);
    lsSet(NEWS_KEY, subscribers);
  }
  input.value = "";
  if (note) note.textContent = "You're on the list. Next drop hits your inbox first.";
  showToast("You're on the list");
  return false;
}

/* ---------- boot: logo loader → intro → site ---------- */
function runBootSequence() {
  const loader = document.getElementById("view-loader");
  if (!loader) return;
  // Hold on logo, then fade into character intro
  setTimeout(() => {
    loader.classList.add("leave");
    setTimeout(() => {
      loader.classList.add("hidden");
      loader.setAttribute("aria-hidden", "true");
    }, 800);
  }, 2000);
}

/* ---------- intro ---------- */
function enterSite() {
  const intro = document.getElementById("view-intro");
  intro.classList.add("leaving");
  document.body.classList.remove("lock-scroll");
  setTimeout(() => {
    document.querySelectorAll(".hero-reveal").forEach((el) => el.classList.add("in"));
  }, 220);
  setTimeout(() => {
    intro.classList.add("hidden");
    intro.setAttribute("aria-hidden", "true");
  }, 1150);
}

/* ---------- studio ---------- */
function openAdmin() {
  hideAllMainViews();
  document.getElementById("view-admin").classList.add("active");
  document.getElementById("studioGate").style.display = "flex";
  document.getElementById("studioDashboard").style.display = "none";
  document.getElementById("gateInput").value = "";
  document.getElementById("gateErr").textContent = "";
  document.body.classList.remove("lock-scroll");
  window.scrollTo(0, 0);
}

function closeAdmin() {
  document.getElementById("view-admin").classList.remove("active");
  document.getElementById("view-site").style.display = "";
  document.getElementById("view-shop").style.display = "none";
  renderBento();
  window.scrollTo(0, 0);
}

function checkGate() {
  const val = document.getElementById("gateInput").value;
  if (val === GATE_CODE) {
    document.getElementById("studioGate").style.display = "none";
    document.getElementById("studioDashboard").style.display = "block";
    renderStudioList();
    renderStudioOrders();
    renderStudioSubs();
  } else {
    document.getElementById("gateErr").textContent = "Incorrect code — try again.";
  }
}

function switchStudioTab(tab) {
  document.querySelectorAll(".studio-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === tab);
  });
  document.getElementById("studioProducts").classList.toggle("active", tab === "products");
  document.getElementById("studioOrders").classList.toggle("active", tab === "orders");
  document.getElementById("studioSubscribers").classList.toggle("active", tab === "subscribers");
  if (tab === "orders") renderStudioOrders();
  if (tab === "subscribers") renderStudioSubs();
}

function renderStudioList() {
  const list = document.getElementById("studioList");
  if (!list) return;
  if (!catalog.length) {
    list.innerHTML =
      '<div class="empty-state">No drops yet — add your first one above.</div>';
    return;
  }
  list.innerHTML = catalog
    .map(
      (p) => `
    <div class="studio-row ${p.visible ? "" : "hidden-item"}">
      <img class="thumb" src="${p.image}" alt="">
      <div class="r-name">${escapeHtml(p.name)}${
        p.tag ? `<span class="tag-chip">${escapeHtml(p.tag)}</span>` : ""
      }${
        p.inStock === false
          ? `<span class="tag-chip" style="color:var(--fg-dim);">Out of Stock</span>`
          : ""
      }</div>
      <div class="r-cat">${escapeHtml(p.category)}${
        p.subcategory ? " · " + escapeHtml(p.subcategory) : ""
      }</div>
      <div class="r-price">${formatNGN(p.price)}</div>
      <div class="r-actions">
        <button type="button" class="toggle ${p.visible ? "on" : ""}" role="switch" aria-checked="${p.visible}" onclick="toggleVisible('${p.id}')"><span class="knob"></span></button>
        <button class="icon-btn" onclick="openForm('${p.id}')" title="Edit" aria-label="Edit">✎</button>
        <button class="icon-btn danger" onclick="deleteProduct('${p.id}')" title="Delete" aria-label="Delete">🗑</button>
      </div>
    </div>`
    )
    .join("");
}

function renderStudioOrders() {
  const list = document.getElementById("studioOrderList");
  if (!list) return;
  if (!orders.length) {
    list.innerHTML = '<div class="empty-state">No orders yet.</div>';
    return;
  }
  list.innerHTML = orders
    .map((o) => {
      const items = (o.items || [])
        .map((i) => escapeHtml(i.name) + " ×" + i.qty)
        .join(", ");
      return `
      <div class="studio-row">
        <div class="r-name" style="grid-column:1/-1;">
          <strong>${escapeHtml(o.ref)}</strong>
          <span class="tag-chip">${escapeHtml(o.status)}</span>
          <div style="margin-top:8px;font-weight:400;color:var(--fg-dim);font-size:13px;">
            ${escapeHtml(o.customer?.name || "")} · ${escapeHtml(o.customer?.email || "")}<br>
            ${items}<br>
            ${formatNGN(o.total)} · ${escapeHtml(o.payMethod || "card")}
          </div>
        </div>
      </div>`;
    })
    .join("");
}

function renderStudioSubs() {
  const list = document.getElementById("studioSubList");
  if (!list) return;
  if (!subscribers.length) {
    list.innerHTML = '<div class="empty-state">No subscribers yet.</div>';
    return;
  }
  list.innerHTML = subscribers
    .map(
      (email) => `
    <div class="studio-row">
      <div class="r-name" style="grid-column:1/-1;">${escapeHtml(email)}</div>
    </div>`
    )
    .join("");
}

function toggleVisible(id) {
  const p = catalog.find((x) => x.id === id);
  if (!p) return;
  p.visible = !p.visible;
  renderStudioList();
  if (saveCatalog()) showToast(p.visible ? "Now live on site" : "Hidden from site");
}

function deleteProduct(id) {
  if (!confirm("Delete this drop permanently? This cannot be undone.")) return;
  catalog = catalog.filter((x) => x.id !== id);
  renderStudioList();
  if (saveCatalog()) showToast("Drop deleted");
}

function openForm(id) {
  editingId = id || null;
  pendingImageData = null;
  const form = document.getElementById("studioForm");
  form.classList.add("open");
  document.getElementById("formTitle").textContent = id ? "Edit Drop" : "Add New Drop";

  if (id) {
    const p = catalog.find((x) => x.id === id);
    document.getElementById("fName").value = p.name;
    document.getElementById("fPrice").value = p.price;
    document.getElementById("fCompareAt").value = p.compareAt || "";
    document.getElementById("fCategory").value = p.category;
    document.getElementById("fSubcategory").value = p.subcategory || "";
    document.getElementById("fTag").value = p.tag || "";
    document.getElementById("fColors").value = p.colors || 1;
    document.getElementById("fSize").value = p.size || "normal";
    document.getElementById("fVisible").value = String(!!p.visible);
    document.getElementById("fInStock").value = String(p.inStock !== false);
    document.getElementById("fDesc").value = p.description || "";
    const preview = document.getElementById("fImgPreview");
    preview.src = p.image;
    preview.style.display = "block";
    pendingImageData = p.image;
  } else {
    document.getElementById("fName").value = "";
    document.getElementById("fPrice").value = "";
    document.getElementById("fCompareAt").value = "";
    document.getElementById("fCategory").value = "Tops";
    document.getElementById("fSubcategory").value = "";
    document.getElementById("fTag").value = "";
    document.getElementById("fColors").value = 1;
    document.getElementById("fSize").value = "normal";
    document.getElementById("fVisible").value = "true";
    document.getElementById("fInStock").value = "true";
    document.getElementById("fDesc").value = "";
    const preview = document.getElementById("fImgPreview");
    preview.src = "";
    preview.style.display = "none";
  }
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeForm() {
  document.getElementById("studioForm").classList.remove("open");
  editingId = null;
  pendingImageData = null;
}

function handleImageUpload(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 1000;
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      pendingImageData = dataUrl;
      const preview = document.getElementById("fImgPreview");
      preview.src = dataUrl;
      preview.style.display = "block";
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function saveForm() {
  const name = document.getElementById("fName").value.trim();
  const price = parseFloat(document.getElementById("fPrice").value);
  if (!name || isNaN(price)) {
    showToast("Add a name and a valid price before saving.", true);
    return;
  }
  if (!pendingImageData) {
    showToast("Add a product image before saving.", true);
    return;
  }
  const compareAtRaw = document.getElementById("fCompareAt").value;
  const data = {
    name,
    price,
    compareAt: compareAtRaw ? parseFloat(compareAtRaw) : null,
    category: document.getElementById("fCategory").value,
    subcategory: document.getElementById("fSubcategory").value.trim(),
    tag: document.getElementById("fTag").value,
    colors: parseInt(document.getElementById("fColors").value) || 1,
    size: document.getElementById("fSize").value,
    visible: document.getElementById("fVisible").value === "true",
    inStock: document.getElementById("fInStock").value === "true",
    description: document.getElementById("fDesc").value.trim(),
    image: pendingImageData,
  };

  if (editingId) {
    const idx = catalog.findIndex((x) => x.id === editingId);
    if (idx > -1) catalog[idx] = { ...catalog[idx], ...data };
  } else {
    catalog.push({ id: "p" + Date.now(), ...data });
  }

  closeForm();
  renderStudioList();
  if (saveCatalog()) showToast("Saved — now live on the site.");
}

/* ---------- toast ---------- */
let toastTimer = null;
function showToast(msg, isErr) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.toggle("err", !!isErr);
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- nav / mega / mobile ---------- */
document.querySelectorAll(".site-nav").forEach((navEl) => {
  window.addEventListener("scroll", () => {
    if (window.scrollY > 12) navEl.classList.add("scrolled");
    else navEl.classList.remove("scrolled");
  });
});

const revealTargets = document.querySelectorAll(".reveal");
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
);
revealTargets.forEach((el) => io.observe(el));

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    closeFrequency();
    closeAllMegaMenus();
    closeMobileMenu();
    closeCart();
    closeAccount();
    closeSearch();
  }
});

function openMobileMenu() {
  document.getElementById("mobileMenu").classList.add("open");
  document.getElementById("mobileMenu").setAttribute("aria-hidden", "false");
  document.body.classList.add("lock-scroll");
}

function closeMobileMenu() {
  const menu = document.getElementById("mobileMenu");
  if (!menu.classList.contains("open")) return;
  menu.classList.remove("open");
  menu.setAttribute("aria-hidden", "true");
  const intro = document.getElementById("view-intro");
  const introActive =
    intro &&
    !intro.classList.contains("hidden") &&
    !intro.classList.contains("leaving");
  const searchOpen = document
    .getElementById("searchOverlay")
    .classList.contains("open");
  if (!introActive && !searchOpen) {
    document.body.classList.remove("lock-scroll");
  }
}

function toggleMobileSub(btn) {
  btn.nextElementSibling.classList.toggle("open");
}

function toggleMegaMenu(btn) {
  const item = btn.closest(".nav-item");
  const isOpen = item.classList.contains("open");
  closeAllMegaMenus();
  if (!isOpen) {
    item.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
  }
}

function closeAllMegaMenus() {
  document.querySelectorAll(".nav-item.open").forEach((el) => {
    el.classList.remove("open");
    const btn = el.querySelector(".nav-link");
    if (btn) btn.setAttribute("aria-expanded", "false");
  });
}

function showFlyout(triggerEl, key) {
  const menu = triggerEl.closest(".mega-menu");
  menu.querySelectorAll(".mega-sub").forEach((el) => el.classList.remove("active"));
  triggerEl.classList.add("active");
  menu.querySelectorAll(".mega-flyout").forEach((el) => el.classList.remove("active"));
  const flyout = menu.querySelector(`.mega-flyout[data-key="${key}"]`);
  if (flyout) flyout.classList.add("active");
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".nav-item.has-dropdown")) closeAllMegaMenus();
});

/* ---------- page navigation ---------- */
function showSite() {
  document.getElementById("view-site").style.display = "";
  document.getElementById("view-shop").style.display = "none";
  document.getElementById("view-admin").classList.remove("active");
  document.getElementById("view-checkout").classList.remove("active");
  document.getElementById("view-success").classList.remove("active");
}

function goHome() {
  showSite();
  closeAllMegaMenus();
  closeCart();
  closeAccount();
  closeSearch();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goToSection(id) {
  showSite();
  closeAllMegaMenus();
  closeCart();
  closeAccount();
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, 50);
}

function goShop(category, subcategory) {
  document.getElementById("view-site").style.display = "none";
  document.getElementById("view-shop").style.display = "block";
  document.getElementById("view-admin").classList.remove("active");
  document.getElementById("view-checkout").classList.remove("active");
  document.getElementById("view-success").classList.remove("active");
  closeAllMegaMenus();
  closeCart();
  closeAccount();
  shopFilters.category = category && category !== "All" ? category : null;
  shopFilters.subcategory = subcategory || null;
  document.getElementById("shopTitle").textContent =
    subcategory || shopFilters.category || "All Products";
  window.scrollTo(0, 0);
  initPriceFilterBounds();
  renderShopGrid();
}

/* ---------- shop filters ---------- */
let shopFilters = {
  inStockOnly: false,
  minPrice: 0,
  maxPrice: null,
  sort: "date-new",
  category: null,
  subcategory: null,
};
let maxCatalogPrice = 100000;

function initPriceFilterBounds() {
  maxCatalogPrice = Math.max(...catalog.map((p) => p.price), 1000);
  const minRange = document.getElementById("priceMinRange");
  const maxRange = document.getElementById("priceMaxRange");
  minRange.max = maxCatalogPrice;
  maxRange.max = maxCatalogPrice;
  minRange.value = 0;
  maxRange.value = maxCatalogPrice;
  document.getElementById("priceMinNum").value = 0;
  document.getElementById("priceMaxNum").value = maxCatalogPrice;
  document.getElementById("priceHint").textContent =
    "The highest price is " + formatNGN(maxCatalogPrice);
  shopFilters.minPrice = 0;
  shopFilters.maxPrice = maxCatalogPrice;
  updatePriceFill();
}

function updatePriceFill() {
  const min = parseFloat(document.getElementById("priceMinRange").value);
  const max = parseFloat(document.getElementById("priceMaxRange").value);
  const pctMin = (min / maxCatalogPrice) * 100;
  const pctMax = (max / maxCatalogPrice) * 100;
  const fill = document.getElementById("priceFill");
  fill.style.left = pctMin + "%";
  fill.style.width = Math.max(0, pctMax - pctMin) + "%";
}

function onPriceRangeInput() {
  let minV = parseFloat(document.getElementById("priceMinRange").value);
  let maxV = parseFloat(document.getElementById("priceMaxRange").value);
  if (minV > maxV) {
    const t = minV;
    minV = maxV;
    maxV = t;
  }
  document.getElementById("priceMinNum").value = minV;
  document.getElementById("priceMaxNum").value = maxV;
  shopFilters.minPrice = minV;
  shopFilters.maxPrice = maxV;
  updatePriceFill();
  renderShopGrid();
}

function onPriceNumInput() {
  let minV = parseFloat(document.getElementById("priceMinNum").value) || 0;
  let maxV = parseFloat(document.getElementById("priceMaxNum").value) || maxCatalogPrice;
  document.getElementById("priceMinRange").value = minV;
  document.getElementById("priceMaxRange").value = maxV;
  shopFilters.minPrice = minV;
  shopFilters.maxPrice = maxV;
  updatePriceFill();
  renderShopGrid();
}

function toggleStockFilter() {
  const btn = document.getElementById("stockToggle");
  const on = !btn.classList.contains("on");
  btn.classList.toggle("on", on);
  btn.setAttribute("aria-checked", String(on));
  shopFilters.inStockOnly = on;
  renderShopGrid();
}

function onSortChange() {
  shopFilters.sort = document.getElementById("sortSelect").value;
  renderShopGrid();
}

function toggleFilterGroup(btn) {
  btn.closest(".filter-group").classList.toggle("collapsed");
}

function renderShopGrid() {
  let items = catalog.filter((p) => p.visible);
  if (shopFilters.inStockOnly) items = items.filter((p) => p.inStock !== false);
  if (shopFilters.maxPrice != null)
    items = items.filter(
      (p) => p.price >= shopFilters.minPrice && p.price <= shopFilters.maxPrice
    );
  if (shopFilters.category)
    items = items.filter((p) => p.category === shopFilters.category);
  if (shopFilters.subcategory)
    items = items.filter((p) => p.subcategory === shopFilters.subcategory);

  switch (shopFilters.sort) {
    case "price-asc":
      items = items.slice().sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      items = items.slice().sort((a, b) => b.price - a.price);
      break;
    case "name-asc":
      items = items.slice().sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      items = items.slice().reverse();
  }

  const grid = document.getElementById("shopGrid");
  let cardsHtml = items
    .map(
      (p) => `
    <article class="shop-card" data-product="${escapeHtml(p.id)}" onclick="openModal('${p.id}')"
         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openModal('${p.id}');}"
         role="button" tabindex="0" aria-label="View ${escapeHtml(p.name)}">
      <div class="sc-img">
        <img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async">
        ${p.tag ? `<span class="badge">${escapeHtml(p.tag)}</span>` : ""}
      </div>
      <div class="sc-meta">
        <div class="sc-name">${escapeHtml(p.name)}</div>
        <div class="sc-price">${priceLine(p)}</div>
        ${p.colors > 1 ? `<div class="sc-colors">Available in ${p.colors} colors</div>` : ""}
      </div>
    </article>`
    )
    .join("");

  if (!items.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">No pieces match these filters yet — try widening your search, or check back soon.</div>`;
  } else {
    if (!shopFilters.category && items.length < 6) {
      const placeholders = 6 - items.length;
      for (let i = 0; i < placeholders; i++) {
        cardsHtml += `<div class="shop-card"><div class="sc-img ph"><span class="ph-label">Coming Soon</span></div><div class="sc-name" style="color:var(--fg-dim);">New Drop</div></div>`;
      }
    }
    grid.innerHTML = cardsHtml;
  }
  document.getElementById("shopCount").textContent =
    items.length + (items.length === 1 ? " Product" : " Products");
}

/* ---------- FAQ ---------- */
function toggleFaq(btn) {
  const item = btn.closest(".faq-item");
  const willOpen = !item.classList.contains("open");
  item.classList.toggle("open");
  btn.setAttribute("aria-expanded", String(willOpen));
}

/* ---------- Frequency (original discovery — replaces AI stylist) ---------- */
const FREQUENCIES = {
  riot: {
    code: "01 · RIOT",
    title: "Riot frequency",
    line: "You don't enter quiet. Craft Youth Red is the volume you already run at.",
    productId: "p2",
  },
  clean: {
    code: "02 · CLEAN",
    title: "Clean frequency",
    line: "High contrast, zero noise. The Mad Consortium is the piece that holds the line.",
    productId: "p1",
  },
  signal: {
    code: "03 · SIGNAL",
    title: "Signal frequency",
    line: "The lip graphic that started the broadcast. Go Izi Baby — white base, pink optional.",
    productId: "p3",
  },
  static: {
    code: "04 · STATIC",
    title: "Static frequency",
    line: "Limited run. Marked As Different — for the ones who stopped blending in on purpose.",
    productId: "p4",
  },
};

function openFrequency() {
  resetFrequency();
  document.getElementById("freqOverlay").classList.add("open");
  document.getElementById("freqClose").focus();
}

function closeFrequency() {
  document.getElementById("freqOverlay").classList.remove("open");
}

function resetFrequency() {
  freqMatchId = null;
  document.getElementById("freqPick").hidden = false;
  document.getElementById("freqResult").hidden = true;
  document.querySelectorAll(".freq-tile").forEach((t) => t.classList.remove("active"));
}

function pickFrequency(key) {
  const freq = FREQUENCIES[key];
  if (!freq) return;
  const product =
    catalog.find((p) => p.id === freq.productId && p.visible) ||
    catalog.find((p) => p.id === freq.productId);
  if (!product) {
    showToast("That drop isn't live right now.", true);
    return;
  }

  freqMatchId = product.id;
  document.querySelectorAll(".freq-tile").forEach((t) => {
    t.classList.toggle("active", t.dataset.freq === key);
  });

  document.getElementById("freqPick").hidden = true;
  document.getElementById("freqResult").hidden = false;
  document.getElementById("freqResultCode").textContent = freq.code;
  document.getElementById("freqResultTitle").textContent = freq.title;
  document.getElementById("freqResultLine").textContent = freq.line;

  document.getElementById("freqMatchCard").innerHTML = `
    <button type="button" class="freq-product" onclick="closeFrequency(); openModal('${product.id}');">
      <div class="fp-img"><img src="${product.image}" alt="${escapeHtml(product.name)}"></div>
      <div class="fp-body">
        <div class="fp-cat">${escapeHtml(product.category)}${
          product.subcategory ? " · " + escapeHtml(product.subcategory) : ""
        }</div>
        <div class="fp-name">${escapeHtml(product.name)}</div>
        <div class="fp-price">${priceLine(product)}</div>
        <div class="fp-hint">Tap for details</div>
      </div>
    </button>`;

  const addBtn = document.getElementById("freqAddBtn");
  if (product.inStock === false) {
    addBtn.disabled = true;
    addBtn.textContent = "Out of Stock";
  } else {
    addBtn.disabled = false;
    addBtn.textContent = "Add to Bag →";
  }
}

function addFrequencyToBag() {
  if (!freqMatchId) return;
  const p = catalog.find((x) => x.id === freqMatchId);
  if (!p || p.inStock === false) return;
  addToCart(p.id, "M", 1);
  closeFrequency();
  openCart();
  showToast("Frequency locked — in bag");
}

/* ---------- manifesto bg ---------- */
function setManifestoBackground() {
  // Craizi girl from merch — full photo, no heavy black fill
  const manifestoUrl = "assets/hero-craizi-girl.jpg";
  document.documentElement.style.setProperty(
    "--manifesto-bg",
    `url("${manifestoUrl}")`
  );
  const photoEl = document.querySelector("#manifesto .manifesto-photo");
  if (photoEl) {
    photoEl.style.backgroundImage = `url("${manifestoUrl}")`;
  }

  const heroImg = document.querySelector("#hero .bgimg img");
  if (heroImg && heroImg.src) {
    document.documentElement.style.setProperty(
      "--shop-hero-bg",
      `url("${heroImg.src}")`
    );
  } else {
    document.documentElement.style.setProperty(
      "--shop-hero-bg",
      `url("assets/hero.jpg")`
    );
  }
}

/* ---------- boot ---------- */
loadAll();
runBootSequence();
