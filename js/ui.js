const elements = {
  stage: document.getElementById('stage'),
  capsuleTrack: document.getElementById('capsule-track'),
  placeholder: document.getElementById('capsule-placeholder'),
  orbit: document.getElementById('suggestions-orbit'),
  emptyMessage: document.getElementById('no-suggestion-message'),
  statOrder: document.getElementById('stat-order'),
  statContexts: document.getElementById('stat-contexts'),
  statTransitions: document.getElementById('stat-transitions'),
  statProbability: document.getElementById('stat-probability'),
};

const REMOVAL_DELAY = 160;

function createCapsule(letter) {
  const capsule = document.createElement('span');
  capsule.className = 'letter-capsule';
  capsule.textContent = letter.toUpperCase();
  return capsule;
}

export function renderCapsules(word) {
  const letters = [...word];
  const track = elements.capsuleTrack;
  const currentChildren = Array.from(track.children);

  if (currentChildren.length > letters.length) {
    for (let i = letters.length; i < currentChildren.length; i += 1) {
      const node = currentChildren[i];
      node.classList.add('removing');
      setTimeout(() => node.remove(), REMOVAL_DELAY);
    }
  }

  letters.forEach((letter, index) => {
    const existing = track.children[index];
    if (existing) {
      existing.textContent = letter.toUpperCase();
    } else {
      const capsule = createCapsule(letter);
      track.appendChild(capsule);
    }
  });

  elements.placeholder.classList.toggle('hidden', letters.length > 0);
}

export function bindStageKeydown(handler) {
  elements.stage.addEventListener('keydown', handler);
}

export function bindStageClick(handler) {
  elements.stage.addEventListener('click', handler);
}

export function focusStage() {
  elements.stage.focus();
}

export function bindSuggestionClick(handler) {
  elements.orbit.addEventListener('click', (event) => {
    const target = event.target.closest('.suggestion-bubble');
    if (!target) return;
    const index = Number(target.dataset.index);
    if (Number.isNaN(index)) return;
    handler(index);
  });
}

export function renderSuggestions(suggestions, activeIndex = -1) {
  const row = elements.orbit;
  row.innerHTML = '';
  if (!suggestions.length) return;

  suggestions.forEach((suggestion, index) => {
    const bubble = document.createElement('button');
    bubble.type = 'button';
    bubble.className = 'suggestion-bubble';
    if (index === 0) bubble.classList.add('primary');
    if (index === activeIndex) bubble.classList.add('active');
    bubble.dataset.index = String(index);
    bubble.textContent = suggestion.completion;

    const probability = suggestion.probability ?? 0;
    const scale = 0.9 + probability * 0.6;
    const opacity = 0.4 + probability * 0.6;

    bubble.style.setProperty('--scale', scale.toFixed(2));
    bubble.style.opacity = opacity.toFixed(2);

    row.appendChild(bubble);
  });
}

export function toggleEmptyState(show) {
  elements.emptyMessage.hidden = !show;
}

export function updateStats(stats) {
  if (!stats) return;
  elements.statOrder.textContent = `Ordre: ${stats.order ?? '–'}`;
  elements.statContexts.textContent = `Contexts: ${stats.contexts ?? '–'}`;
  elements.statTransitions.textContent = `Transitions: ${stats.transitions ?? '–'}`;
}

export function updateProbability(probability) {
  const percent = probability && probability > 0 ? `${(probability * 100).toFixed(1)}%` : '–';
  elements.statProbability.textContent = `Probabilité: ${percent}`;
}
