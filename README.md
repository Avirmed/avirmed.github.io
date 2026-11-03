# avirmed.github.io

Personal academic site of Dr. Avirmed Enkhbat (Э. Авирмэд), Associate Professor at the National University of Mongolia.

Plain HTML/CSS/JS with no build step, so GitHub Pages serves it as is.

## Editing content

| What | Where |
|---|---|
| Publications, research topics, ongoing research, courses, contact links, hero numbers | `assets/js/data.js` |
| Interface text (Mongolian / English) | `assets/js/i18n.js` |
| Code shown in the `</>` editor | `FILES` in `assets/js/code.js` |
| Photo | `assets/img/gobi.jpg` |

To add a paper, copy one entry in `publications` (newest first) and fill in `year`, `type` (`journal` or `conference`), `topics` (`hci`, `action`, `vision`, `data`), `title`, `authors`, `venue` and `doi`. The co-author network, filters, counts and BibTeX are generated from this list. Update the citation count in `stats` by hand from Google Scholar.

## Run locally

```sh
python -m http.server 8000
```

Then open http://localhost:8000. The camera (hand mode, `▶ Run` on `gesture.py`) only works over `http://localhost` or `https://`, not when `index.html` is opened as a file.

## Deploy to GitHub Pages

1. Create a public repository named **`Avirmed.github.io`** under the `Avirmed` account.
2. Push the contents of this folder to the `main` branch.
3. In the repository, open **Settings → Pages** and choose **Deploy from a branch → `main` / root**.

The site is then live at https://avirmed.github.io/.

## Files

```
index.html              page structure, SEO and schema.org metadata
assets/css/style.css    design tokens (light/dark), layout, components
assets/js/data.js       content
assets/js/i18n.js       MN/EN strings
assets/js/hero.js       skeleton graph animation (morin khuur, drums, …)
assets/js/glyphs.js     animated research icons and the road-damage BEV figure
assets/js/main.js       language/theme, publications, co-author network
assets/js/code.js       editor + terminal
assets/js/handmode.js   MediaPipe hand tracking (cursor, pinch-to-click)
```
