/**
 * Admin + merchant panels read Firestore with the client SDK.
 *
 * Two independent bugs made those screens look empty:
 * 1. The web app talks to the AI Studio *named* database, while the server
 *    Admin SDK used to fall back to "(default)" — so live orders/settings
 *    landed in a different database than the panels were watching.
 * 2. Collection listeners had no error handler, so a rules/permission miss
 *    left the UI on zeros / an infinite spinner.
 */

export interface PanelDoc<T> {
  id: string;
  data: T;
  databaseId: string;
}

export function firestoreErrorMessage(err: unknown): string {
  const anyErr = err as { code?: string; message?: string } | undefined;
  const code = String(anyErr?.code || '');
  const message = String(anyErr?.message || err || 'Firestore error');
  if (code.includes('permission-denied') || message.includes('permission-denied')) {
    return 'Firestore permission-denied: সিকিউরিটি রুলস এই লিস্ট কোয়েরি ব্লক করছে।';
  }
  if (code.includes('unavailable') || message.includes('unavailable')) {
    return 'Firestore unavailable: ডাটাবেসের সাথে সংযোগ হচ্ছে না।';
  }
  return message;
}

export function isPermissionDenied(err: unknown): boolean {
  const anyErr = err as { code?: string; message?: string } | undefined;
  const text = `${anyErr?.code || ''} ${anyErr?.message || ''}`;
  return text.includes('permission-denied');
}

/** Prefer the named AI Studio DB, then the project default. */
export function mergeDocsById<T extends { id?: string }>(
  groups: Array<Array<PanelDoc<T>>>,
): T[] {
  const merged = new Map<string, T>();
  for (const group of groups) {
    for (const row of group) {
      if (!row.id || merged.has(row.id)) continue;
      merged.set(row.id, { ...row.data, id: row.id });
    }
  }
  return Array.from(merged.values());
}

export function firstNonEmptyGroup<T>(groups: Array<Array<PanelDoc<T>>>): Array<PanelDoc<T>> {
  return groups.find((group) => group.length > 0) || [];
}

export type DatabaseSnapshotState<T> =
  | { status: 'pending' }
  | { status: 'ready'; docs: Array<PanelDoc<T>> }
  | { status: 'error'; error: string };

export function reconcileMultiDbSnapshots<T>(
  states: DatabaseSnapshotState<T>[],
): {
  ready: boolean;
  docs: Array<PanelDoc<T>>;
  error: string | null;
  allFailed: boolean;
} {
  const readyStates = states.filter((state) => state.status === 'ready');
  const errorStates = states.filter((state) => state.status === 'error');
  const pending = states.some((state) => state.status === 'pending');
  const docs = mergeDocsById(
    readyStates.map((state) => (state.status === 'ready' ? state.docs : [])),
  ).map((data) => ({
    id: String((data as { id?: string }).id || ''),
    data,
    databaseId: '',
  }));

  // If any database already has documents, surface them immediately.
  if (docs.length > 0) {
    return { ready: true, docs, error: null, allFailed: false };
  }

  // Otherwise wait until every database has succeeded or failed — an early
  // empty snapshot from the named DB must not create a blank shop before
  // "(default)" has been checked.
  if (pending) {
    return { ready: false, docs: [], error: null, allFailed: false };
  }

  return {
    ready: true,
    docs,
    error: errorStates.length === states.length && errorStates[0]?.status === 'error'
      ? errorStates[0].error
      : null,
    allFailed: errorStates.length === states.length && states.length > 0,
  };
}
