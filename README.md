# Timeline Canvas

**Timeline Canvas** is an Obsidian plugin that generates **vertical timeline backgrounds** as scalable SVG images and places them on a Canvas. You lay out notes, cards, and media on top of a shared time axis, so events stay aligned by date while you organize the story however you want.

Use it for a single clean timeline, or for **several parallel tracks** (columns) so you can compare different streams of events on the same calendar.

---

## Why use it?
Obsidian Canvas is excellent for spatial thinking, but it has no built-in time grid. Without a background, cards drift and “when” becomes hard to see at a glance.

Here's the problem I'd have.  

<img width="894" height="732" alt="timeline-canvas-old" src="https://github.com/user-attachments/assets/bf2655e7-c7c8-4c1e-b2d3-ab25d5be46a9" />

Once a timeline like this starts including many items in parallel related timelines, I can see how they all fit together in time visually and quickly... But... half the time is spent stretching out old timelines and tweaking things so that everything fits and everything aligned left to right across the page still lines up as a single point in time as you're going down the timeline.

My solution was to create a simple but customizable canvas background that keeps everything in it's final location from the start. 

<img width="921" height="641" alt="timeline-canvas-new" src="https://github.com/user-attachments/assets/0ca7d5d4-0016-4b16-a95b-16bc181c41eb" />

If necessary, it is possible to do some editing after the fact without starting over with a new canvas just because you want to edit the background image.  As long as you leave the incremental spacing representing months (or days, or years, etc.) all your cards will stay put if you add another column to make it wider, or crop things down smaller.


## How it works
This plugin draws the time axis for you:

1. You choose a date range and how time is divided (months, years, custom periods, …).
2. The plugin creates an SVG timeline and a Canvas that uses it as the background.
3. You place normal Canvas cards on top.  Project notes, people, sources, images are still aligned to the grid.

The background is a real vault file (SVG), so it stays sharp when you zoom and can be widened or edited later without starting over.

---

## Use cases

### Single timeline

- **Project history** - Milestones from kickoff to launch on one vertical spine  
- **Biography or research log** - Life events or source chronology  
- **Course or reading plan** - Weeks/semesters as the axis; notes as cards  

### Parallel timelines (columns)

Split the background into vertical bands so multiple sequences share the same dates:

| Column | Example |
|--------|---------|
| General history | Wars, inventions, cultural events |
| Family history | Births, moves, letters |
| Company / project | Funding rounds, releases |
| Personal | Health, travel, study |

You can see a family event *in the context of* the wider world, or a product launch *against* industry news, without juggling separate canvases.

### Planning and review

- Map a year by month and drop tasks or meetings onto the grid  
- Export or screenshot a section for a report; **crop** the canvas to content first so the frame is tight  

---

## Getting started

1. Enable the plugin (**Settings → Community plugins → Timeline Canvas**).  
2. Run **Create timeline canvas** from the command palette, or click the calendar ribbon icon.  
3. Set **start** and **end** dates (and other options as needed).  
4. Choose an **output folder** (or rely on defaults from Settings).  
5. Click **Create timeline**.

A `.canvas` file opens with the SVG timeline at the back. Add cards from the Canvas UI as usual and position them along the axis.

**Date format:** `YYYY-MM-DD` or with time, e.g. `2022-01-01` or `2022-01-01 08:00`.

---

## Creating a timeline

### Time range and increments

| Option | Purpose |
|--------|---------|
| **Start / End date/time** | Outer bounds of the timeline |
| **Increment** | Years, quarters, months, weeks, days, hours, minutes, or **Custom** |
| **Increment size** | e.g. every 1 month or every 3 months |
| **Pixels between increments** | Vertical spacing on the generated image |
| **Timeline width** | Horizontal size of the background (room for cards / columns) |
| **Label format** | How tick labels are written (automatic, year, month+year, full date, …) |
| **Major line every** | Emphasize every *n* ticks (0 = no major lines) |
| **Show minor lines** | Toggle lighter intermediate lines |

### Custom increments

Choose **Custom** when the axis is conceptual rather than calendar-based:

- **Custom increment name** - e.g. `Semester`, `Phase`, `Chapter`  
- **Number of occurrences** - how many equal bands between start and end  

