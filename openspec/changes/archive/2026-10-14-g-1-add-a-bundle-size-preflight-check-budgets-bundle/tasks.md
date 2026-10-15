## 1. Bundle size budget

- [x] 1.1 Add `budgets.bundleBytes` as an empty map to `profiles/default.json` (I-1, C-1)
- [x] 1.2 Add the `bundle_size` check to `scripts/lib/preflight.mjs`, exported for testing (I-2, C-2, C-3, C-4)
- [x] 1.3 Add `tests/bundle-size.test.mjs` covering over-cap, at-cap, empty-map and missing-file cases (I-3, C-5)
- [x] 1.4 Add the bundle size row to `docs/rules.md` (I-4, C-6)
