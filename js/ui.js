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
  themeToggle: document.getElementById('theme-toggle'),
};

const REMOVAL_DELAY = 160;
const bubbleStates = new Map();
let animationId = null;
let lastTimestamp = null;

function randomVelocity() {
  return (Math.random() - 0.5) * 80;
}

function updateThemeToggle() {
  if (!elements.themeToggle) return;
  const isLight = document.body.classList.contains('theme-light');
  elements.themeToggle.checked = isLight;
}

function initThemeToggle() {
  if (!elements.themeToggle) return;
  const saved = window.localStorage?.getItem('markov-theme');
  if (saved === 'light') {
    document.body.classList.add('theme-light');
  }
  updateThemeToggle();
  elements.themeToggle.addEventListener('change', () => {
    if (elements.themeToggle.checked) {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
    const mode = elements.themeToggle.checked ? 'light' : 'dark';
    window.localStorage?.setItem('markov-theme', mode);
  });
}

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
    if (target.dataset.skipClick === 'true') {
      target.removeAttribute('data-skip-click');
      return;
    }
    const index = Number(target.dataset.index);
    if (Number.isNaN(index)) return;
    handler(index);
  });
}

function createBubbleElement() {
  const bubble = document.createElement('button');
  bubble.type = 'button';
  bubble.className = 'suggestion-bubble';
  return bubble;
}

function attachBubbleInteractions(state) {
  const element = state.element;
  element.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const rect = elements.orbit.getBoundingClientRect();
    state.isDragging = true;
    state.dragMoved = false;
    state.dragPointerId = event.pointerId;
    state.dragOffsetX = event.clientX - (rect.left + state.x);
    state.dragOffsetY = event.clientY - (rect.top + state.y);
    element.setPointerCapture(event.pointerId);

    const handleMove = (moveEvent) => {
      if (moveEvent.pointerId !== state.dragPointerId) return;
      state.dragMoved = true;
      const containerRect = elements.orbit.getBoundingClientRect();
      const width = containerRect.width;
      const height = containerRect.height;
      const desiredX = moveEvent.clientX - containerRect.left - state.dragOffsetX;
      const desiredY = moveEvent.clientY - containerRect.top - state.dragOffsetY;
      const clampX = Math.max(state.radius, Math.min(width - state.radius, desiredX));
      const clampY = Math.max(state.radius, Math.min(height - state.radius, desiredY));
      state.x = clampX;
      state.y = clampY;
      state.vx = 0;
      state.vy = 0;
      element.style.left = `${state.x}px`;
      element.style.top = `${state.y}px`;
      element.style.transform = `translate(-50%, -50%) scale(${state.scale})`;
    };

    const handleUp = (endEvent) => {
      if (endEvent.pointerId !== state.dragPointerId) return;
      element.releasePointerCapture(state.dragPointerId);
      element.removeEventListener('pointermove', handleMove);
      element.removeEventListener('pointerup', handleUp);
      element.removeEventListener('pointercancel', handleUp);
      state.isDragging = false;
      state.dragPointerId = null;
      if (state.dragMoved) {
        element.dataset.skipClick = 'true';
        setTimeout(() => {
          if (element) element.removeAttribute('data-skip-click');
        }, 150);
      }
    };

    element.addEventListener('pointermove', handleMove);
    element.addEventListener('pointerup', handleUp);
    element.addEventListener('pointercancel', handleUp);
  });
}

function ensureAnimationRunning() {
  if (animationId || !bubbleStates.size) return;
  lastTimestamp = performance.now();
  animationId = requestAnimationFrame(stepPhysics);
}

function stopAnimationIfNeeded() {
  if (!bubbleStates.size && animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
    lastTimestamp = null;
  }
}

function updateBubbleClasses(state, index, activeIndex, label) {
  state.element.dataset.index = String(index);
  state.element.textContent = label;
  state.element.classList.toggle('primary', index === 0);
  state.element.classList.toggle('active', index === activeIndex);
}

function setBubbleAppearance(state) {
  const probability = state.probability;
  state.scale = 0.9 + probability * 0.6;
  state.mass = 1.2 - probability * 0.4;
  const opacity = 0.4 + probability * 0.6;
  state.element.style.opacity = opacity.toFixed(2);
}

