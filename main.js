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
  outputFolder: ""
};
const DEFAULT_PLUGIN_SETTINGS = {
  defaultCanvasFolder: "",
  defaultSvgFolder: ""
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
    this.addRibbonIcon("calendar-range", "Create timeline canvas", () => this.openTimelineModal());
    this.addSettingTab(new TimelineSettingTab(this.app, this));
  }
  async loadSettings() {
    const data = await this.loadData();
    this.settings = { ...DEFAULT_PLUGIN_SETTINGS };
    if (data) {
      if (typeof data.defaultCanvasFolder === "string") this.settings.defaultCanvasFolder = data.defaultCanvasFolder;
      if (typeof data.defaultSvgFolder === "string") this.settings.defaultSvgFolder = data.defaultSvgFolder;
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
    const svg = buildSvg(marks, start, end, settings);
    await this.app.vault.create(svgPath, svg);
    const intervalCount = settings.increment === "custom" ? Math.max(1, settings.customCount) : Math.max(1, marks.length - 1);
    const imageHeight = Math.max(600, intervalCount * settings.pixelsPerStep + 220);
    const canvas = {
      nodes: [{
        id: randomId(),
        type: "file",
        x: 0,
        y: 0,
        width: settings.timelineWidth,
        height: imageHeight,
        file: svgPath
      }],
      edges: []
    };
    await this.app.vault.create(canvasPath, JSON.stringify(canvas, null, 2));
    const file = this.app.vault.getAbstractFileByPath(canvasPath);
    if (file instanceof import_obsidian.TFile) await this.app.workspace.getLeaf(true).openFile(file);
    const description = settings.increment === "custom" ? `${settings.customCount} ${settings.customName.toLowerCase()}` : `${marks.length - 1} increments`;
    new import_obsidian.Notice(`Created timeline with ${description}.`);
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
function buildSvg(marks, start, end, s) {
  const left = 180;
  const right = 40;
  const width = s.timelineWidth;
  const intervalCount = s.increment === "custom" ? Math.max(1, s.customCount) : Math.max(1, marks.length - 1);
  const height = Math.max(600, intervalCount * s.pixelsPerStep + 180);
  const lineX = left;
  const lineEnd = width - right;
  const labelX = 20;
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  if (s.backgroundColor !== "transparent") parts.push(`<rect width="100%" height="100%" fill="${escapeXml(s.backgroundColor)}"/>`);
  const top = 90;
  const bottom = height - 90;
  const yFor = (position) => top + position * (bottom - top);
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
