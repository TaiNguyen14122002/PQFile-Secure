import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../../${path}`,import.meta.url),'utf8');
const css=read('apps/web/assets/css/compact-operations.css');

test('the compact stylesheet is imported after base operations styles',()=>{
 const nuxt=read('apps/web/nuxt.config.ts');
 assert(nuxt.indexOf('ops-pages.css')>=0);
 assert(nuxt.indexOf('compact-operations.css')>nuxt.indexOf('ops-pages.css'));
});
test('changes are explicitly limited to operations pages, not /files',()=>{
 assert(css.includes('.pq-app-shell .pq-container.pq-ops-page'));
 assert(!css.includes('.pq-refined-files'));
 assert(!css.includes('.pq-files-layout'));
 for(const page of ['workspaces','smart','security','governance','activity']){
  assert(read(`apps/web/pages/${page}.vue`).includes('pq-ops-page'));
 }
});
test('wide content layouts use container queries instead of viewport breakpoints',()=>{
 assert(css.includes('container-type:inline-size'));
 assert(css.includes('@container (min-width:1030px)'));
 for(const klass of ['pq-compact-grants','pq-compact-security-list','pq-compact-activity-list','pq-smart-content-grid'])
  assert(css.includes(klass));
});
test('all content collections still use their existing Vue data bindings',()=>{
 assert(read('apps/web/pages/governance.vue').includes('v-for="item in visibleGrants"'));
 assert(read('apps/web/pages/security.vue').includes('v-for="item in alerts"'));
 assert(read('apps/web/pages/activity.vue').includes('v-for="r in items"'));
 assert(read('apps/web/pages/smart.vue').includes('v-for="f in pagedFiles"'));
});
test('responsive fallback remains one-column and accessible',()=>{
 assert(css.includes('@container (max-width:759px)'));
 assert(css.includes('@media(max-width:560px)'));
 assert(css.includes('grid-template-columns:minmax(0,1fr)'));
});
