document.addEventListener('DOMContentLoaded', () => {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const toolSections = document.querySelectorAll('.tool-section');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      tabButtons.forEach(btn => btn.classList.remove('active'));
      toolSections.forEach(section => section.classList.add('hidden'));
      button.classList.add('active');
      document.getElementById(button.dataset.target).classList.remove('hidden');
    });
  });

  fetch('app-version.json')
    .then(response => response.json())
    .then(data => {
      document.getElementById('app-version').textContent = 'v' + data.version;
    })
    .catch(() => {});

  document.querySelectorAll('.file-input-wrapper input[type="file"]').forEach(input => {
    input.addEventListener('change', () => {
      const nameLabel = input.parentElement.querySelector('.file-name');
      nameLabel.textContent = input.files[0] ? input.files[0].name : 'No file selected';
    });
  });

  // Preview expand modal
  document.addEventListener('click', (event) => {
    const expandBtn = event.target.closest('.expand-btn');
    if (expandBtn) {
      Csv.openPreviewModal(Number(expandBtn.dataset.previewId));
      return;
    }

    if (event.target.closest('.modal-close') || event.target.closest('.modal-backdrop')) {
      Csv.closePreviewModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      Csv.closePreviewModal();
    }
  });

  new Comparer();
  new Filter();
  new Replacer();
});
