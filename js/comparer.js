class Comparer {
  constructor() {
    this.modelInput = document.getElementById('comparer-model');
    this.dataInput = document.getElementById('comparer-data');
    this.compareBtn = document.getElementById('comparer-run');
    this.previewArea = document.getElementById('comparer-previews');
    this.diffArea = document.getElementById('comparer-diff');
    this.fixSection = document.getElementById('comparer-fix-section');
    this.fixBtn = document.getElementById('comparer-fix');
    this.downloadBtn = document.getElementById('comparer-download');
    this.outputArea = document.getElementById('comparer-output');

    this.model = null;
    this.data = null;
    this.missingCols = [];
    this.extraCols = [];

    this.bindEvents();
  }

  bindEvents() {
    this.modelInput.addEventListener('change', () => this.loadModel());
    this.dataInput.addEventListener('change', () => this.loadData());
    this.compareBtn.addEventListener('click', () => this.compare());
    this.fixBtn.addEventListener('click', () => this.fix());
  }

  async loadModel() {
    if (!this.modelInput.files[0]) {
      return;
    }
    this.model = await Csv.loadFile(this.modelInput.files[0]);
    this.resetResults();
    this.renderPreviews();
  }

  async loadData() {
    if (!this.dataInput.files[0]) {
      return;
    }
    this.data = await Csv.loadFile(this.dataInput.files[0]);
    this.resetResults();
    this.renderPreviews();
  }

  // ── Actions ──────────────────────────────────────────────────────

  compare() {
    this.resetResults();

    if (!this.model || !this.data) {
      this.diffArea.innerHTML = '<div class="status-bar fail">Upload both files first.</div>';
      return;
    }

    const modelHeaders = new Set(this.model.headers);
    const dataHeaders = new Set(this.data.headers);
    this.missingCols = this.model.headers.filter(header => !dataHeaders.has(header));
    this.extraCols = this.data.headers.filter(header => !modelHeaders.has(header));

    if (!this.missingCols.length && !this.extraCols.length) {
      this.diffArea.innerHTML = '<div class="status-bar pass">PASS — Headers match. File is conforming.</div>';
      this.renderPreviews();
      return;
    }

    this.fixSection.classList.remove('hidden');

    this.diffArea.innerHTML =
      '<div class="status-bar fail">FAIL — Headers do not match.</div>' +
      this.buildDiffList('Missing in target', this.missingCols, 'missing', '−') +
      this.buildDiffList('Extra in target', this.extraCols, 'extra', '+');

    const modelHighlights = Object.fromEntries(this.missingCols.map(header => [header, 'col-missing']));
    const dataHighlights = Object.fromEntries(this.extraCols.map(header => [header, 'col-extra']));

    this.previewArea.innerHTML = '<div class="preview-grid">' +
      Csv.buildPreviewTable(this.model.headers, this.model.rows, {
        title: this.model.name, tag: 'BASE', tagClass: 'tag-base', maxRows: 30, highlightCols: modelHighlights
      }) +
      Csv.buildPreviewTable(this.data.headers, this.data.rows, {
        title: this.data.name, tag: 'TARGET', tagClass: 'tag-target', maxRows: 30, highlightCols: dataHighlights
      }) + '</div>';
  }

  fix() {
    if (!this.model || !this.data) {
      return;
    }

    const columnIndex = Csv.indexHeaders(this.data.headers);

    const correctedRows = this.data.rows.map(row =>
      this.model.headers.map(header =>
        header in columnIndex && columnIndex[header] < row.length ? row[columnIndex[header]] : ''
      )
    );

    const csvOutput = Csv.generate(this.model.headers, correctedRows, this.data.delimiter);
    const outputName = Csv.outputName(this.data.name, 'corrected');

    const addedHighlights = Object.fromEntries(this.missingCols.map(header => [header, 'col-added']));

    this.outputArea.innerHTML =
      `<div style="margin-top:1rem">` +
      `<div class="status-bar info">Corrected: ${this.missingCols.length} column(s) added (empty), ${this.extraCols.length} column(s) removed.</div>` +
      Csv.buildPreviewTable(this.model.headers, correctedRows, {
        title: outputName, tag: 'OUTPUT', tagClass: 'tag-output', maxRows: 30, highlightCols: addedHighlights
      }) + '</div>';

    this.downloadBtn.classList.remove('hidden');
    this.downloadBtn.onclick = () => Csv.download(csvOutput, outputName);
  }

  // ── Helpers ──────────────────────────────────────────────────────

  resetResults() {
    Csv.clearPreviewData();
    this.fixSection.classList.add('hidden');
    this.downloadBtn.classList.add('hidden');
    this.missingCols = [];
    this.extraCols = [];
    this.diffArea.innerHTML = '';
    this.outputArea.innerHTML = '';
  }

  renderPreviews() {
    let html = '<div class="preview-grid">';
    if (this.model) {
      html += Csv.buildPreviewTable(this.model.headers, this.model.rows, {
        title: this.model.name, tag: 'BASE', tagClass: 'tag-base', maxRows: 30
      });
    }
    if (this.data) {
      html += Csv.buildPreviewTable(this.data.headers, this.data.rows, {
        title: this.data.name, tag: 'TARGET', tagClass: 'tag-target', maxRows: 30
      });
    }
    html += '</div>';
    this.previewArea.innerHTML = html;
  }

  buildDiffList(title, items, className, prefix) {
    if (!items.length) {
      return '';
    }
    return `<div class="diff-list">` +
      `<div class="diff-list-header">${title} (${items.length})</div>` +
      '<div class="diff-list-scroll">' +
      items.map(header =>
        `<div class="diff-item ${className}"><span class="prefix">${prefix}</span><span>${Csv.escapeHtml(header)}</span></div>`
      ).join('') +
      '</div></div>';
  }
}
