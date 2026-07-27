# IZI — Go Izi Baby (HTML Prototype)

Static full storefront rebuilt from the single-file prototype. **All original copy is unchanged.** Styling is polished; missing commerce flows are filled in.

## Open it

Double-click `index.html`, or from this folder:

```bash
# optional local server
npx --yes serve .
```

## Project layout

```
IZI/
├── index.html          # markup (all views)
├── css/styles.css      # design system + new flow UI
├── js/app.js           # cart, checkout, search, account, studio
├── assets/             # logo, hero, products, community
└── izi-site (10).html  # original prototype (reference)
```

## Flows

| Flow | What it does |
|------|----------------|
| Intro | “Choose Your Character” overlay |
| Shop | Bento home + full shop with filters/sort |
| Quick view | Size + qty + **Add to Bag** |
| **Cart** | Drawer, qty, remove, free-shipping note |
| **Checkout** | Guest form, shipping, mock payment, order success |
| **Search** | Full-screen search over catalog |
| **Account** | Guest profile + order history (local) |
| **Newsletter** | Email capture (local) |
| **Frequency** | Pick RIOT / CLEAN / SIGNAL / STATIC → matched piece → bag |
| Studio | Code `IZI2026` — products, **orders**, **subscribers** |

### Image map (from original HTML)

| Asset | Used for |
|-------|----------|
| `intro-door.jpg` | Loading / character-select (red tee at door) |
| `hero.jpg` | Homepage hero |
| `community-pink.jpg` | @izigirlph · Go Izi Baby Tee — Pink |
| `community-duo.jpg` | @thecrewph · Craft Youth Tee — Duo |
| `product-craft-youth-red.jpg` | Craft Youth Tee — Red |
| `product-craft-youth-white.jpg` | Craft Youth Tee — White |
| `product-go-izi-baby.jpg` | Go Izi Baby Tee — White |
| `product-marked-as-different.jpg` | Marked As Different |

## Studio

Footer → **Studio** → access code: `IZI2026`

Data persists in `localStorage` on this browser only.
