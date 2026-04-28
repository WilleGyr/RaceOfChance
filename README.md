# Race of Chance

> An F1-themed randomizer that picks the order of up to 10 people by racing them around a Spa-Francorchamps inspired track. The car that crosses the line first decides who's first — pure chance, smooth animation, no backend.

**Live demo →** [willegyr.github.io/RaceOfChance](https://willegyr.github.io/RaceOfChance/)

---

## Features

- **Up to 10 drivers**, each assigned to one of the 11 2026 F1 teams (Mercedes, Ferrari, McLaren, Red Bull, Alpine, Racing Bulls, Haas, Audi, Williams, Cadillac, Aston Martin) — every team has its own livery colour.
- **Top-down SVG track** inspired by Spa-Francorchamps, with start/finish line, La Source hairpin, Eau Rouge / Raidillon, the Kemmel straight and the Bus Stop chicane.
- **Smooth animation** driven by `requestAnimationFrame` and `getPointAtLength`, so the cars hug the track perfectly through every corner.
- **Genuinely random outcome** — every car starts at the exact same point on the start line, with randomised base speed plus per-second speed variance, so the finishing order is never biased by the order drivers were entered in.
- **Live leaderboard** during the race and a podium with gold / silver / bronze accents on the results screen.
- **Modern minimalist design** with subtle F1-tinted gradients, a fading grid backdrop, and a gradient-filled title.

## Tech

- Vanilla HTML, CSS, JavaScript — no frameworks, no build step.
- SVG paths for the track and cars, per-frame `transform` updates for smooth motion.
- Static-only — hosted directly on GitHub Pages from the repo root.

## Run locally

Just open [`index.html`](index.html) in a browser, or serve the folder with any static server:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

## Project structure

```
.
├── index.html   # Markup — setup, race and results screens
├── style.css    # All visual styling
├── app.js       # Race logic, animation loop, DOM rendering
└── README.md
```

## License

[MIT](LICENSE) — © Wille Gyr
