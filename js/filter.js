class Filter {
  constructor() {
    this.fileInput = document.getElementById('filter-file');
    this.configSection = document.getElementById('filter-config');
    this.conditionsContainer = document.getElementById('filter-conditions');
    this.runBtn = document.getElementById('filter-run');
    this.resultsArea = document.getElementById('filter-results');
    this.previewArea = document.getElementById('filter-previews');
    this.downloadBtn = document.getElementById('filter-download');

    this.parsed = null;
    this.filteredCsv = null;
    this.filteredFilename = '';

    this.bindEvents();
  }

  bindEvents() {
    this.fileInput.addEventListener('change', () => this.onFileLoad());
    document.getElementById('filter-add-condition').addEventListener('click', () => this.addConditionRow('AND'));
    document.getElementById('filter-add-or').addEventListener('click', () => this.addConditionRow('OR'));
    this.runBtn.addEventListener('click', () => this.run());
    this.downloadBtn.addEventListener('click', () => this.download());

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.cond-column-picker')) {
        this.closeAllDropdowns();
      }
    });
  }

  // ── File Loading ─────────────────────────────────────────────────

  async onFileLoad() {
    Csv.clearPreviewData();
    this.configSection.classList.add('hidden');
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

    this.sortedHeaders = this.parsed.headers.slice().sort();
    this.conditionsContainer.innerHTML = '';
    this.addConditionRow();
    this.configSection.classList.remove('hidden');

    this.previewArea.innerHTML = '<div class="preview-grid single">' +
      Csv.buildPreviewTable(this.parsed.headers, this.parsed.rows, {
        title: this.parsed.name, tag: 'INPUT', tagClass: 'tag-base', maxRows: 30
      }) + '</div>';
  }

  // ── Condition Management ─────────────────────────────────────────

  addConditionRow(connector) {
    const row = document.createElement('div');
    row.className = 'condition-row';

    const isFirst = this.conditionsContainer.children.length === 0;
    const keyword = isFirst ? 'WHERE' : (connector || 'AND');

    let html = `<span class="condition-keyword">${keyword}</span>`;
    html += '<div class="cond-column-picker">';
    html += '<input type="text" class="cond-column" placeholder="column" readonly>';
    html += '<div class="cond-column-dropdown hidden">';
    html += '<input type="text" class="cond-column-search" placeholder="search...">';
    html += '<div class="cond-column-list"></div>';
    html += '</div></div>';
    html += `<select class="cond-operator">
      <option value="==">==</option>
      <option value="!=">!=</option>
    </select>`;
    html += '<input type="text" class="cond-value" placeholder="value">';
    html += '<label class="cond-case-label"><input type="checkbox" class="cond-case"> Aa</label>';

    if (!isFirst) {
      html += '<button class="remove-condition" title="Remove">×</button>';
    }

    row.innerHTML = html;
    this.conditionsContainer.appendChild(row);
    this.setupColumnPicker(row);

    const removeBtn = row.querySelector('.remove-condition');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        row.remove();
        const firstRow = this.conditionsContainer.querySelector('.condition-row');
        if (firstRow) {
          firstRow.querySelector('.condition-keyword').textContent = 'WHERE';
        }
      });
    }
  }

  setupColumnPicker(row) {
    const input = row.querySelector('.cond-column');
    const dropdown = row.querySelector('.cond-column-dropdown');
    const search = row.querySelector('.cond-column-search');
    const list = row.querySelector('.cond-column-list');

    const renderList = (query) => {
      const queryLower = query ? query.toLowerCase() : '';
      const filtered = queryLower
        ? this.sortedHeaders.filter(header => header.toLowerCase().includes(queryLower))
        : this.sortedHeaders;
      list.innerHTML = filtered.map(header =>
        `<div class="cond-column-option" data-value="${Csv.escapeHtml(header)}">${Csv.escapeHtml(header)}</div>`
      ).join('');
    };

    renderList('');
    input.value = this.sortedHeaders[0] || '';

    input.addEventListener('click', () => {
      this.closeAllDropdowns();
      search.value = '';
      renderList('');
      dropdown.classList.remove('hidden');
      search.focus();
    });

    search.addEventListener('input', () => {
      renderList(search.value);
    });

    list.addEventListener('click', (event) => {
      const option = event.target.closest('.cond-column-option');
      if (!option) {
        return;
      }
      input.value = option.dataset.value;
      dropdown.classList.add('hidden');
    });
  }

  closeAllDropdowns() {
    this.conditionsContainer.querySelectorAll('.cond-column-dropdown').forEach(dropdown => {
      dropdown.classList.add('hidden');
    });
  }

  // ── Actions ──────────────────────────────────────────────────────

  run() {
    if (!this.parsed) {
      return;
    }
    Csv.clearPreviewData();
    this.downloadBtn.classList.add('hidden');

    const conditions = this.readConditions();
    if (!conditions.length) {
      return;
    }

    const filtered = this.applyFilter(conditions);
    const keptCount = filtered.length;
    const removedCount = this.parsed.rows.length - keptCount;

    this.resultsArea.innerHTML =
      `<div class="status-bar info">WHERE ${Csv.escapeHtml(this.formatExpression(conditions))}</div>` +
      '<div class="stats-row">' +
      `<span>Total: <strong>${this.parsed.rows.length}</strong></span>` +
      `<span>Kept: <strong style="color:var(--green)">${keptCount}</strong></span>` +
      `<span>Removed: <strong style="color:var(--red)">${removedCount}</strong></span>` +
      '</div>';

    this.previewArea.innerHTML = '<div class="preview-grid">' +
      Csv.buildPreviewTable(this.parsed.headers, this.parsed.rows, {
        title: this.parsed.name, tag: 'BEFORE', tagClass: 'tag-target', maxRows: 30
      }) +
      Csv.buildPreviewTable(this.parsed.headers, filtered, {
        title: 'Filtered result', tag: 'AFTER', tagClass: 'tag-output', maxRows: 30
      }) +
      '</div>';

    this.filteredCsv = Csv.generate(this.parsed.headers, filtered, this.parsed.delimiter);
    this.filteredFilename = Csv.outputName(this.parsed.name, 'filtered');
    this.downloadBtn.classList.remove('hidden');
  }

  download() {
    if (this.filteredCsv) {
      Csv.download(this.filteredCsv, this.filteredFilename);
    }
  }

  // ── Filter Logic ─────────────────────────────────────────────────

  readConditions() {
    const rows = this.conditionsContainer.querySelectorAll('.condition-row');
    const conditions = [];

    rows.forEach(row => {
      conditions.push({
        connector: row.querySelector('.condition-keyword').textContent,
        column: row.querySelector('.cond-column').value,
        operator: row.querySelector('.cond-operator').value,
        value: row.querySelector('.cond-value').value,
        caseSensitive: row.querySelector('.cond-case').checked,
      });
    });

    return conditions;
  }

  applyFilter(conditions) {
    const groups = [];
    let currentGroup = [];

    for (const cond of conditions) {
      if (cond.connector === 'OR' && currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      currentGroup.push(cond);
    }
    if (currentGroup.length) {
      groups.push(currentGroup);
    }

    const columnIndex = Csv.indexHeaders(this.parsed.headers);

    const resolvedGroups = groups.map(group =>
      group.map(cond => ({
        colIndex: columnIndex[cond.column] ?? -1,
        operator: cond.operator,
        target: cond.caseSensitive ? cond.value : cond.value.toLowerCase(),
        caseSensitive: cond.caseSensitive,
      }))
    );

    return this.parsed.rows.filter(row =>
      resolvedGroups.some(group =>
        group.every(({ colIndex, operator, target, caseSensitive }) => {
          if (colIndex === -1 || colIndex >= row.length) {
            return false;
          }
          const cell = caseSensitive ? row[colIndex].trim() : row[colIndex].trim().toLowerCase();
          return operator === '==' ? cell === target : cell !== target;
        })
      )
    );
  }

  formatExpression(conditions) {
    return conditions.map(cond => {
      const prefix = cond.connector === 'WHERE' ? '' : ` ${cond.connector} `;
      return `${prefix}${cond.column} ${cond.operator} "${cond.value}"`;
    }).join('');
  }
}
