import { boot } from './core/app.js';

boot().catch(error => {
  console.error('[Event Media OS] Boot failed:', error);
  document.documentElement.dataset.appError = 'true';
});
