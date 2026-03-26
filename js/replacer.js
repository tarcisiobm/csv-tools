class Replacer {
  constructor() {
    this.fileInput = document.getElementById('replacer-file');
    this.columnsSection = document.getElementById('replacer-columns');
    this.searchInput = document.getElementById('replacer-search');
    this.checkboxList = document.getElementById('replacer-checkbox-list');
    this.valuesSection = document.getElementById('replacer-values');
    this.valuesList = document.getElementById('replacer-values-list');
    this.applyBtn = document.getElementById('replacer-apply');
    this.resultsArea = document.getElementById('replacer-results');
    this.previewArea = document.getElementById('replacer-previews');
    this.downloadBtn = document.getElementById('replacer-download');

    this.parsed = null;
    this.replacedCsv = null;
    this.replacedFilename = '';

    this.bindEvents();
  }

  bindEvents() {
    this.fileInput.addEventListener('change', () => this.onFileLoad());
    this.searchInput.addEventListener('input', () => this.filterCheckboxes());
    document.getElementById('replacer-confirm-cols').addEventListener('click', () => this.confirmColumns());
    this.applyBtn.addEventListener('click', () => this.apply());
    this.downloadBtn.addEventListener('click', () => this.download());
  }

  // ── File Loading ─────────────────────────────────────────────────

  async onFileLoad() {
    Csv.clearPreviewData();
    this.columnsSection.classList.add('hidden');
    this.valuesSection.classList.add('hidden');
    this.resultsArea.innerHTML = '';
    this.previewArea.innerHTML = '';
    this.downloadBtn.classList.add('hidden');
    this.parsed = null;

    if (!this.fileInput.files[0]) {
      return;
    }

    this.parsed = await Csv.loadFile(this.fileInput.files[0]);

    if (!this.parsed.headers.length) {
      this.resultsArea.innerHTML = '<div class="status-bar fail">File is empty or has no valid header.</div>';
      return;
    }

    this.renderColumnCheckboxes();
    this.columnsSection.classList.remove('hidden');

    this.previewArea.innerHTML = '<div class="preview-grid single">' +
      Csv.buildPreviewTable(this.parsed.headers, this.parsed.rows, {
        title: this.parsed.name, tag: 'INPUT', tagClass: 'tag-base', maxRows: 30
      }) + '</div>';
  }

  // ── Column Selection ─────────────────────────────────────────────

  filterCheckboxes() {
    const query = this.searchInput.value.toLowerCase();
    this.checkboxList.querySelectorAll('label').forEach(label => {
      label.style.display = label.textContent.toLowerCase().includes(query) ? '' : 'none';
    });
  }

  confirmColumns() {
    const selected = [...this.checkboxList.querySelectorAll('input:checked')].map(checkbox => checkbox.value);

    if (!selected.length) {
      this.resultsArea.innerHTML = '<div class="status-bar fail">No columns selected.</div>';
      return;
    }

    this.valuesList.className = 'values-grid';
    this.valuesList.innerHTML = selected.sort().map(header =>
      `<label>${Csv.escapeHtml(header)}</label>` +
      `<input type="text" data-column="${Csv.escapeHtml(header)}" placeholder="new value (empty = clear)">`
    ).join('');

    this.valuesSection.classList.remove('hidden');
    this.resultsArea.innerHTML = '';
  }

  // ── Actions ──────────────────────────────────────────────────────

  apply() {
    if (!this.parsed) {
      return;
    }
    Csv.clearPreviewData();
    this.downloadBtn.classList.add('hidden');

    const substitutions = {};
    this.valuesList.querySelectorAll('input').forEach(input => {
      substitutions[input.dataset.column] = input.value;
    });

    const columnIndex = Csv.indexHeaders(this.parsed.headers);

    const newRows = this.parsed.rows.map(row => {
      const copy = [...row];
      for (const [header, newValue] of Object.entries(substitutions)) {
        const colIdx = columnIndex[header];
        if (colIdx !== undefined && colIdx < copy.length) {
          copy[colIdx] = newValue;
        }
      }
      return copy;
    });

    const colCount = Object.keys(substitutions).length;
    const highlights = Object.fromEntries(Object.keys(substitutions).map(header => [header, 'col-added']));

    this.resultsArea.innerHTML =
      `<div class="status-bar info">Replaced ${colCount} column(s) × ${this.parsed.rows.length} rows.</div>`;

    this.previewArea.innerHTML = '<div class="preview-grid">' +
      Csv.buildPreviewTable(this.parsed.headers, this.parsed.rows, {
        title: this.parsed.name, tag: 'BEFORE', tagClass: 'tag-target', maxRows: 30, highlightCols: highlights
      }) +
      Csv.buildPreviewTable(this.parsed.headers, newRows, {
        title: 'Modified result', tag: 'AFTER', tagClass: 'tag-output', maxRows: 30, highlightCols: highlights
      }) +
      '</div>';

    this.replacedCsv = Csv.generate(this.parsed.headers, newRows, this.parsed.delimiter);
    this.replacedFilename = Csv.outputName(this.parsed.name, 'replaced');
    this.downloadBtn.classList.remove('hidden');
  }

  download() {
    if (this.replacedCsv) {
      Csv.download(this.replacedCsv, this.replacedFilename);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  renderColumnCheckboxes() {
    const sorted = this.parsed.headers.slice().sort();
    this.checkboxList.innerHTML = sorted.map(header =>
      `<label class="checkbox-item"><input type="checkbox" value="${Csv.escapeHtml(header)}"> ${Csv.escapeHtml(header)}</label>`
    ).join('');

    this.searchInput.classList.toggle('hidden', this.parsed.headers.length <= 25);
    this.searchInput.value = '';
  }
}
