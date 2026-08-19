"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
const DEFAULTS = {
    start: '2022-01-01',
    end: '2023-01-01',
    increment: 'month',
    step: 1,
    customName: 'Period',
    customCount: 4,
    pixelsPerStep: 140,
    timelineWidth: 1800,
    labelFormat: 'auto',
    majorEvery: 12,
    majorUnit: 'month',
    lineColor: '#8b8b8b',
    majorLineColor: '#555555',
    labelColor: '#555555',
    backgroundColor: 'transparent',
    showMinor: true,
    outputFolder: ''
};
class TimelineCanvasPlugin extends obsidian_1.Plugin {
    constructor() {
        super(...arguments);
        this.savedOutputFolder = '';
    }
    async onload() {
        const data = await this.loadData();
        this.savedOutputFolder = typeof (data === null || data === void 0 ? void 0 : data.outputFolder) === 'string' ? data.outputFolder : '';
        this.addCommand({
            id: 'create-timeline-canvas',
            name: 'Create timeline canvas',
            callback: () => this.openTimelineModal()
        });
        this.addRibbonIcon('calendar-range', 'Create timeline canvas', () => this.openTimelineModal());
    }
    openTimelineModal() {
        const defaults = { ...DEFAULTS, outputFolder: this.savedOutputFolder };
        new TimelineModal(this.app, defaults, (settings) => this.createTimeline(settings)).open();
    }
    async createTimeline(settings) {
        const start = parseLocalDate(settings.start);
        const end = parseLocalDate(settings.end);
        if (!start || !end || end <= start) {
            new obsidian_1.Notice('Timeline end must be after the start.');
            return;
        }
        if (settings.increment === 'custom') {
            settings.customName = settings.customName.trim() || 'Period';
            settings.customCount = Math.max(1, Math.floor(settings.customCount) || 1);
        }
        else {
            settings.step = Math.max(1, Math.floor(settings.step) || 1);
        }
        const marks = buildTimelineMarks(start, end, settings);
        if (marks.length < 1) {
            new obsidian_1.Notice('The selected range does not contain enough increments.');
            return;
        }
        if (marks.length > 20000) {
            new obsidian_1.Notice('That would create more than 20,000 timeline marks. Please use a larger increment.');
            return;
        }
        const folder = (0, obsidian_1.normalizePath)(settings.outputFolder.trim());
        if (folder)
            await this.ensureFolder(folder);
        this.savedOutputFolder = folder;
        await this.saveData({ outputFolder: folder });
        const base = `Timeline ${formatFileDate(start)}–${formatFileDate(end)}`;
        const canvasPath = await this.uniquePath(`${folder ? folder + '/' : ''}${base}.canvas`);
        const svgPath = await this.uniquePath(`${folder ? folder + '/' : ''}${base}.svg`);
        const svg = buildSvg(marks, start, end, settings);
        await this.app.vault.create(svgPath, svg);
        const intervalCount = settings.increment === 'custom'
            ? Math.max(1, settings.customCount)
            : Math.max(1, marks.length - 1);
        const imageHeight = Math.max(600, intervalCount * settings.pixelsPerStep + 220);
        const canvas = {
            nodes: [{
                    id: randomId(),
                    type: 'file',
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
        if (file instanceof obsidian_1.TFile)
            await this.app.workspace.getLeaf(true).openFile(file);
        const description = settings.increment === 'custom'
            ? `${settings.customCount} ${settings.customName.toLowerCase()}`
            : `${marks.length - 1} increments`;
        new obsidian_1.Notice(`Created timeline with ${description}.`);
    }
    async ensureFolder(folder) {
        const parts = folder.split('/');
        let current = '';
        for (const part of parts) {
            current = current ? `${current}/${part}` : part;
            if (!this.app.vault.getAbstractFileByPath(current))
                await this.app.vault.createFolder(current);
        }
    }
    async uniquePath(path) {
        if (!this.app.vault.getAbstractFileByPath(path))
            return path;
        const dot = path.lastIndexOf('.');
        const stem = dot >= 0 ? path.slice(0, dot) : path;
        const ext = dot >= 0 ? path.slice(dot) : '';
        let i = 2;
        while (this.app.vault.getAbstractFileByPath(`${stem} ${i}${ext}`))
            i++;
        return `${stem} ${i}${ext}`;
    }
}
exports.default = TimelineCanvasPlugin;
class TimelineModal extends obsidian_1.Modal {
    constructor(app, defaults, onSubmit) {
        super(app);
        this.settings = { ...defaults };
        this.onSubmit = onSubmit;
    }
    onOpen() {
        this.modalEl.addClass('timeline-canvas-modal');
        this.titleEl.setText('Create timeline canvas');
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('timeline-modal-content');
        contentEl.createEl('div', {
            text: 'Creates a vertical timeline as a Canvas image background. Your normal Canvas cards can then be placed over it. (v0.3.6)'
        }).addClass('timeline-help');
        // Keep the settings in their own scrollable region. The action buttons
        // live outside that region so they remain visible on smaller screens.
        const formEl = contentEl.createDiv({ cls: 'timeline-modal-scroll' });
        new obsidian_1.Setting(formEl)
            .setName('Start date/time')
            .addText(t => t.setValue(this.settings.start).onChange(v => this.settings.start = v));
        new obsidian_1.Setting(formEl)
            .setName('End date/time')
            .addText(t => t.setValue(this.settings.end).onChange(v => this.settings.end = v));
        new obsidian_1.Setting(formEl)
            .setName('Increment')
            .addDropdown(d => d
            .addOptions({
            year: 'Years', quarter: 'Quarters', month: 'Months', week: 'Weeks',
            day: 'Days', hour: 'Hours', minute: 'Minutes', custom: 'Custom'
        })
            .setValue(this.settings.increment)
            .onChange(v => {
            this.settings.increment = v;
            this.updateMajorDefaults();
            this.updateIncrementFields();
        }));
        this.standardSettingsEl = formEl.createDiv({ cls: 'timeline-increment-settings' });
        this.customSettingsEl = formEl.createDiv({ cls: 'timeline-custom-settings' });
        this.renderIncrementFields();
        new obsidian_1.Setting(formEl)
            .setName('Pixels between increments')
            .setDesc('Vertical spacing in the generated timeline.')
            .addText(t => t.setValue(String(this.settings.pixelsPerStep)).onChange(v => this.settings.pixelsPerStep = Math.max(20, Number(v) || 20)));
        new obsidian_1.Setting(formEl)
            .setName('Timeline width')
            .setDesc('Width of the generated background in Canvas pixels.')
            .addText(t => t.setValue(String(this.settings.timelineWidth)).onChange(v => this.settings.timelineWidth = Math.max(300, Number(v) || 300)));
        new obsidian_1.Setting(formEl)
            .setName('Label format')
            .addDropdown(d => d
            .addOptions({
            auto: 'Automatic', year: '2022', month: 'Jan', monthYear: 'Jan 2022',
            date: 'Jul 1, 2026', dateTime: 'Jul 1, 08:00', time: '08:00'
        })
            .setValue(this.settings.labelFormat)
            .onChange(v => this.settings.labelFormat = v));
        new obsidian_1.Setting(formEl)
            .setName('Major line every')
            .setDesc('Use 0 for no separate major lines.')
            .addText(t => t.setValue(String(this.settings.majorEvery)).onChange(v => this.settings.majorEvery = Math.max(0, Number(v) || 0)));
        new obsidian_1.Setting(formEl)
            .setName('Show minor lines')
            .addToggle(t => t.setValue(this.settings.showMinor).onChange(v => this.settings.showMinor = v));
        // Output folder + actions are stacked vertically so controls are never
        // clipped off the right edge of the modal.
        const outputBlock = formEl.createDiv({ cls: 'timeline-output-block' });
        outputBlock.createEl('div', { text: 'Output folder', cls: 'timeline-output-label' });
        outputBlock.createEl('div', {
            text: 'Folder within your vault where the Canvas and SVG will be created. Leave blank for the vault root. Examples: Timelines or Projects/History/Timelines. Missing folders will be created automatically.',
            cls: 'timeline-output-desc'
        });
        const folderRow = outputBlock.createDiv({ cls: 'timeline-folder-row' });
        const folderInput = folderRow.createEl('input', {
            type: 'text',
            cls: 'timeline-output-folder',
            attr: { placeholder: 'Vault root' }
        });
        folderInput.value = this.settings.outputFolder;
        folderInput.addEventListener('input', () => {
            this.settings.outputFolder = folderInput.value.trim();
        });
        const buttonRow = outputBlock.createDiv({ cls: 'timeline-button-row' });
        const browseBtn = buttonRow.createEl('button', { text: 'Browse' });
        browseBtn.addEventListener('click', () => {
            new FolderSuggestModal(this.app, path => {
                this.settings.outputFolder = path;
                folderInput.value = path;
            }).open();
        });
        const createBtn = buttonRow.createEl('button', { text: 'Create timeline', cls: 'mod-cta' });
        createBtn.addEventListener('click', () => {
            this.close();
            this.onSubmit({ ...this.settings });
        });
        const cancelBtn = buttonRow.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());
        const preview = formEl.createEl('div', { cls: 'timeline-preview' });
        preview.setText('A new .canvas file will be created. The timeline is a scalable SVG image placed at the back of the Canvas.');
    }
    renderIncrementFields() {
        if (!this.standardSettingsEl || !this.customSettingsEl)
            return;
        this.standardSettingsEl.empty();
        this.customSettingsEl.empty();
        if (this.settings.increment === 'custom') {
            this.customSettingsEl.show();
            this.standardSettingsEl.hide();
            new obsidian_1.Setting(this.customSettingsEl)
                .setName('Custom increment name')
                .setDesc('The word used for each generated label, such as Semester, Phase, or Chapter.')
                .addText(t => t
                .setValue(this.settings.customName)
                .setPlaceholder('Semester')
                .onChange(v => this.settings.customName = v));
            new obsidian_1.Setting(this.customSettingsEl)
                .setName('Number of occurrences')
                .setDesc('How many equally spaced custom increments should appear across the date range.')
                .addText(t => t
                .setValue(String(this.settings.customCount))
                .onChange(v => this.settings.customCount = Math.max(1, Math.floor(Number(v)) || 1)));
            this.customSettingsEl.createEl('div', {
                text: 'Custom increments are evenly distributed across the selected date range and labeled “Name 1”, “Name 2”, etc. The start and end dates remain the timeline boundaries.'
            }).addClass('timeline-custom-help');
        }
        else {
            this.customSettingsEl.hide();
            this.standardSettingsEl.show();
            new obsidian_1.Setting(this.standardSettingsEl)
                .setName('Increment size')
                .setDesc('For example, 1 month or 3 months.')
                .addText(t => t
                .setValue(String(this.settings.step))
                .onChange(v => this.settings.step = Math.max(1, Math.floor(Number(v)) || 1)));
        }
    }
    updateIncrementFields() {
        this.renderIncrementFields();
    }
    updateMajorDefaults() {
        if (this.settings.increment === 'custom') {
            this.settings.majorEvery = 0;
            return;
        }
        const map = { year: 5, quarter: 4, month: 12, week: 4, day: 7, hour: 6, minute: 15 };
        this.settings.majorEvery = map[this.settings.increment];
    }
}
class FolderSuggestModal extends obsidian_1.FuzzySuggestModal {
    constructor(app, onChoose) {
        super(app);
        this.onChoose = onChoose;
        this.folders = [null, ...collectFolders(app.vault.getRoot())];
        this.setPlaceholder('Choose a vault folder...');
    }
    getItems() { return this.folders; }
    getItemText(item) { return item ? item.path : '(Vault root)'; }
    onChooseItem(item) { var _a; this.onChoose((_a = item === null || item === void 0 ? void 0 : item.path) !== null && _a !== void 0 ? _a : ''); }
}
function collectFolders(root) {
    const result = [];
    const visit = (folder) => {
        for (const child of folder.children) {
            if (child instanceof obsidian_1.TFolder) {
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
    if (!m)
        return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
    return isNaN(d.getTime()) ? null : d;
}
function buildTimelineMarks(start, end, settings) {
    if (settings.increment === 'custom')
        return generateCustomMarks(start, end, settings.customName, settings.customCount);
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
        if (out.length > 20001)
            break;
    }
    if (((_a = out[out.length - 1]) === null || _a === void 0 ? void 0 : _a.getTime()) !== end.getTime())
        out.push(new Date(end));
    return out;
}
function generateCustomMarks(start, end, name, count) {
    const marks = [];
    const safeCount = Math.max(1, Math.floor(count) || 1);
    // Custom increments represent named periods. Their labels are centered in
    // equal portions of the requested date range; the start/end dates remain
    // the outer timeline boundaries.
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
    if (unit === 'year')
        d.setFullYear(d.getFullYear() + amount);
    else if (unit === 'quarter')
        d.setMonth(d.getMonth() + amount * 3);
    else if (unit === 'month')
        d.setMonth(d.getMonth() + amount);
    else if (unit === 'week')
        d.setDate(d.getDate() + amount * 7);
    else if (unit === 'day')
        d.setDate(d.getDate() + amount);
    else if (unit === 'hour')
        d.setHours(d.getHours() + amount);
    else
        d.setMinutes(d.getMinutes() + amount);
    return d;
}
function buildSvg(marks, start, end, s) {
    const left = 180;
    const right = 40;
    const width = s.timelineWidth;
    const intervalCount = s.increment === 'custom' ? Math.max(1, s.customCount) : Math.max(1, marks.length - 1);
    const height = Math.max(600, intervalCount * s.pixelsPerStep + 180);
    const lineX = left;
    const lineEnd = width - right;
    const labelX = 20;
    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
    if (s.backgroundColor !== 'transparent')
        parts.push(`<rect width="100%" height="100%" fill="${escapeXml(s.backgroundColor)}"/>`);
    const top = 90;
    const bottom = height - 90;
    const yFor = (position) => top + position * (bottom - top);
    // Always draw the actual date-range boundaries.
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
    parts.push('</svg>');
    return parts.join('');
}
function isMajor(index, date, s) {
    if (index === 0)
        return true;
    if (s.majorEvery <= 0)
        return false;
    if (s.majorUnit === s.increment)
        return index % s.majorEvery === 0;
    if (s.majorUnit === 'year')
        return date.getMonth() === 0 && date.getDate() === 1;
    if (s.majorUnit === 'quarter')
        return [0, 3, 6, 9].includes(date.getMonth()) && date.getDate() === 1;
    if (s.majorUnit === 'month')
        return date.getDate() === 1;
    if (s.majorUnit === 'week')
        return date.getDay() === 0;
    if (s.majorUnit === 'day')
        return date.getHours() === 0;
    return date.getMinutes() === 0;
}
function formatBoundaryLabel(date, format, increment) {
    if (increment === 'custom' && format === 'auto')
        return `${monthName(date.getMonth())} ${date.getFullYear()}`;
    return formatDateLabel(date, format, increment);
}
function formatDateLabel(date, format, increment) {
    const auto = increment === 'year' ? 'year' : increment === 'quarter' || increment === 'month' ? 'monthYear' : increment === 'week' || increment === 'day' ? 'date' : increment === 'hour' ? 'dateTime' : 'time';
    const f = format === 'auto' ? auto : format;
    if (f === 'year')
        return String(date.getFullYear());
    if (f === 'month')
        return monthName(date.getMonth());
    if (f === 'monthYear')
        return `${monthName(date.getMonth())} ${date.getFullYear()}`;
    if (f === 'date')
        return `${monthName(date.getMonth())} ${date.getDate()}, ${date.getFullYear()}`;
    if (f === 'dateTime')
        return `${monthName(date.getMonth())} ${date.getDate()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function monthName(month) {
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month];
}
function formatFileDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function pad(n) { return String(n).padStart(2, '0'); }
function randomId() { return Math.random().toString(36).slice(2, 10); }
function escapeXml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
