"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
const DEFAULTS = {
    start: '2022-01-01',
    end: '2023-01-01',
    increment: 'month',
    step: 1,
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
    outputFolder: 'Timeline Assets'
};
class TimelineCanvasPlugin extends obsidian_1.Plugin {
    async onload() {
        this.addCommand({
            id: 'create-timeline-canvas',
            name: 'Create timeline canvas',
            callback: () => new TimelineModal(this.app, DEFAULTS, (settings) => this.createTimeline(settings)).open()
        });
        this.addRibbonIcon('calendar-range', 'Create timeline canvas', () => {
            new TimelineModal(this.app, DEFAULTS, (settings) => this.createTimeline(settings)).open();
        });
    }
    async createTimeline(settings) {
        const start = parseLocalDate(settings.start);
        const end = parseLocalDate(settings.end);
        if (!start || !end || end <= start) {
            new obsidian_1.Notice('Timeline end must be after the start.');
            return;
        }
        const dates = generateDates(start, end, settings.increment, settings.step);
        if (dates.length < 2) {
            new obsidian_1.Notice('The selected range does not contain enough increments.');
            return;
        }
        if (dates.length > 20000) {
            new obsidian_1.Notice('That would create more than 20,000 timeline marks. Please use a larger increment.');
            return;
        }
        const folder = (0, obsidian_1.normalizePath)(settings.outputFolder.trim() || 'Timeline Assets');
        await this.ensureFolder(folder);
        const base = `Timeline ${formatFileDate(start)}–${formatFileDate(end)}`;
        const canvasPath = await this.uniquePath(`${base}.canvas`);
        const svgPath = await this.uniquePath(`${folder}/${base}.svg`);
        const svg = buildSvg(dates, settings);
        await this.app.vault.create(svgPath, svg);
        const imageHeight = Math.max(600, (dates.length - 1) * settings.pixelsPerStep + 220);
        const imageX = 0;
        const imageY = 0;
        const canvas = {
            nodes: [
                {
                    id: randomId(),
                    type: 'file',
                    x: imageX,
                    y: imageY,
                    width: settings.timelineWidth,
                    height: imageHeight,
                    file: svgPath
                }
            ],
            edges: []
        };
        await this.app.vault.create(canvasPath, JSON.stringify(canvas, null, 2));
        const file = this.app.vault.getAbstractFileByPath(canvasPath);
        if (file instanceof obsidian_1.TFile) {
            await this.app.workspace.getLeaf(true).openFile(file);
        }
        new obsidian_1.Notice(`Created timeline with ${dates.length - 1} increments.`);
    }
    async ensureFolder(folder) {
        const parts = folder.split('/');
        let current = '';
        for (const part of parts) {
            current = current ? `${current}/${part}` : part;
            if (!this.app.vault.getAbstractFileByPath(current)) {
                await this.app.vault.createFolder(current);
            }
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
        contentEl.createEl('div', { text: 'Creates a vertical timeline as a Canvas image background. Your normal Canvas cards can then be placed over it.' }).addClass('timeline-help');
        new obsidian_1.Setting(contentEl).setName('Start date/time').addText(t => t.setValue(this.settings.start).onChange((v) => this.settings.start = v));
        new obsidian_1.Setting(contentEl).setName('End date/time').addText(t => t.setValue(this.settings.end).onChange((v) => this.settings.end = v));
        new obsidian_1.Setting(contentEl).setName('Increment').addDropdown(d => d
            .addOptions({ year: 'Years', quarter: 'Quarters', month: 'Months', week: 'Weeks', day: 'Days', hour: 'Hours', minute: 'Minutes' })
            .setValue(this.settings.increment)
            .onChange((v) => { this.settings.increment = v; this.updateMajorDefaults(); }));
        new obsidian_1.Setting(contentEl).setName('Increment size').setDesc('For example, 1 month or 3 months.')
            .addText(t => t.setValue(String(this.settings.step)).onChange((v) => this.settings.step = Math.max(1, Number(v) || 1)));
        new obsidian_1.Setting(contentEl).setName('Pixels between increments').setDesc('Vertical spacing in the generated timeline.')
            .addText(t => t.setValue(String(this.settings.pixelsPerStep)).onChange((v) => this.settings.pixelsPerStep = Math.max(20, Number(v) || 20)));
        new obsidian_1.Setting(contentEl).setName('Timeline width').setDesc('Width of the generated background in Canvas pixels.')
            .addText(t => t.setValue(String(this.settings.timelineWidth)).onChange((v) => this.settings.timelineWidth = Math.max(300, Number(v) || 300)));
        new obsidian_1.Setting(contentEl).setName('Label format').addDropdown(d => d
            .addOptions({ auto: 'Automatic', year: '2022', month: 'Jan', monthYear: 'Jan 2022', date: 'Jul 1, 2026', dateTime: 'Jul 1, 08:00', time: '08:00' })
            .setValue(this.settings.labelFormat)
            .onChange((v) => this.settings.labelFormat = v));
        new obsidian_1.Setting(contentEl).setName('Major line every').setDesc('Use 0 for no separate major lines.')
            .addText(t => t.setValue(String(this.settings.majorEvery)).onChange((v) => this.settings.majorEvery = Math.max(0, Number(v) || 0)));
        new obsidian_1.Setting(contentEl).setName('Show minor lines').addToggle(t => t.setValue(this.settings.showMinor).onChange((v) => this.settings.showMinor = v));
        new obsidian_1.Setting(contentEl).setName('Output folder').setDesc('The SVG background is stored here.')
            .addText(t => t.setValue(this.settings.outputFolder).onChange((v) => this.settings.outputFolder = v));
        const preview = contentEl.createEl('div', { cls: 'timeline-preview' });
        preview.setText('A new .canvas file will be created. The timeline is a scalable SVG image placed at the back of the Canvas.');
        new obsidian_1.Setting(contentEl).addButton(b => b.setButtonText('Create timeline').setCta().onClick(() => {
            this.close();
            this.onSubmit({ ...this.settings });
        })).addButton(b => b.setButtonText('Cancel').onClick(() => this.close()));
    }
    updateMajorDefaults() {
        const map = { year: 5, quarter: 4, month: 12, week: 4, day: 7, hour: 6, minute: 15 };
        this.settings.majorEvery = map[this.settings.increment];
    }
}
function parseLocalDate(value) {
    const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m)
        return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
    return isNaN(d.getTime()) ? null : d;
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
function buildSvg(dates, s) {
    const left = 180;
    const right = 40;
    const width = s.timelineWidth;
    const height = Math.max(600, (dates.length - 1) * s.pixelsPerStep + 180);
    const lineX = left;
    const lineEnd = width - right;
    const labelX = 20;
    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
    if (s.backgroundColor !== 'transparent')
        parts.push(`<rect width="100%" height="100%" fill="${escapeXml(s.backgroundColor)}"/>`);
    const total = dates.length - 1;
    for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const y = 90 + (i / total) * (height - 180);
        const major = isMajor(i, date, s);
        const lineWidth = major ? 2.5 : 1;
        const color = major ? s.majorLineColor : s.lineColor;
        if (s.showMinor || major || i === 0 || i === dates.length - 1) {
            parts.push(`<line x1="${lineX}" y1="${y.toFixed(2)}" x2="${lineEnd}" y2="${y.toFixed(2)}" stroke="${escapeXml(color)}" stroke-width="${lineWidth}" opacity="${major ? 0.9 : 0.55}"/>`);
        }
        parts.push(`<text x="${labelX}" y="${(y + 6).toFixed(2)}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="${major ? 20 : 16}" font-weight="${major ? 600 : 400}" fill="${escapeXml(s.labelColor)}">${escapeXml(formatDateLabel(date, s.labelFormat, s.increment))}</text>`);
    }
    parts.push('</svg>');
    return parts.join('');
}
function isMajor(index, date, s) {
    if (index === 0 || index === 0 || index === 999999)
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
function formatDateLabel(date, format, increment) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const auto = increment === 'year' ? 'year' : increment === 'quarter' || increment === 'month' ? 'monthYear' : increment === 'week' || increment === 'day' ? 'date' : increment === 'hour' ? 'dateTime' : 'time';
    const f = format === 'auto' ? auto : format;
    if (f === 'year')
        return String(date.getFullYear());
    if (f === 'month')
        return months[date.getMonth()];
    if (f === 'monthYear')
        return `${months[date.getMonth()]} ${date.getFullYear()}`;
    if (f === 'date')
        return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    if (f === 'dateTime')
        return `${months[date.getMonth()]} ${date.getDate()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function formatFileDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function pad(n) { return String(n).padStart(2, '0'); }
function randomId() { return Math.random().toString(36).slice(2, 10); }
function escapeXml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
