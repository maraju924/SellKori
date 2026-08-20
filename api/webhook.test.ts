import assert from 'node:assert/strict';
import { handleMetaVerifyGet } from './webhook.js';

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

testEchoesChallenge();
testRejectsEmptyToken();
testRejectsMissingChallenge();
console.log('api/webhook tests passed');
