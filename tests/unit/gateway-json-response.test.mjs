import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiRequestError, apiEndpoint, isJsonContentType, parseApiResponse } from '../../apps/web/utils/api-response.ts';

const response=(body,status,contentType,headers={})=>new Response(body,{
  status, headers:{...(contentType?{'content-type':contentType}:{}),...headers}
});

test('successful application/json response',async()=>{
  assert.deepEqual(await parseApiResponse(response('{"ok":true}',200,'application/json; charset=utf-8'),'/health'),{ok:true});
});
test('accepts problem+json',async()=>{
  assert.equal(isJsonContentType('application/problem+json'),true);
  assert.deepEqual(await parseApiResponse(response('{"ok":1}',200,'application/problem+json'),'/health'),{ok:1});
});
test('HTML 200 from misrouted SPA is reported with endpoint and route',async()=>{
  await assert.rejects(parseApiResponse(response('<html>app</html>',200,'text/html',{'x-pqfile-route':'api'}),'/files/library'),(error)=>{
    assert.ok(error instanceof ApiRequestError);
    assert.equal(error.status,200);
    assert.match(error.message,/\/api\/files\/library/);
    assert.match(error.message,/text\/html/);
    return true;
  });
});
test('does not expose sensitive query parameters in unexpected response errors',async()=>{
  const path='/users/search?q=secret@example.com';
  assert.equal(apiEndpoint(path),'/api/users/search');
  await assert.rejects(parseApiResponse(response('<html></html>',200,'text/html'),path),err=>{
    assert.ok(!err.message.includes('secret@example.com'));
    return true;
  });
});
test('JSON API errors expose safe message and correlation ID',async()=>{
  const id='fbebf64f-0cd6-4255-9bcf-967248fa95e8';
  await assert.rejects(parseApiResponse(response(JSON.stringify({message:'API gặp sự cố',errorId:id}),500,'application/json'),'/governance/review'),err=>{
    assert.equal(err.status,500);
    assert.equal(err.errorId,id);
    assert.match(err.message,/API gặp sự cố/);
    return true;
  });
});
test('HTML gateway failures never expose HTML',async()=>{
  await assert.rejects(parseApiResponse(response('<html>supersecret</html>',502,'text/html'),'/security/alerts'),err=>{
    assert.equal(err.status,502);
    assert.ok(!err.message.includes('supersecret'));
    assert.match(err.message,/Gateway/);
    return true;
  });
});
test('204 is valid no body success',async()=>{
  assert.equal(await parseApiResponse(new Response(null,{status:204}),'/workspaces/x'),undefined);
});
test('205 is valid no body success',async()=>{
  assert.equal(await parseApiResponse(new Response(null,{status:205}),'/workspaces/x'),undefined);
});
test('JSON without Content-Type can still be parsed safely',async()=>{
  const res=response('{"ok":true}',200,'');
  res.headers.delete('content-type');
  assert.deepEqual(await parseApiResponse(res,'/health'),{ok:true});
});
test('empty JSON body on HTTP 200 reports endpoint',async()=>{
  await assert.rejects(parseApiResponse(response('',200,'application/json'),'/keys'),err=>{
    assert.match(err.message,/\/api\/keys/);
    return true;
  });
});
test('invalid JSON on HTTP 200 reports endpoint',async()=>{
  await assert.rejects(parseApiResponse(response('not json',200,'application/json'),'/files/library'),err=>{
    assert.match(err.message,/JSON/);
    return true;
  });
});
test('unauthorized response returns usable message',async()=>{
  await assert.rejects(parseApiResponse(response('{"message":"Vui lòng đăng nhập"}',401,'application/json'),'/auth/me'),err=>{
    assert.equal(err.status,401);
    assert.match(err.message,/Vui lòng đăng nhập/);
    return true;
  });
});