function initializeState(key, probability, index, total) {
  const bubble = createBubbleElement();
  const container = elements.orbit;
  container.appendChild(bubble);
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 160;
  const spread = total > 1 ? ((index / (total - 1)) - 0.5) * width * 0.4 : 0;
  const state = {
    key,
    element: bubble,
    x: width / 2 + spread,
    y: height / 2,
    vx: randomVelocity() * 0.2,
    vy: randomVelocity() * 0.2,
    probability,
    scale: 1,
    radius: Math.max((bubble.offsetWidth || 80) / 2, 30),
    mass: 1,
    isDragging: false,
    dragPointerId: null,
  };
  bubble.style.left = `${state.x}px`;
  bubble.style.top = `${state.y}px`;
  bubble.style.transform = 'translate(-50%, -50%)';
  attachBubbleInteractions(state);
  return state;
}

export function renderSuggestions(suggestions, activeIndex = -1) {
  const activeKeys = new Set();
  const total = suggestions.length;
  suggestions.forEach((suggestion, index) => {
    const key = suggestion.completion;
    activeKeys.add(key);
    let state = bubbleStates.get(key);
    if (!state) {
      state = initializeState(key, suggestion.probability ?? 0, index, total);
      bubbleStates.set(key, state);
    }
    state.key = key;
    state.probability = suggestion.probability ?? 0;
    updateBubbleClasses(state, index, activeIndex, suggestion.completion);
    setBubbleAppearance(state);
  });

  Array.from(bubbleStates.keys()).forEach((key) => {
    if (!activeKeys.has(key)) {
      const state = bubbleStates.get(key);
      state.element.remove();
      bubbleStates.delete(key);
    }
  });

  if (bubbleStates.size) {
    ensureAnimationRunning();
  } else {
    stopAnimationIfNeeded();
  }
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

function resolveBounds(state, width, height) {
  const r = state.radius;
  if (state.x - r < 0) {
    state.x = r;
    state.vx = Math.abs(state.vx) * 0.85;
  }
  if (state.x + r > width) {
    state.x = width - r;
    state.vx = -Math.abs(state.vx) * 0.85;
  }
  if (state.y - r < 0) {
    state.y = r;
    state.vy = Math.abs(state.vy) * 0.85;
  }
  if (state.y + r > height) {
    state.y = height - r;
    state.vy = -Math.abs(state.vy) * 0.85;
  }
}

function resolveCollisions(states) {
  for (let i = 0; i < states.length; i += 1) {
    for (let j = i + 1; j < states.length; j += 1) {
      const a = states[i];
      const b = states[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const minDist = a.radius + b.radius;
      if (dist < minDist) {
        const overlap = (minDist - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;
        const av = a.vx * nx + a.vy * ny;
        const bv = b.vx * nx + b.vy * ny;
        const totalMass = a.mass + b.mass;
        const impulse = (2 * (av - bv)) / totalMass;
        a.vx -= impulse * b.mass * nx;
        a.vy -= impulse * b.mass * ny;
        b.vx += impulse * a.mass * nx;
        b.vy += impulse * a.mass * ny;
      }
    }
  }
}

function stepPhysics(timestamp) {
  if (!lastTimestamp) {
    lastTimestamp = timestamp;
  }
  const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
  lastTimestamp = timestamp;
  const rect = elements.orbit.getBoundingClientRect();
  const width = rect.width || 1;
  const height = rect.height || 1;
  const states = Array.from(bubbleStates.values());
  states.forEach((state) => {
    const baseRadius = (state.element.offsetWidth || 80) / 2;
    state.radius = baseRadius * state.scale;
    if (state.isDragging) {
      state.vx = 0;
      state.vy = 0;
    } else {
      state.vx *= 0.99;
      state.vy *= 0.99;
      state.x += state.vx * dt;
      state.y += state.vy * dt;
    }
    resolveBounds(state, width, height);
  });
  resolveCollisions(states);
  states.forEach((state) => {
    state.element.style.left = `${state.x}px`;
    state.element.style.top = `${state.y}px`;
    state.element.style.transform = `translate(-50%, -50%) scale(${state.scale})`;
  });
  if (bubbleStates.size) {
    animationId = requestAnimationFrame(stepPhysics);
  } else {
    animationId = null;
    lastTimestamp = null;
  }
}

initThemeToggle();
