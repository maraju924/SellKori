import assert from 'node:assert/strict';
import handler from './metaWebhookEntry.ts';

function mockRes() {
  const res: any = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: '',
    setHeader(name: string, value: string) { this.headers[name.toLowerCase()] = value; },
    end(body?: string) { this.body = body ?? ''; return this; }
  };
  return res;
}

async function testVerifyEchoesChallenge() {
  const req = {
    method: 'GET',
    query: {
      'hub.mode': 'subscribe',
      'hub.challenge': '1158201444',
      'hub.verify_token': 'shop-secret'
    }
  };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, '1158201444');
  assert.match(res.headers['content-type'], /text\/plain/);
}

async function testEmptyTokenRejected() {
  const req = {
    method: 'GET',
    query: {
      'hub.mode': 'subscribe',
      'hub.challenge': '1158201444',
      'hub.verify_token': ''
    }
  };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body, 'Forbidden');
}

await testVerifyEchoesChallenge();
await testEmptyTokenRejected();
console.log('metaWebhookEntry tests passed');
