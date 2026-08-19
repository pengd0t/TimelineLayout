# Timeline Canvas

An Obsidian plugin that creates a new Canvas containing a vertical timeline background. The timeline is generated as an SVG image so it remains crisp while zooming, and ordinary Canvas cards can be placed over it.

## Features

- Start and end date/time
- Year, quarter, month, week, day, hour, or minute increments
- Increment size (e.g. every 3 months)
- Adjustable vertical spacing and timeline width
- Automatic or custom date labels
- Major/minor lines
- SVG background stored in a configurable folder
- Creates a fresh `.canvas` file without modifying existing canvases

## Build

Requires Node.js. From this directory:

```bash
npm install
npm run build
```

Then copy `main.js`, `manifest.json`, and `styles.css` into:

`YourVault/.obsidian/plugins/timeline-canvas/`

Enable **Timeline Canvas** under Settings → Community plugins.

## Use

Open the Command Palette and run **Timeline Canvas: Create timeline canvas**.

Examples:

- `2022-01-01` → `2023-01-01`, increment `month`, size `1`
- `2026-07-01 00:00` → `2026-07-02 00:00`, increment `hour`, size `1`
