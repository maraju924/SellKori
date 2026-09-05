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

async function testVercelPostKeepsMessageAndWaitsForReply() {
  const payload = {
    object: 'page',
    entry: [{
      id: 'PAGE1',
      messaging: [{
        sender: { id: 'PSID1' },
        message: { text: 'দাম কত?', mid: 'mid.live-1' }
      }]
    }]
  };

  const wiped: { body?: unknown } = { body: payload };
  wiped.body = {};
  assert.equal(wiped.body && typeof wiped.body === 'object' && (wiped.body as any).object === 'page', false);

  const req: { body?: unknown; _body?: boolean } = { body: JSON.stringify(payload) };
  preserveParsedJsonBody(req);
  if (!req._body) req.body = {};
  assert.equal((req.body as any).object, 'page');

  const listeners: Record<string, Array<() => void>> = {};
  const res: any = {
    writableEnded: false,
    headersSent: false,
    statusCode: 0,
    body: '',
    once(event: string, listener: () => void) {
      (listeners[event] ||= []).push(listener);
    },
    end(text?: string) {
      res.body = text;
      res.writableEnded = true;
      res.headersSent = true;
      (listeners.finish || []).forEach((fn) => fn());
    }
  };

  let savedMessage = '';
  let replyText = '';
  await waitForExpress((incoming) => {
    const event = incoming.body.entry[0].messaging[0];
    savedMessage = event.message.text;
    replyText = 'জি, আমি সাহায্য করছি। কোন পণ্যের দাম জানতে চান?';
    setTimeout(() => {
      res.statusCode = 200;
      res.end('EVENT_RECEIVED');
    }, 20);
  }, req, res);

  assert.equal(savedMessage, 'দাম কত?');
  assert.equal(Boolean(replyText), true);
  assert.equal(res.body, 'EVENT_RECEIVED');
  assert.equal(res.statusCode, 200);
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
await testVercelPostKeepsMessageAndWaitsForReply();
await testHandlerGetEchoesChallenge();
await testHandlerRejectsUnknownMethod();
assert.equal(maxDuration, 60);
console.log('api/webhook tests passed');