Example: start `2025-01-01`, end `2025-12-31`, name `Semester`, count `4` → four labels (*Semester 1* … *Semester 4*) spaced evenly between the year boundaries.

### Title and columns

| Option | Purpose |
|--------|---------|
| **Timeline title** | Optional title drawn at the top of the SVG |
| **Columns** | Number of vertical bands (1–20) for parallel timelines |
| **Column N title** | Header for each band (e.g. *General history*, *Family history*) |

With more than one column, dashed vertical dividers separate the tracks. Horizontal date lines still run across the full width so every column shares the same time axis.

### Output location

- **Output folder** - where the `.canvas` file is created (pre-filled from plugin settings; leave blank for vault root).  
- **Browse** - pick an existing folder.  
- Missing folders are created automatically.  
- The **SVG** is written to the **default SVG folder** from Settings, or next to the canvas if that setting is empty.

---

## Working on the canvas

### Cards on top of the grid

Place text cards, notes, images, and groups on the Canvas. Align them to tick marks so their vertical position means “when.” Use columns to keep different themes in different horizontal bands.

### Background at the back and locked

Obsidian draws Canvas nodes in array order (first = back). The plugin marks the timeline SVG as the background and can:

- Keep it **at the back** so cards are not hidden behind it  
- **Lock** it (`pointer-events: none`) so clicks select your cards instead of the background  

Obsidian does not lock individual cards natively; lock here is the plugin’s way to make the background non-interactive while you work.

### Commands (command palette)

Open a timeline `.canvas` file first (most of these only appear when a canvas is active):

| Command | What it does |
|---------|----------------|
| **Create timeline canvas** | Open the create dialog (also on the ribbon) |
| **Widen timeline background** | Regenerate a wider SVG; **top-left stays fixed** so existing cards don’t shift, Only more room to the right is added.|
| **Edit timeline columns and title** | Change title, column count, and column headers; regenerates the SVG in place |
| **Crop timeline canvas to content** | Show content bounds, set a buffer, shift nodes to the origin, and resize the background (useful before PDF/export) |
| **Send timeline background to back** | Put the SVG at the bottom of the stack |
| **Toggle lock timeline background** | Lock or unlock the background for the current canvas |

After widen or column edits, the open canvas reloads so the new SVG appears without manually closing the tab.

---

## Settings

**Settings → Timeline Canvas:**

| Setting | Purpose |
|---------|---------|
| **Default canvas folder** | Default location for new `.canvas` files (create dialog is pre-filled) |
| **Default SVG folder** | Where timeline SVGs are stored (e.g. your attachments folder). Empty = same folder as the canvas |
| **Keep timeline background at the back** | After plugin actions, keep the SVG as the bottom-most node |
| **Lock timeline background by default** | New timelines start with a non-clickable background |

---

## Tips

1. **Start wider than you think** or create narrow and **Widen** later; the origin stays put.  
2. **Columns for comparison**. Even two columns (*Context* | *Detail*) make parallel stories easier to read.  
3. **Lock the background** while placing cards; unlock only when you need to move or resize the SVG node.  
4. **Crop before export** to trim empty margin for a cleaner PDF or screenshot.  
5. **Metadata** settings are stored with the SVG (and a small `.timeline-meta.json` sidecar) so columns/title/width can be edited later. Prefer creating timelines with the current plugin version for full edit support.  
6. **Zoom freely**. The timeline is SVG, so labels stay sharp at any Canvas zoom level.

---

## Installation

Manual install:

1. Copy `main.js`, `manifest.json`, and `styles.css` into:

   ```text
   <vault>/.obsidian/plugins/timeline-canvas/
   ```

2. In Obsidian: **Settings → Community plugins** → enable **Timeline Canvas**.  
3. Reload the app if the plugin was already installed and you updated files.

Requires Obsidian **1.5.0** or newer.

---

## Files the plugin creates

| File | Role |
|------|------|
| `Timeline YYYY-MM-DD–YYYY-MM-DD.canvas` | Canvas board with the SVG as a file node |
| `Timeline YYYY-MM-DD–YYYY-MM-DD.svg` | Timeline artwork (title, columns, date grid) |
| `Timeline … .timeline-meta.json` | Sidecar settings for later column/title/width edits |

You can rename files in the vault; keep the canvas node pointing at the correct SVG if you move them by hand.
