export const persistedSpecs = ['critical-flow.spec.js', 'e2e-isolation.spec.js', 'notifications-recovery.spec.js']

// These files primarily exercise shared geometry or broad cross-surface matrices.
// They remain executable; they are not part of the fast smoke selection.
export const responsiveSpecs = [
  'accessibility-audit.spec.js', 'appreciation-style.spec.js', 'back-layout-audit.spec.js',
  'button-design.spec.js', 'card-grid-columns.spec.js', 'collections-layout.spec.js',
  'competition-entries-layout.spec.js', 'competitions-layout.spec.js', 'editor-layout.spec.js',
  'list-category-fitting.spec.js', 'modal-audit.spec.js', 'overlay-position.spec.js',
  'page-alignment.spec.js', 'post-detail-layout.spec.js', 'post-list-spacing.spec.js',
  'question-card-layout.spec.js', 'short-layout.spec.js',
]

// Distinct auth, publishing, engagement, keyboard, search and role risks.
export const smokeSpecs = [
  'add-to-collection.spec.js', 'article-reading.spec.js', 'auth-access-modal.spec.js',
  'author-series.spec.js', 'collection-menu.spec.js', 'competition-scoring.spec.js',
  'editor-history.spec.js', 'editor-selection-toolbar.spec.js', 'find-writers.spec.js',
  'post-deletion.spec.js', 'profile-cover.spec.js', 'question-dialog.spec.js',
  'route-focus.spec.js', 'search-popular.spec.js', 'workshop-reservation.spec.js',
  'write-drafts.spec.js', 'writer-post-engagement.spec.js',
]

// This smoke scenario requires a configured public Google client ID and can
// otherwise skip at runtime. Keep it discoverable in smoke/full manual audits,
// rather than counting it as verified critical CI coverage.
export const manualOnlyPatterns = [
  /auth-access-modal\.spec\.js Google sign-in returns to the guarded page$/,
]
