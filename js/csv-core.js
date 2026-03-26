class Csv {

  // ── Parsing ────────────────────────────────────────────────────────

  static detectDelimiter(text) {
    const newlinePos = text.indexOf('\n');
    const firstLine = newlinePos === -1 ? text : text.substring(0, newlinePos);

    let bestDelimiter = ',';
    let highestCount = -1;

    for (const candidate of [';', ',', '\t', '|']) {
      const count = firstLine.split(candidate).length - 1;
      if (count <= highestCount) {
        continue;
      }
      highestCount = count;
      bestDelimiter = candidate;
    }

    return bestDelimiter;
  }

  static parse(text) {
    const delimiter = Csv.detectDelimiter(text);
    const lines = Csv.splitLines(text);
    const rows = lines.map(line => Csv.parseFields(line, delimiter));
    const headers = (rows.shift() || []).map(header => header.trim());
    return { headers, rows, delimiter };
  }

  static splitLines(text) {
    const lines = [];
    let current = '';
    let insideQuotes = false;

    for (let pos = 0; pos < text.length; pos++) {
      const char = text[pos];

      if (char === '"') {
        insideQuotes = !insideQuotes;
        current += char;
        continue;
      }

      if ((char === '\n' || char === '\r') && !insideQuotes) {
        if (char === '\r' && text[pos + 1] === '\n') {
          pos++;
        }
        if (current.length) {
          lines.push(current);
        }
        current = '';
        continue;
      }

      current += char;
    }

    if (current.length) {
      lines.push(current);
    }
    return lines;
  }

  static parseFields(line, delimiter) {
    const fields = [];
    let current = '';
    let insideQuotes = false;

    for (let pos = 0; pos < line.length; pos++) {
      const char = line[pos];

      if (insideQuotes) {
        if (char === '"' && line[pos + 1] === '"') {
          current += '"';
          pos++;
          continue;
        }
        if (char === '"') {
          insideQuotes = false;
          continue;
        }
        current += char;
        continue;
      }

      if (char === '"') {
        insideQuotes = true;
        continue;
      }
      if (char === delimiter) {
        fields.push(current);
        current = '';
        continue;
      }
      current += char;
    }

    fields.push(current);
    return fields;
  }

  // ── Generation & I/O ──────────────────────────────────────────────

  static generate(headers, rows, delimiter) {
    const quoteField = value => {
      const str = String(value);
      if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };
    return [headers, ...rows].map(row => row.map(quoteField).join(delimiter)).join('\n');
  }

  static async loadFile(file) {
    const text = await file.text();
    const parsed = Csv.parse(text);
    parsed.name = file.name;
    return parsed;
  }

  static download(csvString, filename) {
    const url = URL.createObjectURL(new Blob([csvString], { type: 'text/csv;charset=utf-8;' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: filename });
    link.click();
    URL.revokeObjectURL(url);
  }

  // ── Helpers ────────────────────────────────────────────────────────

  static timestamp() {
    const now = new Date();
    const pad = num => String(num).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  static baseName(filename) {
    return filename.replace(/\.csv$/i, '');
  }

  static escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  static formatInfo(title, rows, headers) {
    return `${title} — ${rows.length} rows, ${headers.length} cols`;
  }

  static outputName(filename, suffix) {
    return `${Csv.baseName(filename)}_${suffix}_${Csv.timestamp()}.csv`;
  }

  static indexHeaders(headers) {
    return Object.fromEntries(headers.map((header, index) => [header, index]));
  }

  // ── Preview Table ─────────────────────────────────────────────────

  static _previewCounter = 0;
  static _previewData = {};

  static clearPreviewData() {
    Csv._previewData = {};
  }

  static buildTableHtml(headers, rows, highlights = {}) {
    const colClasses = headers.map(header => highlights[header] ? ` class="${highlights[header]}"` : '');

    const headerCells = headers.map((header, col) =>
      `<th${colClasses[col]}>${Csv.escapeHtml(header)}</th>`
    ).join('');

    const bodyHtml = rows.map((row, rowIndex) => {
      const numCell = `<td class="row-num">${rowIndex + 1}</td>`;
      const cells = headers.map((_, col) => {
        const value = row[col] !== undefined ? row[col] : '';
        return `<td${colClasses[col]}>${Csv.escapeHtml(value)}</td>`;
      }).join('');
      return `<tr>${numCell}${cells}</tr>`;
    }).join('');

    return `<table class="csv-table">` +
      `<tr><th class="row-num">#</th>${headerCells}</tr>${bodyHtml}` +
      `</table>`;
  }

  static buildPreviewTable(headers, rows, options = {}) {
    const maxRows = options.maxRows || 50;
    const highlights = options.highlightCols || {};
    const visibleRows = rows.slice(0, maxRows);

    const previewId = Csv._previewCounter++;
    Csv._previewData[previewId] = { headers, rows, highlights, title: options.title || 'Preview' };

    const tableHtml = Csv.buildTableHtml(headers, visibleRows, highlights);

    const tag = options.tag
      ? `<span class="tag ${options.tagClass || ''}">${Csv.escapeHtml(options.tag)}</span>`
      : '';

    const expandBtn = `<button class="expand-btn" data-preview-id="${previewId}">expand</button>`;

    const footer = rows.length > maxRows
      ? `<div class="csv-preview-footer">Showing ${maxRows} of ${rows.length} rows</div>`
      : '';

    const info = Csv.formatInfo(Csv.escapeHtml(options.title || 'Preview'), rows, headers);

    return `<div class="csv-preview-container">` +
      `<div class="csv-preview-header"><span>${info}</span><div class="preview-actions">${expandBtn}${tag}</div></div>` +
      `<div class="csv-preview-scroll">${tableHtml}</div>${footer}</div>`;
  }

  static openPreviewModal(previewId) {
    const data = Csv._previewData[previewId];
    if (!data) {
      return;
    }

    const modal = document.getElementById('preview-modal');
    const title = modal.querySelector('.modal-title');
    const body = modal.querySelector('.modal-body');

    title.textContent = Csv.formatInfo(data.title, data.rows, data.headers);
    body.innerHTML = Csv.buildTableHtml(data.headers, data.rows, data.highlights);

    modal.classList.remove('hidden');
  }

  static closePreviewModal() {
    const modal = document.getElementById('preview-modal');
    modal.classList.add('hidden');
    modal.querySelector('.modal-body').innerHTML = '';
  }
}
