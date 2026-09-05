import assert from 'node:assert/strict';
import handler, { handleMetaVerifyGet, maxDuration, preserveParsedJsonBody, waitForExpress } from '../webhook.js';

function mockRes() {
  const res: any = {
    state: {
      statusCode: 200,
      body: undefined as string | undefined,
      headers: {} as Record<string, string>,
    },
    headersSent: false,
    writableEnded: false,
    set statusCode(value: number) {
      res.state.statusCode = value;
    },
    get statusCode() {
      return res.state.statusCode;
    },
    setHeader(key: string, value: string) {
      res.state.headers[key] = value;
    },
    end(body?: string) {
      res.headersSent = true;
      res.writableEnded = true;
      res.state.body = body;
    },
    send(body?: string) {
      res.end(body);
    }
  };
  return res;
}

function testEchoesChallenge() {
  const result = handleMetaVerifyGet({
    'hub.mode': 'subscribe',
    'hub.challenge': '1158201444',
    'hub.verify_token': 'jhdfguyedgf'
  });
  assert.equal(result.status, 200);
  assert.equal(result.body, '1158201444');
}

function testRejectsEmptyToken() {
  const result = handleMetaVerifyGet({
    'hub.mode': 'subscribe',
    'hub.challenge': '1158201444',
    'hub.verify_token': ''
  });
  assert.equal(result.status, 403);
}

function testRejectsMissingChallenge() {
  const result = handleMetaVerifyGet({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'jhdfguyedgf'
  });
  assert.equal(result.status, 403);
}

function testPreservesVercelParsedBody() {
  const payload = { object: 'page', entry: [{ id: '1' }] };
  const req: { body?: unknown; _body?: boolean } = { body: JSON.stringify(payload) };
  preserveParsedJsonBody(req);
  assert.equal(req._body, true);
  assert.deepEqual(req.body, payload);
}

async function testWaitsUntilExpressFinishes() {
  const listeners: Record<string, Array<() => void>> = {};
  const res: any = {
    writableEnded: false,
    headersSent: false,
    once(event: string, listener: () => void) {
      (listeners[event] ||= []).push(listener);
    }
  };
  const pending = waitForExpress((_req, response) => {
    setTimeout(() => {
      response.writableEnded = true;
      response.headersSent = true;
      (listeners.finish || []).forEach((fn) => fn());
    }, 15);
  }, {}, res);
  await pending;
}

async function testHandlerGetEchoesChallenge() {
  const res = mockRes();
  await handler({
    method: 'GET',
    query: {
      'hub.mode': 'subscribe',
      'hub.challenge': 'challenge-ok',
      'hub.verify_token': 'any-token'
    }
  }, res);
  assert.equal(res.state.statusCode, 200);
  assert.equal(res.state.body, 'challenge-ok');
}

async function testHandlerRejectsUnknownMethod() {
  const res = mockRes();
  await handler({ method: 'PUT', query: {} }, res);
  assert.equal(res.state.statusCode, 405);
}

testEchoesChallenge();
testRejectsEmptyToken();
testRejectsMissingChallenge();
testPreservesVercelParsedBody();
await testWaitsUntilExpressFinishes();
await testHandlerGetEchoesChallenge();
await testHandlerRejectsUnknownMethod();
assert.equal(maxDuration, 60);
console.log('api/webhook tests passed');
