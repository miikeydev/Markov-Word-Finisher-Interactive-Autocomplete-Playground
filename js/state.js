const state = {
  inputValue: '',
  suggestions: [],
  activeIndex: -1,
  modelStats: null,
};

export function getState() {
  return { ...state };
}

export function setInputValue(value) {
  state.inputValue = value;
}

export function setSuggestions(list) {
  state.suggestions = Array.isArray(list) ? list : [];
  if (state.activeIndex >= state.suggestions.length) {
    state.activeIndex = -1;
  }
}

export function setActiveIndex(index) {
  state.activeIndex = index;
}

export function cycleActive(delta) {
  if (!state.suggestions.length) {
    state.activeIndex = -1;
    return state.activeIndex;
  }
  const nextIndex = (state.activeIndex + delta + state.suggestions.length) % state.suggestions.length;
  state.activeIndex = nextIndex;
  return state.activeIndex;
}

export function resetActive() {
  state.activeIndex = -1;
}

export function setModelStats(stats) {
  state.modelStats = stats;
}
