import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareLocalPreview, isPreviewBlocked, escapePreviewHtml } from '../../apps/web/utils/local-preview.ts';

test('compressed files/folders never preview', async()=>{
  assert.equal(isPreviewBlocked('archive.zip'),true);
  assert.equal(isPreviewBlocked('report/'),true);
  const result=await prepareLocalPreview('archive.zip',new Blob(['anything']));
  assert.equal(result.kind,'blocked');
});
test('source text is never executed as HTML', async()=>{
  const source='<script>alert("secret")</script>';
  const preview=await prepareLocalPreview('file.txt',new Blob([source]));
  assert.equal(preview.kind,'text');
  assert.equal(preview.text,source);
  assert.equal(escapePreviewHtml(source).includes('<script>'),false);
});
test('Markdown preview degrades safely when optional renderer is unavailable', async()=>{
  const preview=await prepareLocalPreview('readme.md',new Blob(['# Title\n<script>alert(1)</script>']));
  assert.equal(preview.kind,'markdown');
  assert.ok(preview.html);
  assert.ok(!preview.html.includes('<script>'));
  assert.ok(preview.text?.includes('Title'));
});
test('CSV parser keeps quoted commas',async()=>{
  const preview=await prepareLocalPreview('table.csv',new Blob(['name,comment\nA,"one,two"\n']));
  assert.equal(preview.kind,'spreadsheet');
  assert.equal(preview.sheets?.[0]?.rows[1][1],'one,two');
});
