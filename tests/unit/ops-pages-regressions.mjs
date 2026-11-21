/** Dependency-free structural regression checks for five PQFile Secure pages.
 * This is NOT an end-to-end Nuxt/NestJS integration test. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'../..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const cases=[
 ['workspaces', ['createGroup','renameGroup','deleteGroup','addMember','changeRole','removeMember','memberSearch','memberRoleFilter']],
 ['smart',['decryptFile','saveLocalIndex','loadLocalIndex','searchDocuments','insightFromText','summarizeWithBrowserAI','indexBatch','cancelBatch','removeLocalIndex','filePage']],
 ['security',['/security/alerts/paged','/security/alerts/acknowledge-all','acknowledge(item)','status','severity','search','period']],
 ['governance',['/governance/review','/governance/graph','/governance/grants/','updateDeadline','revoke','exportReview','graphScale']],
 ['activity',['/activity/paged','dateFrom','dateTo','exportFiltered','exportCurrentPage','csvValue']],
];
let count=0;
for(const [page,tokens] of cases){
 const src=read(`apps/web/pages/${page}.vue`);
 for(const token of tokens){assert.ok(src.includes(token),`${page}: missing ${token}`);count++;}
 assert.ok(src.includes('pq-ops-page'),`${page}: responsive styling is missing`);count++;
}
const api=read('apps/api/src/security/security.controller.ts');
for(const snippet of ["@UseGuards(AuthGuard)","@Get('alerts/paged')","@Patch('alerts/acknowledge-all')",'eq(securityEvents.userId,req.user.id)','isNull(securityEvents.acknowledgedAt)','SECURITY_ALERT_ACK']){
 assert.ok(api.includes(snippet),`security API missing ${snippet}`);count++;
}
assert.ok(read('apps/web/nuxt.config.ts').includes('ops-pages.css'),'CSS missing from Nuxt');count++;
assert.ok(read('apps/web/assets/css/ops-pages.css').includes('.pq-ops-page'),'Scoped CSS missing');count++;
console.log(`PASS: ${count} checks of operations pages, endpoints, security scopes, responsive stylesheet.`);
