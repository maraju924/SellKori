import {
  doc,
  getDoc,
  onSnapshot,
  type DocumentSnapshot,
  type Firestore,
  type Query,
} from 'firebase/firestore';
import {
  db,
  firestoreDatabaseLabel,
  getPanelFirestoreDbs,
  setPanelWriteDb,
} from './firebase';
import {
  firestoreErrorMessage,
  reconcileMultiDbSnapshots,
  type DatabaseSnapshotState,
  type PanelDoc,
} from './panelFirestore';

export async function getDocAcrossPanelDbs(
  collectionName: string,
  docId: string,
): Promise<DocumentSnapshot | null> {
  const dbs = getPanelFirestoreDbs();
  let lastError: unknown = null;
  for (const database of dbs) {
    try {
      const snap = await getDoc(doc(database, collectionName, docId));
      if (snap.exists()) {
        setPanelWriteDb(database);
        return snap;
      }
    } catch (err) {
      lastError = err;
      console.warn(
        `[panelDb] getDoc ${collectionName}/${docId} failed on ${firestoreDatabaseLabel(database)}:`,
        err,
      );
    }
  }
  if (lastError && dbs.length > 0) {
    // Nothing existed; keep writes on the primary db.
    setPanelWriteDb(db);
  }
  return null;
}

export function listenQueryAcrossPanelDbs<T extends { id?: string }>(
  buildQuery: (database: Firestore) => Query,
  onChange: (docs: T[], meta: { error: string | null; allFailed: boolean }) => void,
  buildFallbackQuery?: (database: Firestore) => Query,
): () => void {
  const dbs = getPanelFirestoreDbs();
  const states: DatabaseSnapshotState<T>[] = dbs.map(() => ({ status: 'pending' }));
  const extraUnsubs: Array<(() => void) | null> = dbs.map(() => null);

  const emit = () => {
    const result = reconcileMultiDbSnapshots(states);
    if (!result.ready) return;
    const counts = states.map((state) => (state.status === 'ready' ? state.docs.length : 0));
    const richest = counts.reduce((best, count, index) => (count > counts[best] ? index : best), 0);
    if (states[richest]?.status === 'ready' && counts[richest] > 0) {
      setPanelWriteDb(dbs[richest]);
    }
    onChange(result.docs.map((row) => row.data), {
      error: result.error,
      allFailed: result.allFailed,
    });
  };

  const toDocs = (database: Firestore, snap: { docs: Array<{ id: string; data: () => any }> }): Array<PanelDoc<T>> =>
    snap.docs.map((d) => ({
      id: d.id,
      data: { id: d.id, ...d.data() } as T,
      databaseId: firestoreDatabaseLabel(database),
    }));

  const unsubs = dbs.map((database, index) =>
    onSnapshot(
      buildQuery(database),
      (snap) => {
        states[index] = { status: 'ready', docs: toDocs(database, snap) };
        emit();
      },
      (err) => {
        if (buildFallbackQuery) {
          extraUnsubs[index] = onSnapshot(
            buildFallbackQuery(database),
            (snap) => {
              states[index] = { status: 'ready', docs: toDocs(database, snap) };
              emit();
            },
            (fallbackErr) => {
              console.warn(`[panelDb] snapshot failed on ${firestoreDatabaseLabel(database)}:`, fallbackErr);
              states[index] = { status: 'error', error: firestoreErrorMessage(fallbackErr) };
              emit();
            },
          );
          return;
        }
        console.warn(`[panelDb] snapshot failed on ${firestoreDatabaseLabel(database)}:`, err);
        states[index] = { status: 'error', error: firestoreErrorMessage(err) };
        emit();
      },
    ),
  );

  return () => {
    unsubs.forEach((unsub) => unsub());
    extraUnsubs.forEach((unsub) => unsub?.());
  };
}
