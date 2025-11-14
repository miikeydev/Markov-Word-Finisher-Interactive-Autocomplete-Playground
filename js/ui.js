const elements = {
  input: document.getElementById('input-prefix'),
  ghost: document.getElementById('ghost-overlay'),
  suggestions: document.getElementById('suggestions-container'),
  emptyMessage: document.getElementById('no-suggestion-message'),
  clearButton: document.getElementById('clear-input'),
  statOrder: document.getElementById('stat-order'),
  statContexts: document.getElementById('stat-contexts'),
  statTransitions: document.getElementById('stat-transitions'),
  distributionChart: document.getElementById('distribution-chart'),
};

function escapeHtml(value = '') {
  const span = document.createElement('span');
  span.textContent = value;
  return span.innerHTML;
}

export function bindInput(handler) {
  elements.input.addEventListener('input', handler);
}

export function bindKeydown(handler) {
  elements.input.addEventListener('keydown', handler);
}

export function bindClear(handler) {
  elements.clearButton.addEventListener('click', handler);
}

export function bindSuggestionClick(handler) {
  elements.suggestions.addEventListener('click', (event) => {
    const target = event.target.closest('.suggestion-badge');
    if (!target) return;
    const index = Number(target.dataset.index);
    if (Number.isNaN(index)) return;
    handler(index);
  });
}

export function setInputValue(value) {
  elements.input.value = value;
}

export function focusInput() {
  elements.input.focus();
}

export function renderSuggestions(suggestions, activeIndex = -1) {
  elements.suggestions.innerHTML = '';
  suggestions.forEach((suggestion, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'suggestion-badge';
    if (index === activeIndex) {
      button.classList.add('active');
    }
    button.dataset.index = String(index);
    button.setAttribute('aria-pressed', index === activeIndex ? 'true' : 'false');
    button.textContent = suggestion.completion;
    elements.suggestions.appendChild(button);
  });
}

export function toggleEmptyState(show) {
  elements.emptyMessage.hidden = !show;
}

export function updateGhostCompletion(prefix, suffix) {
  if (!suffix) {
    elements.ghost.innerHTML = '';
    return;
  }
  elements.ghost.innerHTML = `
    <span class="ghost-prefix">${escapeHtml(prefix)}</span>
    <span class="ghost-suffix">${escapeHtml(suffix)}</span>
  `;
}

export function updateStats(stats) {
  if (!stats) return;
  elements.statOrder.textContent = stats.order ?? '–';
  elements.statContexts.textContent = stats.contexts ?? '–';
  elements.statTransitions.textContent = stats.transitions ?? '–';
}

function prettyChar(char) {
  if (char === ' ') return '␠';
  if (char === '\n') return '↵';
  if (char === '$') return '∎';
  return char;
}

export function renderDistribution(entries) {
  elements.distributionChart.innerHTML = '';
  if (!entries || !entries.length) {
    const placeholder = document.createElement('p');
    placeholder.textContent = 'Aucune transition';
    placeholder.className = 'empty-state';
    elements.distributionChart.appendChild(placeholder);
    return;
  }

  entries.slice(0, 5).forEach((entry) => {
    const bar = document.createElement('div');
    bar.className = 'distribution-bar';
    bar.dataset.char = prettyChar(entry.char);
    bar.title = `${entry.char === '$' ? 'Fin de mot' : `"${entry.char}"`} — ${(entry.probability * 100).toFixed(1)}%`;

    const fill = document.createElement('div');
    fill.className = 'distribution-fill visible';
    fill.style.transform = `scaleY(${Math.max(entry.probability, 0.05)})`;

    bar.appendChild(fill);
    elements.distributionChart.appendChild(bar);
  });
}
