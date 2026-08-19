/**
 * Timeline Canvas
 * @license MIT
 */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var stdin_exports = {};
__export(stdin_exports, {
  default: () => TimelineCanvasPlugin
});
module.exports = __toCommonJS(stdin_exports);
var import_obsidian = require("obsidian");
const DEFAULTS = {
  start: "2022-01-01",
  end: "2023-01-01",
  increment: "month",
  step: 1,
  customName: "Period",
  customCount: 4,
  pixelsPerStep: 140,
  timelineWidth: 1800,
  labelFormat: "auto",
  majorEvery: 12,
  majorUnit: "month",
  lineColor: "#8b8b8b",
  majorLineColor: "#555555",
  labelColor: "#555555",
  backgroundColor: "transparent",
  showMinor: true,
  outputFolder: "",
  title: "",
  columnCount: 1,
  columnTitles: [""]
};
const DEFAULT_PLUGIN_SETTINGS = {
  defaultCanvasFolder: "",
  defaultSvgFolder: "",
  keepBackgroundAtBack: true,
  lockBackground: true
};
class TimelineCanvasPlugin extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "settings", { ...DEFAULT_PLUGIN_SETTINGS });
  }
  async onload() {
    await this.loadSettings();
    this.addCommand({
      id: "create-timeline-canvas",
      name: "Create timeline canvas",
      callback: () => this.openTimelineModal()
    });
    this.addCommand({
      id: "widen-timeline-background",
      name: "Widen timeline background",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "canvas") return false;
        if (!checking) void this.openWidenModal(file);
        return true;
      }
    });
    this.addCommand({
      id: "crop-timeline-canvas",
      name: "Crop timeline canvas to content",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "canvas") return false;
        if (!checking) void this.openCropModal(file);
        return true;
      }
    });
    this.addCommand({
      id: "edit-timeline-columns",
      name: "Edit timeline columns and title",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "canvas") return false;
        if (!checking) void this.openColumnsModal(file);
        return true;
      }
    });
    this.addCommand({
      id: "send-timeline-background-to-back",
      name: "Send timeline background to back",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "canvas") return false;
        if (!checking) void this.sendBackgroundToBack(file);
        return true;
      }
    });
    this.addCommand({
      id: "toggle-lock-timeline-background",
      name: "Toggle lock timeline background",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "canvas") return false;
        if (!checking) void this.toggleBackgroundLock(file);
        return true;
      }
    });
    this.addRibbonIcon("calendar-range", "Create timeline canvas", () => this.openTimelineModal());
    this.addSettingTab(new TimelineSettingTab(this.app, this));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => {
      window.setTimeout(() => this.applyBackgroundDomState(), 50);
    }));
    this.registerEvent(this.app.workspace.on("layout-change", () => {
      window.setTimeout(() => this.applyBackgroundDomState(), 100);
    }));
  }
  async loadSettings() {
    const data = await this.loadData();
    this.settings = { ...DEFAULT_PLUGIN_SETTINGS };
    if (data) {
      if (typeof data.defaultCanvasFolder === "string") this.settings.defaultCanvasFolder = data.defaultCanvasFolder;
      if (typeof data.defaultSvgFolder === "string") this.settings.defaultSvgFolder = data.defaultSvgFolder;
      if (typeof data.keepBackgroundAtBack === "boolean") this.settings.keepBackgroundAtBack = data.keepBackgroundAtBack;
      if (typeof data.lockBackground === "boolean") this.settings.lockBackground = data.lockBackground;
      if (!this.settings.defaultCanvasFolder && typeof data.outputFolder === "string") {
        this.settings.defaultCanvasFolder = data.outputFolder;
      }
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  openTimelineModal() {
    const defaults = {
      ...DEFAULTS,
      // Pre-fill with the configured default canvas folder so it rarely needs changing.
      outputFolder: this.settings.defaultCanvasFolder
    };
    new TimelineModal(this.app, defaults, (settings) => this.createTimeline(settings)).open();
  }
  async createTimeline(settings) {
    const start = parseLocalDate(settings.start);
    const end = parseLocalDate(settings.end);
    if (!start || !end || end <= start) {
      new import_obsidian.Notice("Timeline end must be after the start.");
      return;
    }
    if (settings.increment === "custom") {
      settings.customName = settings.customName.trim() || "Period";
      settings.customCount = Math.max(1, Math.floor(settings.customCount) || 1);
    } else {
      settings.step = Math.max(1, Math.floor(settings.step) || 1);
    }
    const marks = buildTimelineMarks(start, end, settings);
    if (marks.length < 1) {
      new import_obsidian.Notice("The selected range does not contain enough increments.");
      return;
    }
    if (marks.length > 2e4) {
      new import_obsidian.Notice("That would create more than 20,000 timeline marks. Please use a larger increment.");
      return;
    }
    const canvasFolder = (0, import_obsidian.normalizePath)(settings.outputFolder.trim());
    const svgFolder = (0, import_obsidian.normalizePath)(
      this.settings.defaultSvgFolder.trim() || settings.outputFolder.trim()
    );
    if (canvasFolder) await this.ensureFolder(canvasFolder);
    if (svgFolder && svgFolder !== canvasFolder) await this.ensureFolder(svgFolder);
    const base = `Timeline ${formatFileDate(start)}\u2013${formatFileDate(end)}`;
    const canvasPath = await this.uniquePath(`${canvasFolder ? canvasFolder + "/" : ""}${base}.canvas`);
    const svgPath = await this.uniquePath(`${svgFolder ? svgFolder + "/" : ""}${base}.svg`);
    settings.columnCount = Math.max(1, Math.min(20, Math.floor(settings.columnCount) || 1));
    settings.columnTitles = normalizeColumnTitles(settings.columnTitles, settings.columnCount);
    settings.title = (settings.title || "").trim();
    const svg = buildSvg(marks, start, end, settings);
    await this.app.vault.create(svgPath, svg);
    {
      const createdSvg = this.app.vault.getAbstractFileByPath(svgPath);
      if (createdSvg instanceof import_obsidian.TFile) await this.writeSidecarMeta(createdSvg, settings);
    }
    const intervalCount = settings.increment === "custom" ? Math.max(1, settings.customCount) : Math.max(1, marks.length - 1);
    const headerExtra = (settings.title ? 40 : 0) + (settings.columnCount > 1 || settings.columnTitles.some((t) => t) ? 36 : 0);
    const imageHeight = Math.max(600, intervalCount * settings.pixelsPerStep + 220 + headerExtra);
    const canvas = {
      nodes: [{
        id: randomId(),
        type: "file",
        x: 0,
        y: 0,
        width: settings.timelineWidth,
        height: imageHeight,
        file: svgPath,
        timelineBackground: true,
        timelineBackgroundLocked: this.settings.lockBackground,
        timelineSettings: serializeTimelineSettings(settings)
      }],
      edges: []
    };
    await this.app.vault.create(canvasPath, JSON.stringify(canvas, null, 2));
    const file = this.app.vault.getAbstractFileByPath(canvasPath);
    if (file instanceof import_obsidian.TFile) await this.app.workspace.getLeaf(true).openFile(file);
    const description = settings.increment === "custom" ? `${settings.customCount} ${settings.customName.toLowerCase()}` : `${marks.length - 1} increments`;
    new import_obsidian.Notice(`Created timeline with ${description}.`);
  }
  async openWidenModal(canvasFile) {
    try {
      const ctx = await this.loadTimelineContext(canvasFile);
      new WidenModal(this.app, ctx.bgNode.width, async (newWidth) => {
        await this.widenTimeline(canvasFile, ctx, newWidth);
      }).open();
    } catch (e) {
      new import_obsidian.Notice(e instanceof Error ? e.message : "Could not widen timeline.");
    }
  }
  async openColumnsModal(canvasFile) {
    try {
      const ctx = await this.loadTimelineContext(canvasFile);
      const meta = resolveTimelineSettings(ctx) || await this.readSidecarMeta(ctx.svgFile);
      if (!meta) {
        new import_obsidian.Notice("No timeline settings found. Recreate the timeline with this plugin version to enable column editing.");
        return;
      }
      new ColumnsModal(this.app, meta, async (next) => {
        await this.rebuildTimelineSvg(canvasFile, ctx, next);
        new import_obsidian.Notice("Timeline columns and title updated.");
      }).open();
    } catch (e) {
      new import_obsidian.Notice(e instanceof Error ? e.message : "Could not edit columns.");
    }
  }
  async openCropModal(canvasFile) {
    try {
      const data = await this.readCanvas(canvasFile);
      if (!data.nodes.length) {
        new import_obsidian.Notice("This canvas has no nodes to crop.");
        return;
      }
      const bounds = contentBounds(data.nodes);
      new CropModal(this.app, bounds, async (buffer) => {
        await this.cropCanvas(canvasFile, data, bounds, buffer);
      }).open();
    } catch (e) {
      new import_obsidian.Notice(e instanceof Error ? e.message : "Could not crop canvas.");
    }
  }
  async loadTimelineContext(canvasFile) {
    const data = await this.readCanvas(canvasFile);
    const bgNode = findBackgroundNode(data);
    if (!bgNode || !bgNode.file) {
      throw new Error("No timeline SVG background found on this canvas. Open a timeline canvas created by this plugin.");
    }
    const svgFile = this.app.vault.getAbstractFileByPath(bgNode.file);
    if (!(svgFile instanceof import_obsidian.TFile) || svgFile.extension !== "svg") {
      throw new Error(`Background file is missing or not an SVG: ${bgNode.file}`);
    }
    const svgText = await this.app.vault.read(svgFile);
    return { data, bgNode, svgFile, svgText };
  }
  async readCanvas(file) {
    const raw = await this.app.vault.read(file);
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.nodes)) throw new Error("Invalid canvas file.");
    if (!Array.isArray(data.edges)) data.edges = [];
    return data;
  }
  async writeCanvas(file, data) {
    await this.app.vault.modify(file, JSON.stringify(data, null, 2));
    await this.refreshOpenCanvas(file, data);
  }
  /** Push data into open canvas views so SVG/file nodes reload from disk. */
  async refreshOpenCanvas(file, data) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    for (const leaf of this.app.workspace.getLeavesOfType("canvas")) {
      const view = leaf.view;
      if (((_a = view.file) == null ? void 0 : _a.path) !== file.path) continue;
      if ((_b = view.canvas) == null ? void 0 : _b.setData) {
        try {
          view.canvas.setData(data);
          (_d = (_c = view.canvas).requestFrame) == null ? void 0 : _d.call(_c);
          if (view.canvas.nodes) {
            for (const node of view.canvas.nodes.values()) {
              if (((_e = node.file) == null ? void 0 : _e.extension) === "svg") {
                const nd = (_f = node.getData) == null ? void 0 : _f.call(node);
                if (nd && node.setData) node.setData({ ...nd });
              }
            }
          }
          (_h = (_g = view.canvas).requestFrame) == null ? void 0 : _h.call(_g);
          continue;
        } catch (e) {
        }
      }
      await leaf.openFile(file, { active: leaf === this.app.workspace.getMostRecentLeaf() });
    }
  }
  async widenTimeline(canvasFile, ctx, newWidth) {
    const width = Math.max(300, Math.floor(newWidth));
    if (width === Math.round(ctx.bgNode.width)) {
      new import_obsidian.Notice("Width is unchanged.");
      return;
    }
    const meta = resolveTimelineSettings(ctx) || await this.readSidecarMeta(ctx.svgFile);
    if (meta) {
      meta.timelineWidth = width;
      await this.rebuildTimelineSvg(canvasFile, ctx, meta);
      new import_obsidian.Notice(`Timeline background widened to ${width}px.`);
      return;
    }
    const widened = widenSvg(ctx.svgText, width);
    await this.app.vault.modify(ctx.svgFile, widened);
    ctx.bgNode.width = width;
    markAsTimelineBackground(ctx.bgNode, this.settings.lockBackground);
    if (this.settings.keepBackgroundAtBack) sendNodeToBack(ctx.data, ctx.bgNode);
    await this.writeCanvas(canvasFile, ctx.data);
    this.applyBackgroundDomState();
    new import_obsidian.Notice(`Timeline widened to ${width}px (legacy SVG \u2014 recreate timeline to preserve headers when widening).`);
  }
  /** Fully regenerate the SVG; keep background top-left fixed so cards stay put. */
  async rebuildTimelineSvg(canvasFile, ctx, settings) {
    const start = parseLocalDate(settings.start);
    const end = parseLocalDate(settings.end);
    if (!start || !end || end <= start) {
      new import_obsidian.Notice("Stored timeline dates are invalid; cannot rebuild.");
      return;
    }
    settings.columnCount = Math.max(1, Math.min(20, Math.floor(Number(settings.columnCount)) || 1));
    settings.columnTitles = normalizeColumnTitles(settings.columnTitles, settings.columnCount);
    settings.timelineWidth = Math.max(300, Math.floor(Number(settings.timelineWidth)) || 300);
    settings.title = (settings.title || "").trim();
    const marks = buildTimelineMarks(start, end, settings);
    if (marks.length < 1) {
      new import_obsidian.Notice("Could not rebuild timeline marks.");
      return;
    }
    const svg = buildSvg(marks, start, end, settings);
    await this.app.vault.modify(ctx.svgFile, svg);
    ctx.svgText = svg;
    await this.writeSidecarMeta(ctx.svgFile, settings);
    const intervalCount = settings.increment === "custom" ? Math.max(1, settings.customCount) : Math.max(1, marks.length - 1);
    const headerExtra = (settings.title ? 40 : 0) + (settings.columnCount > 1 || settings.columnTitles.some((t) => t) ? 36 : 0);
    const imageHeight = Math.max(600, intervalCount * settings.pixelsPerStep + 220 + headerExtra);
    ctx.bgNode.width = settings.timelineWidth;
    ctx.bgNode.height = imageHeight;
    ctx.bgNode.timelineSettings = serializeTimelineSettings(settings);
    markAsTimelineBackground(ctx.bgNode, this.settings.lockBackground);
    if (this.settings.keepBackgroundAtBack) sendNodeToBack(ctx.data, ctx.bgNode);
    await this.writeCanvas(canvasFile, ctx.data);
    this.applyBackgroundDomState();
  }
  async writeSidecarMeta(svgFile, settings) {
    const metaPath = (0, import_obsidian.normalizePath)(svgFile.path.replace(/\.svg$/i, ".timeline-meta.json"));
    const body = serializeTimelineSettings(settings);
    const existing = this.app.vault.getAbstractFileByPath(metaPath);
    if (existing instanceof import_obsidian.TFile) await this.app.vault.modify(existing, body);
    else await this.app.vault.create(metaPath, body);
  }
  async readSidecarMeta(svgFile) {
    const metaPath = (0, import_obsidian.normalizePath)(svgFile.path.replace(/\.svg$/i, ".timeline-meta.json"));
    const existing = this.app.vault.getAbstractFileByPath(metaPath);
    if (!(existing instanceof import_obsidian.TFile)) return null;
    try {
      return deserializeTimelineSettings(await this.app.vault.read(existing));
    } catch (e) {
      return null;
    }
  }
  async cropCanvas(canvasFile, data, bounds, buffer) {
    const pad2 = Math.max(0, Math.floor(buffer));
    const originX = bounds.minX - pad2;
    const originY = bounds.minY - pad2;
    const newW = Math.max(50, Math.ceil(bounds.maxX - bounds.minX + pad2 * 2));
    const newH = Math.max(50, Math.ceil(bounds.maxY - bounds.minY + pad2 * 2));
    for (const node of data.nodes) {
      node.x -= originX;
      node.y -= originY;
    }
    const bgNode = findBackgroundNode(data);
    if (bgNode == null ? void 0 : bgNode.file) {
      bgNode.x = 0;
      bgNode.y = 0;
      bgNode.width = newW;
      bgNode.height = newH;
      const svgFile = this.app.vault.getAbstractFileByPath(bgNode.file);
      if (svgFile instanceof import_obsidian.TFile && svgFile.extension === "svg") {
        const svgText = await this.app.vault.read(svgFile);
        const resized = resizeSvgFrame(svgText, newW, newH);
        await this.app.vault.modify(svgFile, resized);
      }
    }
    const bg = findBackgroundNode(data);
    if (bg) {
      markAsTimelineBackground(bg, this.settings.lockBackground);
      if (this.settings.keepBackgroundAtBack) sendNodeToBack(data, bg);
    }
    await this.writeCanvas(canvasFile, data);
    this.applyBackgroundDomState();
    new import_obsidian.Notice(`Cropped canvas to ${newW}\xD7${newH}px (${pad2}px buffer).`);
  }
  async sendBackgroundToBack(canvasFile) {
    var _a;
    try {
      const data = await this.readCanvas(canvasFile);
      const bg = findBackgroundNode(data);
      if (!bg) {
        new import_obsidian.Notice("No timeline SVG background found on this canvas.");
        return;
      }
      markAsTimelineBackground(bg, (_a = bg.timelineBackgroundLocked) != null ? _a : this.settings.lockBackground);
      sendNodeToBack(data, bg);
      await this.writeCanvas(canvasFile, data);
      this.applyBackgroundDomState();
      new import_obsidian.Notice("Timeline background sent to the back.");
    } catch (e) {
      new import_obsidian.Notice(e instanceof Error ? e.message : "Could not reorder background.");
    }
  }
  async toggleBackgroundLock(canvasFile) {
    try {
      const data = await this.readCanvas(canvasFile);
      const bg = findBackgroundNode(data);
      if (!bg) {
        new import_obsidian.Notice("No timeline SVG background found on this canvas.");
        return;
      }
      const next = !bg.timelineBackgroundLocked;
      markAsTimelineBackground(bg, next);
      if (this.settings.keepBackgroundAtBack) sendNodeToBack(data, bg);
      await this.writeCanvas(canvasFile, data);
      this.applyBackgroundDomState();
      new import_obsidian.Notice(next ? "Timeline background locked (not clickable)." : "Timeline background unlocked.");
    } catch (e) {
      new import_obsidian.Notice(e instanceof Error ? e.message : "Could not toggle background lock.");
    }
  }
  /**
   * Apply z-order / pointer-events on the live canvas DOM so the SVG stays
   * behind cards and optionally ignores clicks. Core Obsidian has no per-node lock.
   */
  applyBackgroundDomState() {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "canvas") return;
    void this.readCanvas(file).then((data) => {
      var _a, _b;
      const bg = findBackgroundNode(data);
      if (!(bg == null ? void 0 : bg.file)) return;
      const locked = (_a = bg.timelineBackgroundLocked) != null ? _a : this.settings.lockBackground;
      const svgName = bg.file.split("/").pop() || bg.file;
      for (const leaf of this.app.workspace.getLeavesOfType("canvas")) {
        const view = leaf.view;
        if (((_b = view.file) == null ? void 0 : _b.path) !== file.path || !view.containerEl) continue;
        const nodes = view.containerEl.querySelectorAll(".canvas-node");
        nodes.forEach((el) => {
          var _a2, _b2;
          const html = el;
          const media = html.querySelector("img, .media-embed, .image-embed");
          const src = (media == null ? void 0 : media.getAttribute("src")) || ((_a2 = media == null ? void 0 : media.querySelector("img")) == null ? void 0 : _a2.getAttribute("src")) || "";
          const label = ((_b2 = html.querySelector(".canvas-node-label")) == null ? void 0 : _b2.textContent) || "";
          const matches = src && (src.includes(encodeURIComponent(svgName)) || src.includes(svgName) || decodeURIComponent(src).includes(svgName)) || label.includes(svgName.replace(/\.svg$/i, ""));
          const isLikelyBg = matches || bg.id && html.getAttribute("data-node-id") === bg.id;
          if (!isLikelyBg && !matches) {
            return;
          }
          if (!matches && !isLikelyBg) return;
          html.classList.add("timeline-canvas-bg-node");
          html.style.zIndex = "0";
          if (locked) {
            html.classList.add("is-timeline-bg-locked");
            html.style.pointerEvents = "none";
          } else {
            html.classList.remove("is-timeline-bg-locked");
            html.style.pointerEvents = "";
          }
        });
        if (!view.containerEl.querySelector(".timeline-canvas-bg-node")) {
          let best = null;
          let bestArea = 0;
          view.containerEl.querySelectorAll(".canvas-node").forEach((el) => {
            const html = el;
            const area = html.offsetWidth * html.offsetHeight;
            if (area > bestArea) {
              bestArea = area;
              best = html;
            }
          });
          if (best) {
            best.classList.add("timeline-canvas-bg-node");
            best.style.zIndex = "0";
            if (locked) {
              best.classList.add("is-timeline-bg-locked");
              best.style.pointerEvents = "none";
            }
          }
        }
      }
    }).catch(() => {
    });
  }
  async ensureFolder(folder) {
    const parts = folder.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
    }
  }
  async uniquePath(path) {
    if (!this.app.vault.getAbstractFileByPath(path)) return path;
    const dot = path.lastIndexOf(".");
    const stem = dot >= 0 ? path.slice(0, dot) : path;
    const ext = dot >= 0 ? path.slice(dot) : "";
    let i = 2;
    while (this.app.vault.getAbstractFileByPath(`${stem} ${i}${ext}`)) i++;
    return `${stem} ${i}${ext}`;
  }
}
class TimelineModal extends import_obsidian.Modal {
  constructor(app, defaults, onSubmit) {
    super(app);
    __publicField(this, "settings");
    __publicField(this, "onSubmit");
    __publicField(this, "customSettingsEl");
    __publicField(this, "standardSettingsEl");
    __publicField(this, "columnTitlesEl");
    this.settings = { ...defaults };
    this.onSubmit = onSubmit;
  }
  onOpen() {
    this.modalEl.addClass("timeline-canvas-modal");
    this.titleEl.setText("Create timeline canvas");
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("timeline-modal-content");
    contentEl.createEl("div", {
      text: "Creates a vertical timeline as a Canvas image background. Your normal Canvas cards can then be placed over it."
    }).addClass("timeline-help");
    const formEl = contentEl.createDiv({ cls: "timeline-modal-scroll" });
    new import_obsidian.Setting(formEl).setName("Start date/time").addText((t) => t.setValue(this.settings.start).onChange((v) => this.settings.start = v));
    new import_obsidian.Setting(formEl).setName("End date/time").addText((t) => t.setValue(this.settings.end).onChange((v) => this.settings.end = v));
    new import_obsidian.Setting(formEl).setName("Increment").addDropdown((d) => d.addOptions({
      year: "Years",
      quarter: "Quarters",
      month: "Months",
      week: "Weeks",
      day: "Days",
      hour: "Hours",
      minute: "Minutes",
      custom: "Custom"
    }).setValue(this.settings.increment).onChange((v) => {
      this.settings.increment = v;
      this.updateMajorDefaults();
      this.updateIncrementFields();
    }));
    this.standardSettingsEl = formEl.createDiv({ cls: "timeline-increment-settings" });
    this.customSettingsEl = formEl.createDiv({ cls: "timeline-custom-settings" });
    this.renderIncrementFields();
    new import_obsidian.Setting(formEl).setName("Pixels between increments").setDesc("Vertical spacing in the generated timeline.").addText((t) => t.setValue(String(this.settings.pixelsPerStep)).onChange((v) => this.settings.pixelsPerStep = Math.max(20, Number(v) || 20)));
    new import_obsidian.Setting(formEl).setName("Timeline width").setDesc("Width of the generated background in Canvas pixels.").addText((t) => t.setValue(String(this.settings.timelineWidth)).onChange((v) => this.settings.timelineWidth = Math.max(300, Number(v) || 300)));
    new import_obsidian.Setting(formEl).setName("Label format").addDropdown((d) => d.addOptions({
      auto: "Automatic",
      year: "2022",
      month: "Jan",
      monthYear: "Jan 2022",
      date: "Jul 1, 2026",
      dateTime: "Jul 1, 08:00",
      time: "08:00"
    }).setValue(this.settings.labelFormat).onChange((v) => this.settings.labelFormat = v));
    new import_obsidian.Setting(formEl).setName("Major line every").setDesc("Use 0 for no separate major lines.").addText((t) => t.setValue(String(this.settings.majorEvery)).onChange((v) => this.settings.majorEvery = Math.max(0, Number(v) || 0)));
    new import_obsidian.Setting(formEl).setName("Show minor lines").addToggle((t) => t.setValue(this.settings.showMinor).onChange((v) => this.settings.showMinor = v));
    new import_obsidian.Setting(formEl).setName("Timeline title").setDesc("Optional title drawn at the top of the SVG background.").addText((t) => t.setPlaceholder("e.g. Family context 1800\u20132000").setValue(this.settings.title).onChange((v) => this.settings.title = v));
    new import_obsidian.Setting(formEl).setName("Columns").setDesc("Vertical bands for parallel timelines (e.g. General history | Family). You can change this later with \u201CEdit timeline columns and title\u201D.").addText((t) => t.setValue(String(this.settings.columnCount)).onChange((v) => {
      this.settings.columnCount = Math.max(1, Math.min(20, Math.floor(Number(v)) || 1));
      this.renderColumnTitleFields();
    }));
    this.columnTitlesEl = formEl.createDiv({ cls: "timeline-column-titles" });
    this.renderColumnTitleFields();
    const outputBlock = formEl.createDiv({ cls: "timeline-output-block" });
    outputBlock.createEl("div", { text: "Output folder", cls: "timeline-output-label" });
    outputBlock.createEl("div", {
      text: "Folder for the new Canvas file. Pre-filled from Settings \u2192 Timeline Canvas. Leave blank for the vault root. The SVG is saved to the default SVG folder from Settings (or here if that setting is empty). Missing folders are created automatically.",
      cls: "timeline-output-desc"
    });
    const folderRow = outputBlock.createDiv({ cls: "timeline-folder-row" });
    const folderInput = folderRow.createEl("input", {
      type: "text",
      cls: "timeline-output-folder",
      attr: { placeholder: "Vault root" }
    });
    folderInput.value = this.settings.outputFolder;
    folderInput.addEventListener("input", () => {
      this.settings.outputFolder = folderInput.value.trim();
    });
    const buttonRow = outputBlock.createDiv({ cls: "timeline-button-row" });
    const browseBtn = buttonRow.createEl("button", { text: "Browse" });
    browseBtn.addEventListener("click", () => {
      new FolderSuggestModal(this.app, (path) => {
        this.settings.outputFolder = path;
        folderInput.value = path;
      }).open();
    });
    const createBtn = buttonRow.createEl("button", { text: "Create timeline", cls: "mod-cta" });
    createBtn.addEventListener("click", () => {
      this.close();
      this.onSubmit({ ...this.settings });
    });
    const cancelBtn = buttonRow.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());
    const preview = formEl.createEl("div", { cls: "timeline-preview" });
    preview.setText("A new .canvas file will be created. The timeline is a scalable SVG image placed at the back of the Canvas.");
  }
  renderIncrementFields() {
    if (!this.standardSettingsEl || !this.customSettingsEl) return;
    this.standardSettingsEl.empty();
    this.customSettingsEl.empty();
    if (this.settings.increment === "custom") {
      this.customSettingsEl.show();
      this.standardSettingsEl.hide();
      new import_obsidian.Setting(this.customSettingsEl).setName("Custom increment name").setDesc("The word used for each generated label, such as Semester, Phase, or Chapter.").addText((t) => t.setValue(this.settings.customName).setPlaceholder("Semester").onChange((v) => this.settings.customName = v));
      new import_obsidian.Setting(this.customSettingsEl).setName("Number of occurrences").setDesc("How many equally spaced custom increments should appear across the date range.").addText((t) => t.setValue(String(this.settings.customCount)).onChange((v) => this.settings.customCount = Math.max(1, Math.floor(Number(v)) || 1)));
      this.customSettingsEl.createEl("div", {
        text: "Custom increments are evenly distributed across the selected date range and labeled \u201CName 1\u201D, \u201CName 2\u201D, etc. The start and end dates remain the timeline boundaries."
      }).addClass("timeline-custom-help");
    } else {
      this.customSettingsEl.hide();
      this.standardSettingsEl.show();
      new import_obsidian.Setting(this.standardSettingsEl).setName("Increment size").setDesc("For example, 1 month or 3 months.").addText((t) => t.setValue(String(this.settings.step)).onChange((v) => this.settings.step = Math.max(1, Math.floor(Number(v)) || 1)));
    }
  }
  updateIncrementFields() {
    this.renderIncrementFields();
  }
  updateMajorDefaults() {
    if (this.settings.increment === "custom") {
      this.settings.majorEvery = 0;
      return;
    }
    const map = { year: 5, quarter: 4, month: 12, week: 4, day: 7, hour: 6, minute: 15 };
    this.settings.majorEvery = map[this.settings.increment];
  }
  renderColumnTitleFields() {
    if (!this.columnTitlesEl) return;
    this.columnTitlesEl.empty();
    const count = Math.max(1, Math.min(20, this.settings.columnCount || 1));
    this.settings.columnCount = count;
    while (this.settings.columnTitles.length < count) this.settings.columnTitles.push("");
    this.settings.columnTitles = this.settings.columnTitles.slice(0, count);
    if (count <= 1) {
      this.columnTitlesEl.createEl("div", {
        text: "With 1 column there are no dividers. Increase Columns to split the background into parallel tracks.",
        cls: "timeline-custom-help"
      });
      return;
    }
    for (let i = 0; i < count; i++) {
      const idx = i;
      new import_obsidian.Setting(this.columnTitlesEl).setName(`Column ${idx + 1} title`).addText((t) => t.setPlaceholder(idx === 0 ? "e.g. General history" : idx === 1 ? "e.g. Family history" : `Column ${idx + 1}`).setValue(this.settings.columnTitles[idx] || "").onChange((v) => {
        this.settings.columnTitles[idx] = v;
      }));
    }
  }
}
class ColumnsModal extends import_obsidian.Modal {
  constructor(app, settings, onSubmit) {
    super(app);
    __publicField(this, "settings");
    __publicField(this, "onSubmit");
    __publicField(this, "titlesEl");
    this.settings = {
      ...settings,
      columnTitles: [...settings.columnTitles || []],
      title: settings.title || "",
      columnCount: Math.max(1, settings.columnCount || 1)
    };
    this.onSubmit = onSubmit;
  }
  onOpen() {
    this.modalEl.addClass("timeline-canvas-modal");
    this.titleEl.setText("Edit timeline columns and title");
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("p", {
      text: "Change the overall title, how many vertical columns the background has, and each column header. Time marks and vertical spacing are preserved. Canvas cards are not moved.",
      cls: "timeline-help"
    });
    new import_obsidian.Setting(contentEl).setName("Timeline title").addText((t) => t.setPlaceholder("Optional").setValue(this.settings.title).onChange((v) => {
      this.settings.title = v;
    }));
    new import_obsidian.Setting(contentEl).setName("Columns").setDesc("1\u201320. Reducing columns does not delete your cards; only the SVG grid changes.").addText((t) => t.setValue(String(this.settings.columnCount)).onChange((v) => {
      this.settings.columnCount = Math.max(1, Math.min(20, Math.floor(Number(v)) || 1));
      this.renderTitles();
    }));
    this.titlesEl = contentEl.createDiv({ cls: "timeline-column-titles" });
    this.renderTitles();
    new import_obsidian.Setting(contentEl).setName("Timeline width").setDesc("Optional: adjust width while editing columns.").addText((t) => t.setValue(String(this.settings.timelineWidth)).onChange((v) => {
      this.settings.timelineWidth = Math.max(300, Number(v) || 300);
    }));
    new import_obsidian.Setting(contentEl).addButton((b) => b.setButtonText("Apply").setCta().onClick(() => {
      this.settings.columnTitles = normalizeColumnTitles(this.settings.columnTitles, this.settings.columnCount);
      this.close();
      this.onSubmit({ ...this.settings, columnTitles: [...this.settings.columnTitles] });
    })).addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
  }
  renderTitles() {
    if (!this.titlesEl) return;
    this.titlesEl.empty();
    const count = this.settings.columnCount;
    while (this.settings.columnTitles.length < count) this.settings.columnTitles.push("");
    this.settings.columnTitles = this.settings.columnTitles.slice(0, count);
    for (let i = 0; i < count; i++) {
      const idx = i;
      new import_obsidian.Setting(this.titlesEl).setName(`Column ${idx + 1} title`).addText((t) => t.setValue(this.settings.columnTitles[idx] || "").onChange((v) => {
        this.settings.columnTitles[idx] = v;
      }));
    }
  }
  onClose() {
    this.contentEl.empty();
  }
}
class WidenModal extends import_obsidian.Modal {
  constructor(app, currentWidth, onSubmit) {
    super(app);
    __publicField(this, "currentWidth");
    __publicField(this, "onSubmit");
    __publicField(this, "value");
    this.currentWidth = Math.round(currentWidth);
    this.value = this.currentWidth;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    this.titleEl.setText("Widen timeline background");
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("p", {
      text: "Stretch the timeline SVG horizontally so horizontal grid lines span a wider area. Vertical spacing and labels stay the same \u2014 only width changes. Existing cards on the canvas are not moved.",
      cls: "timeline-help"
    });
    new import_obsidian.Setting(contentEl).setName("Current width").setDesc("Pixels").addText((t) => t.setValue(String(this.currentWidth)).setDisabled(true));
    new import_obsidian.Setting(contentEl).setName("New width").setDesc("Must be at least 300px. Try adding 400\u2013800 when you need another column of cards.").addText((t) => t.setValue(String(this.currentWidth + 600)).onChange((v) => {
      this.value = Math.max(300, Number(v) || 300);
    }));
    this.value = this.currentWidth + 600;
    new import_obsidian.Setting(contentEl).addButton((b) => b.setButtonText("Widen").setCta().onClick(() => {
      this.close();
      this.onSubmit(this.value);
    })).addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
  }
  onClose() {
    this.contentEl.empty();
  }
}
class CropModal extends import_obsidian.Modal {
  constructor(app, bounds, onSubmit) {
    super(app);
    __publicField(this, "bounds");
    __publicField(this, "onSubmit");
    __publicField(this, "buffer", 40);
    __publicField(this, "summaryEl");
    this.bounds = bounds;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    this.titleEl.setText("Crop canvas to content");
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("p", {
      text: "Shift all nodes so content sits near the origin and resize the timeline background to the content bounds plus a buffer. Useful before exporting to PDF.",
      cls: "timeline-help"
    });
    const b = this.bounds;
    contentEl.createEl("div", {
      text: `Content spans X ${Math.round(b.minX)} \u2192 ${Math.round(b.maxX)}  (${Math.round(b.width)}px wide), Y ${Math.round(b.minY)} \u2192 ${Math.round(b.maxY)}  (${Math.round(b.height)}px tall).`,
      cls: "timeline-output-desc"
    });
    new import_obsidian.Setting(contentEl).setName("Buffer around content").setDesc("Extra padding in pixels on every side.").addText((t) => t.setValue(String(this.buffer)).onChange((v) => {
      this.buffer = Math.max(0, Number(v) || 0);
      this.updateSummary();
    }));
    this.summaryEl = contentEl.createEl("div", { cls: "timeline-preview" });
    this.updateSummary();
    new import_obsidian.Setting(contentEl).addButton((b2) => b2.setButtonText("Crop").setCta().onClick(() => {
      this.close();
      this.onSubmit(this.buffer);
    })).addButton((b2) => b2.setButtonText("Cancel").onClick(() => this.close()));
  }
  updateSummary() {
    if (!this.summaryEl) return;
    const w = Math.max(50, Math.ceil(this.bounds.width + this.buffer * 2));
    const h = Math.max(50, Math.ceil(this.bounds.height + this.buffer * 2));
    this.summaryEl.setText(`Resulting frame: ${w} \xD7 ${h}px (content ${Math.round(this.bounds.width)} \xD7 ${Math.round(this.bounds.height)} + ${this.buffer}px buffer on each side).`);
  }
  onClose() {
    this.contentEl.empty();
  }
}
class TimelineSettingTab extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    __publicField(this, "plugin");
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Timeline Canvas" });
    containerEl.createEl("p", {
      text: "Default folders are used when creating a timeline. The create dialog still lets you pick a different Canvas folder for a single run.",
      cls: "setting-item-description"
    });
    this.addFolderSetting(
      "Default canvas folder",
      "New .canvas timeline files are created here by default. The create dialog is pre-filled with this path. Leave blank for the vault root.",
      "defaultCanvasFolder"
    );
    this.addFolderSetting(
      "Default SVG folder",
      "Generated timeline SVG images are saved here (for example your usual attachments folder). Leave blank to save the SVG next to the Canvas file.",
      "defaultSvgFolder"
    );
    containerEl.createEl("h3", { text: "Background behavior" });
    new import_obsidian.Setting(containerEl).setName("Keep timeline background at the back").setDesc("JSON Canvas stacks nodes in array order (first = back). When enabled, the timeline SVG is kept as the bottom-most node after plugin actions.").addToggle((t) => t.setValue(this.plugin.settings.keepBackgroundAtBack).onChange(async (v) => {
      this.plugin.settings.keepBackgroundAtBack = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Lock timeline background by default").setDesc("Obsidian cannot lock individual cards natively. When enabled, the timeline SVG gets pointer-events: none so it is not clickable or draggable \u2014 cards on top stay easy to select. Toggle per canvas with \u201CToggle lock timeline background\u201D.").addToggle((t) => t.setValue(this.plugin.settings.lockBackground).onChange(async (v) => {
      this.plugin.settings.lockBackground = v;
      await this.plugin.saveSettings();
    }));
  }
  addFolderSetting(name, desc, key) {
    const setting = new import_obsidian.Setting(this.containerEl).setName(name).setDesc(desc);
    setting.addText((t) => {
      t.setPlaceholder("Vault root").setValue(this.plugin.settings[key]).onChange(async (v) => {
        this.plugin.settings[key] = v.trim();
        await this.plugin.saveSettings();
      });
      t.inputEl.dataset.timelineSetting = key;
    });
    setting.addButton((b) => b.setButtonText("Browse").onClick(() => {
      new FolderSuggestModal(this.app, async (path) => {
        this.plugin.settings[key] = path;
        await this.plugin.saveSettings();
        const input = this.containerEl.querySelector(`input[data-timeline-setting="${key}"]`);
        if (input) input.value = path;
      }).open();
    }));
  }
}
class FolderSuggestModal extends import_obsidian.FuzzySuggestModal {
  constructor(app, onChoose) {
    super(app);
    __publicField(this, "folders");
    __publicField(this, "onChoose");
    this.onChoose = onChoose;
    this.folders = [null, ...collectFolders(app.vault.getRoot())];
    this.setPlaceholder("Choose a vault folder...");
  }
  getItems() {
    return this.folders;
  }
  getItemText(item) {
    return item ? item.path : "(Vault root)";
  }
  onChooseItem(item) {
    var _a;
    this.onChoose((_a = item == null ? void 0 : item.path) != null ? _a : "");
  }
}
function collectFolders(root) {
  const result = [];
  const visit = (folder) => {
    for (const child of folder.children) {
      if (child instanceof import_obsidian.TFolder) {
        result.push(child);
        visit(child);
      }
    }
  };
  visit(root);
  return result.sort((a, b) => a.path.localeCompare(b.path));
}
function parseLocalDate(value) {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
  return isNaN(d.getTime()) ? null : d;
}
function buildTimelineMarks(start, end, settings) {
  if (settings.increment === "custom") return generateCustomMarks(start, end, settings.customName, settings.customCount);
  const dates = generateDates(start, end, settings.increment, settings.step);
  return dates.map((date, index) => ({
    position: index / Math.max(1, dates.length - 1),
    label: formatDateLabel(date, settings.labelFormat, settings.increment),
    major: isMajor(index, date, settings)
  }));
}
function generateDates(start, end, unit, step) {
  var _a;
  const out = [];
  let current = new Date(start);
  while (current <= end) {
    out.push(new Date(current));
    current = add(current, unit, step);
    if (out.length > 20001) break;
  }
  if (((_a = out[out.length - 1]) == null ? void 0 : _a.getTime()) !== end.getTime()) out.push(new Date(end));
  return out;
}
function generateCustomMarks(start, end, name, count) {
  const marks = [];
  const safeCount = Math.max(1, Math.floor(count) || 1);
  for (let i = 0; i < safeCount; i++) {
    const position = (i + 0.5) / safeCount;
    marks.push({
      position,
      label: `${name} ${i + 1}`,
      major: true
    });
  }
  return marks;
}
function add(date, unit, amount) {
  const d = new Date(date);
  if (unit === "year") d.setFullYear(d.getFullYear() + amount);
  else if (unit === "quarter") d.setMonth(d.getMonth() + amount * 3);
  else if (unit === "month") d.setMonth(d.getMonth() + amount);
  else if (unit === "week") d.setDate(d.getDate() + amount * 7);
  else if (unit === "day") d.setDate(d.getDate() + amount);
  else if (unit === "hour") d.setHours(d.getHours() + amount);
  else d.setMinutes(d.getMinutes() + amount);
  return d;
}
function contentBounds(nodes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  if (!isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
function findBackgroundNode(data) {
  const marked = data.nodes.find((n) => n.timelineBackground && n.type === "file");
  if (marked) return marked;
  const svgNodes = data.nodes.filter((n) => n.type === "file" && typeof n.file === "string" && n.file.toLowerCase().endsWith(".svg"));
  if (!svgNodes.length) return null;
  svgNodes.sort((a, b) => b.width * b.height - a.width * a.height);
  return svgNodes[0];
}
function markAsTimelineBackground(node, locked) {
  node.timelineBackground = true;
  node.timelineBackgroundLocked = locked;
}
function sendNodeToBack(data, node) {
  data.nodes = [node, ...data.nodes.filter((n) => n.id !== node.id)];
}
function widenSvg(svgText, newWidth) {
  const width = Math.max(300, Math.floor(newWidth));
  const right = 40;
  const lineEnd = width - right;
  let out = svgText;
  out = out.replace(
    /<svg\b([^>]*)>/i,
    (_m, attrs) => {
      let a = attrs;
      a = a.replace(/\swidth="[^"]*"/i, ` width="${width}"`);
      a = a.replace(/\sviewBox="[^"]*"/i, (vb) => {
        var _a, _b, _c;
        const nums = (_b = (_a = vb.match(/viewBox="([^"]*)"/i)) == null ? void 0 : _a[1]) == null ? void 0 : _b.trim().split(/[\s,]+/);
        if (nums && nums.length === 4) {
          return ` viewBox="${nums[0]} ${nums[1]} ${width} ${nums[3]}"`;
        }
        return ` viewBox="0 0 ${width} ${(_c = nums == null ? void 0 : nums[3]) != null ? _c : 600}"`;
      });
      if (!/\swidth="/i.test(a)) a += ` width="${width}"`;
      if (!/\sviewBox="/i.test(a)) a += ` viewBox="0 0 ${width} 600"`;
      return `<svg${a}>`;
    }
  );
  out = out.replace(/<line\b([^>]*)\/?>/gi, (full, attrs) => {
    var _a, _b;
    const y1 = (_a = attrs.match(/\sy1="([^"]*)"/i)) == null ? void 0 : _a[1];
    const y2 = (_b = attrs.match(/\sy2="([^"]*)"/i)) == null ? void 0 : _b[1];
    if (y1 === void 0 || y2 === void 0 || y1 !== y2) return full;
    let a = attrs.replace(/\s*\/?$/, "");
    a = a.replace(/\sx2="[^"]*"/i, ` x2="${lineEnd}"`);
    if (!/\sx2="/i.test(a)) a += ` x2="${lineEnd}"`;
    return `<line${a}/>`;
  });
  return out;
}
function resizeSvgFrame(svgText, newWidth, newHeight) {
  var _a;
  const width = Math.max(50, Math.floor(newWidth));
  const height = Math.max(50, Math.floor(newHeight));
  const right = 40;
  const lineEnd = width - right;
  const vbMatch = svgText.match(/\sviewBox="([^"]*)"/i);
  const vb = (_a = vbMatch == null ? void 0 : vbMatch[1]) == null ? void 0 : _a.trim().split(/[\s,]+/).map(Number);
  const oldW = vb && vb.length === 4 && vb[2] > 0 ? vb[2] : width;
  const oldH = vb && vb.length === 4 && vb[3] > 0 ? vb[3] : height;
  const scaleY = oldH > 0 ? height / oldH : 1;
  let out = svgText;
  out = out.replace(
    /<svg\b([^>]*)>/i,
    (_m, attrs) => {
      let a = attrs;
      a = a.replace(/\swidth="[^"]*"/i, ` width="${width}"`);
      a = a.replace(/\sheight="[^"]*"/i, ` height="${height}"`);
      a = a.replace(/\sviewBox="[^"]*"/i, ` viewBox="0 0 ${width} ${height}"`);
      if (!/\swidth="/i.test(a)) a += ` width="${width}"`;
      if (!/\sheight="/i.test(a)) a += ` height="${height}"`;
      if (!/\sviewBox="/i.test(a)) a += ` viewBox="0 0 ${width} ${height}"`;
      return `<svg${a}>`;
    }
  );
  const scaleAttr = (attrs, names) => {
    let a = attrs;
    for (const name of names) {
      a = a.replace(new RegExp(`\\s${name}="([^"]*)"`, "i"), (_m, v) => {
        const num = Number(v);
        if (!isFinite(num)) return _m;
        return ` ${name}="${(num * scaleY).toFixed(2)}"`;
      });
    }
    return a;
  };
  out = out.replace(/<line\b([^>]*)\/?>/gi, (full, attrs) => {
    var _a2, _b;
    let a = scaleAttr(attrs, ["y1", "y2"]);
    const y1 = (_a2 = a.match(/\sy1="([^"]*)"/i)) == null ? void 0 : _a2[1];
    const y2 = (_b = a.match(/\sy2="([^"]*)"/i)) == null ? void 0 : _b[1];
    if (y1 !== void 0 && y1 === y2) {
      a = a.replace(/\sx2="[^"]*"/i, ` x2="${lineEnd}"`);
    }
    return `<line${a}/>`;
  });
  out = out.replace(/<text\b([^>]*)>/gi, (_m, attrs) => {
    return `<text${scaleAttr(attrs, ["y"])}>`;
  });
  return out;
}
function normalizeColumnTitles(titles, count) {
  const n = Math.max(1, Math.min(20, count || 1));
  const src = titles ? [...titles] : [];
  while (src.length < n) src.push("");
  return src.slice(0, n).map((t) => (t || "").trim());
}
const META_PREFIX = "timeline-canvas-meta:";
function serializeTimelineSettings(settings) {
  const payload = {
    ...settings,
    columnCount: Math.max(1, Math.min(20, settings.columnCount || 1)),
    columnTitles: normalizeColumnTitles(settings.columnTitles, settings.columnCount || 1),
    title: (settings.title || "").trim()
  };
  return JSON.stringify(payload);
}
function deserializeTimelineSettings(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    const data = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...data,
      columnCount: Math.max(1, Math.min(20, Number(data.columnCount) || 1)),
      columnTitles: normalizeColumnTitles(data.columnTitles, Number(data.columnCount) || 1),
      title: typeof data.title === "string" ? data.title : "",
      timelineWidth: Math.max(300, Number(data.timelineWidth) || DEFAULTS.timelineWidth)
    };
  } catch (e) {
    return null;
  }
}
function encodeSettingsBase64(settings) {
  const json = serializeTimelineSettings(settings);
  return typeof btoa === "function" ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, "utf8").toString("base64");
}
function decodeSettingsBase64(b64) {
  try {
    const json = typeof atob === "function" ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, "base64").toString("utf8");
    return deserializeTimelineSettings(json);
  } catch (e) {
    return null;
  }
}
function parseTimelineMeta(svgText) {
  const dataAttr = svgText.match(/\bdata-timeline-settings="([A-Za-z0-9+/=]+)"/);
  if (dataAttr) {
    const parsed = decodeSettingsBase64(dataAttr[1]);
    if (parsed) return parsed;
  }
  const reB64 = new RegExp(`<!--\\s*${META_PREFIX}([A-Za-z0-9+/=]+)\\s*-->`);
  const mb = svgText.match(reB64);
  if (mb) {
    const parsed = decodeSettingsBase64(mb[1]);
    if (parsed) return parsed;
  }
  const reLegacy = new RegExp(`<!--\\s*${META_PREFIX}([\\s\\S]*?)-->`);
  const m = svgText.match(reLegacy);
  if (!m) return null;
  try {
    const raw = m[1].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
    return deserializeTimelineSettings(raw);
  } catch (e) {
    return null;
  }
}
function resolveTimelineSettings(ctx) {
  return parseTimelineMeta(ctx.svgText) || deserializeTimelineSettings(ctx.bgNode.timelineSettings) || null;
}
function buildSvg(marks, start, end, s) {
  const left = 180;
  const right = 40;
  const width = Math.max(300, s.timelineWidth);
  const columns = Math.max(1, Math.min(20, s.columnCount || 1));
  const titles = normalizeColumnTitles(s.columnTitles, columns);
  const hasTitle = !!(s.title && s.title.trim());
  const headerBand = (hasTitle ? 44 : 0) + (columns > 1 || titles.some((t) => t) ? 36 : 0);
  const intervalCount = s.increment === "custom" ? Math.max(1, s.customCount) : Math.max(1, marks.length - 1);
  const height = Math.max(600, intervalCount * s.pixelsPerStep + 180 + headerBand);
  const lineX = left;
  const lineEnd = width - right;
  const labelX = 20;
  const parts = [];
  const metaB64 = encodeSettingsBase64(s);
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-timeline-settings="${metaB64}">`);
  parts.push(`<!-- ${META_PREFIX}${metaB64} -->`);
  if (s.backgroundColor !== "transparent") parts.push(`<rect width="100%" height="100%" fill="${escapeXml(s.backgroundColor)}"/>`);
  let cursorY = 28;
  if (hasTitle) {
    parts.push(`<text x="${width / 2}" y="${cursorY}" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="26" font-weight="700" fill="${escapeXml(s.labelColor)}">${escapeXml(s.title.trim())}</text>`);
    cursorY += 36;
  }
  const contentTop = 50 + headerBand;
  const top = contentTop;
  const bottom = height - 90;
  const yFor = (position) => top + position * (bottom - top);
  const colWidth = Math.max(40, (lineEnd - lineX) / columns);
  if (columns > 1 || titles.some((t) => t)) {
    const headerY = hasTitle ? 58 : 32;
    for (let i = 0; i < columns; i++) {
      const cx = lineX + colWidth * (i + 0.5);
      const title = titles[i] || "";
      if (title) {
        parts.push(`<text x="${cx.toFixed(2)}" y="${headerY}" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="18" font-weight="600" fill="${escapeXml(s.labelColor)}">${escapeXml(title)}</text>`);
      }
      if (i > 0) {
        const dx = lineX + colWidth * i;
        parts.push(`<line x1="${dx.toFixed(2)}" y1="${top - 24}" x2="${dx.toFixed(2)}" y2="${bottom + 20}" stroke="${escapeXml(s.majorLineColor)}" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.7"/>`);
      }
    }
  }
  parts.push(`<line x1="${lineX}" y1="${top}" x2="${lineEnd}" y2="${top}" stroke="${escapeXml(s.majorLineColor)}" stroke-width="2.5" opacity="0.9"/>`);
  parts.push(`<line x1="${lineX}" y1="${bottom}" x2="${lineEnd}" y2="${bottom}" stroke="${escapeXml(s.majorLineColor)}" stroke-width="2.5" opacity="0.9"/>`);
  parts.push(`<text x="${labelX}" y="${top + 6}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="20" font-weight="600" fill="${escapeXml(s.labelColor)}">${escapeXml(formatBoundaryLabel(start, s.labelFormat, s.increment))}</text>`);
  parts.push(`<text x="${labelX}" y="${bottom + 6}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="20" font-weight="600" fill="${escapeXml(s.labelColor)}">${escapeXml(formatBoundaryLabel(end, s.labelFormat, s.increment))}</text>`);
  for (const mark of marks) {
    const y = yFor(mark.position);
    const major = mark.major;
    const lineWidth = major ? 2.5 : 1;
    const color = major ? s.majorLineColor : s.lineColor;
    if (s.showMinor || major) {
      parts.push(`<line x1="${lineX}" y1="${y.toFixed(2)}" x2="${lineEnd}" y2="${y.toFixed(2)}" stroke="${escapeXml(color)}" stroke-width="${lineWidth}" opacity="${major ? 0.9 : 0.55}"/>`);
    }
    parts.push(`<text x="${labelX}" y="${(y + 6).toFixed(2)}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="${major ? 20 : 16}" font-weight="${major ? 600 : 400}" fill="${escapeXml(s.labelColor)}">${escapeXml(mark.label)}</text>`);
  }
  parts.push("</svg>");
  return parts.join("");
}
function isMajor(index, date, s) {
  if (index === 0) return true;
  if (s.majorEvery <= 0) return false;
  if (s.majorUnit === s.increment) return index % s.majorEvery === 0;
  if (s.majorUnit === "year") return date.getMonth() === 0 && date.getDate() === 1;
  if (s.majorUnit === "quarter") return [0, 3, 6, 9].includes(date.getMonth()) && date.getDate() === 1;
  if (s.majorUnit === "month") return date.getDate() === 1;
  if (s.majorUnit === "week") return date.getDay() === 0;
  if (s.majorUnit === "day") return date.getHours() === 0;
  return date.getMinutes() === 0;
}
function formatBoundaryLabel(date, format, increment) {
  if (increment === "custom" && format === "auto") return `${monthName(date.getMonth())} ${date.getFullYear()}`;
  return formatDateLabel(date, format, increment);
}
function formatDateLabel(date, format, increment) {
  const auto = increment === "year" ? "year" : increment === "quarter" || increment === "month" ? "monthYear" : increment === "week" || increment === "day" ? "date" : increment === "hour" ? "dateTime" : "time";
  const f = format === "auto" ? auto : format;
  if (f === "year") return String(date.getFullYear());
  if (f === "month") return monthName(date.getMonth());
  if (f === "monthYear") return `${monthName(date.getMonth())} ${date.getFullYear()}`;
  if (f === "date") return `${monthName(date.getMonth())} ${date.getDate()}, ${date.getFullYear()}`;
  if (f === "dateTime") return `${monthName(date.getMonth())} ${date.getDate()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function monthName(month) {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month];
}
function formatFileDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function pad(n) {
  return String(n).padStart(2, "0");
}
function randomId() {
  return Math.random().toString(36).slice(2, 10);
}
function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
