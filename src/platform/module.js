/**
 * Module contract. Each feature squad owns one folder under src/modules/<id>/ and exposes exactly one
 * public entry, src/modules/<id>/index.js, exporting:
 *
 *   export const manifest = defineModule({
 *     id: 'review',
 *     routes: [{ path: 'review', element: lazy(() => import('./pages/ReviewPage.jsx')) }],
 *     nav: [{ to: '/review', label: 'Tinjau', icon: 'review', order: 20, primary: true, useBadge }],
 *     providers: [SomeProvider],     // optional, mounted by the app shell around the routes
 *   });
 *
 * plus whatever hooks / components other modules may use. Importing another module's internals is
 * rejected by src/architecture.test.js, so squads can refactor freely behind their index.
 *
 * Nav items: `primary` items (max 4) form the mobile bottom bar, the rest go to the "Akun" tab.
 * `group` places items in the desktop sidebar sections.
 */
export function defineModule(manifest) {
  const { id, routes = [], nav = [], providers = [] } = manifest;
  if (!id) throw new Error('module id required');
  return Object.freeze({ id, routes, nav, providers });
}
