import assert from 'node:assert/strict';
import {
  firstNonEmptyGroup,
  firestoreErrorMessage,
  isPermissionDenied,
  mergeDocsById,
  reconcileMultiDbSnapshots,
} from './panelFirestore.ts';

assert.equal(
  isPermissionDenied({ code: 'permission-denied', message: 'Missing or insufficient permissions.' }),
  true,
);
assert.equal(isPermissionDenied({ code: 'unavailable' }), false);
assert.match(
  firestoreErrorMessage({ code: 'permission-denied', message: 'Missing or insufficient permissions.' }),
  /permission-denied/,
);
assert.match(
  firestoreErrorMessage({ code: 'resource-exhausted', message: 'Quota exceeded' }),
  /quota/i,
);

const named = [
  { id: 'biz-1', data: { id: 'biz-1', name: 'Named Shop' }, databaseId: 'named' },
];
const fallback = [
  { id: 'biz-1', data: { id: 'biz-1', name: 'Default Shop' }, databaseId: 'default' },
  { id: 'biz-2', data: { id: 'biz-2', name: 'Other Shop' }, databaseId: 'default' },
];

const merged = mergeDocsById([named, fallback]);
assert.equal(merged.length, 2);
assert.equal(merged[0].name, 'Named Shop');
assert.equal(merged[1].name, 'Other Shop');

assert.equal(firstNonEmptyGroup([[], fallback])[0].id, 'biz-1');
assert.equal(firstNonEmptyGroup([[], []]).length, 0);

const pending = reconcileMultiDbSnapshots([
  { status: 'pending' },
  { status: 'error', error: 'permission-denied' },
]);
assert.equal(pending.ready, false);

const emptyNamedStillWaiting = reconcileMultiDbSnapshots([
  { status: 'ready', docs: [] },
  { status: 'pending' },
]);
assert.equal(emptyNamedStillWaiting.ready, false);

const bothEmpty = reconcileMultiDbSnapshots([
  { status: 'ready', docs: [] },
  { status: 'ready', docs: [] },
]);
assert.equal(bothEmpty.ready, true);
assert.equal(bothEmpty.docs.length, 0);
assert.equal(bothEmpty.error, null);
assert.equal(bothEmpty.allFailed, false);

const fromDefault = reconcileMultiDbSnapshots([
  { status: 'ready', docs: [] },
  { status: 'ready', docs: fallback },
]);
assert.equal(fromDefault.ready, true);
assert.equal(fromDefault.docs.length, 2);
assert.equal(fromDefault.allFailed, false);

const allFailed = reconcileMultiDbSnapshots([
  { status: 'error', error: 'permission-denied' },
  { status: 'error', error: 'unavailable' },
]);
assert.equal(allFailed.ready, true);
assert.equal(allFailed.allFailed, true);
assert.match(allFailed.error || '', /permission-denied/);

const emptyNamedDefaultFailed = reconcileMultiDbSnapshots([
  { status: 'ready', docs: [] },
  { status: 'error', error: 'The database (default) does not exist' },
]);
assert.equal(emptyNamedDefaultFailed.ready, true);
assert.equal(emptyNamedDefaultFailed.docs.length, 0);
assert.equal(emptyNamedDefaultFailed.allFailed, false);
assert.match(emptyNamedDefaultFailed.error || '', /default/);

console.log('panelFirestore tests passed');
