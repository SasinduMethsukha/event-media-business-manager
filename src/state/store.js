const listeners = new Set();

const state = {
  user: null,
  profile: null,
  workspace: null,
  role: null,
  loading: false,
  online: navigator.onLine,
  data: {
    clients: [],
    events: [],
    invoices: [],
    payments: [],
    expenses: [],
    equipment: [],
    crew: []
  }
};

export const store = {
  get: () => state,

  patch(patch) {
    Object.assign(state, patch);
    listeners.forEach(fn => fn(state));
  },

  setData(name, value) {
    state.data[name] = value;
    listeners.forEach(fn => fn(state));
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
};

window.addEventListener('online', () => store.patch({ online: true }));
window.addEventListener('offline', () => store.patch({ online: false }));
