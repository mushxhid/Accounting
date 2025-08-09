import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, Firestore, serverTimestamp, getDocs, getDoc } from 'firebase/firestore';
import { Expense, Debit, Loan, Contact } from '../types';

const db: Firestore = getFirestore();

// Use a shared org-scoped path so multiple admins see the same data
const colRef = (orgId: string, name: 'expenses' | 'debits' | 'loans' | 'contacts') => collection(db, 'orgs', orgId, name);
const docRef = (orgId: string, name: 'expenses' | 'debits' | 'loans' | 'contacts', id: string) => doc(db, 'orgs', orgId, name, id);
const metaDocRef = (orgId: string, name: string) => doc(db, 'orgs', orgId, 'meta', name);

export const upsertExpense = async (orgId: string, expense: Expense) => {
  if (!orgId) return;
  console.log('[DB] upsertExpense', orgId, expense.id);
  await setDoc(docRef(orgId, 'expenses', expense.id), { ...expense, _updatedAt: serverTimestamp() }, { merge: true });
};

export const deleteExpense = async (orgId: string, id: string) => {
  if (!orgId) return;
  console.log('[DB] deleteExpense', orgId, id);
  await deleteDoc(docRef(orgId, 'expenses', id));
};

export const upsertDebit = async (orgId: string, debit: Debit) => {
  if (!orgId) return;
  console.log('[DB] upsertDebit', orgId, debit.id);
  await setDoc(docRef(orgId, 'debits', debit.id), { ...debit, _updatedAt: serverTimestamp() }, { merge: true });
};

export const deleteDebit = async (orgId: string, id: string) => {
  if (!orgId) return;
  console.log('[DB] deleteDebit', orgId, id);
  await deleteDoc(docRef(orgId, 'debits', id));
};

export const upsertLoan = async (orgId: string, loan: Loan) => {
  if (!orgId) return;
  console.log('[DB] upsertLoan', orgId, loan.id);
  await setDoc(docRef(orgId, 'loans', loan.id), { ...loan, _updatedAt: serverTimestamp() }, { merge: true });
};

export const deleteLoan = async (orgId: string, id: string) => {
  if (!orgId) return;
  console.log('[DB] deleteLoan', orgId, id);
  await deleteDoc(docRef(orgId, 'loans', id));
};

export const upsertContact = async (orgId: string, contact: Contact) => {
  if (!orgId) return;
  console.log('[DB] upsertContact', orgId, contact.id);
  await setDoc(docRef(orgId, 'contacts', contact.id), { ...contact, _updatedAt: serverTimestamp() }, { merge: true });
};

export const deleteContact = async (orgId: string, id: string) => {
  if (!orgId) return;
  console.log('[DB] deleteContact', orgId, id);
  await deleteDoc(docRef(orgId, 'contacts', id));
};

export const setBalance = async (orgId: string, currentBalance: number) => {
  if (!orgId) return;
  console.log('[DB] setBalance', orgId, currentBalance);
  await setDoc(metaDocRef(orgId, 'balance'), { currentBalance, _updatedAt: serverTimestamp() }, { merge: true });
};

type SyncHandlers = {
  onExpenses?: (items: Expense[]) => void;
  onDebits?: (items: Debit[]) => void;
  onLoans?: (items: Loan[]) => void;
  onContacts?: (items: Contact[]) => void;
  onBalance?: (value: number) => void;
};

export const startRealtimeSync = (orgId: string, handlers: SyncHandlers) => {
  const unsubs: Array<() => void> = [];
  if (!orgId) return () => {};

  if (handlers.onExpenses) {
    unsubs.push(onSnapshot(colRef(orgId, 'expenses'), (snap) => {
      const list: Expense[] = snap.docs.map((d) => d.data() as Expense).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      console.log('[Sync] expenses', list.length);
      handlers.onExpenses!(list);
    }));
  }
  if (handlers.onDebits) {
    unsubs.push(onSnapshot(colRef(orgId, 'debits'), (snap) => {
      const list: Debit[] = snap.docs.map((d) => d.data() as Debit).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      console.log('[Sync] debits', list.length);
      handlers.onDebits!(list);
    }));
  }
  if (handlers.onLoans) {
    unsubs.push(onSnapshot(colRef(orgId, 'loans'), (snap) => {
      const list: Loan[] = snap.docs.map((d) => d.data() as Loan).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      console.log('[Sync] loans', list.length);
      handlers.onLoans!(list);
    }));
  }
  if (handlers.onContacts) {
    unsubs.push(onSnapshot(colRef(orgId, 'contacts'), (snap) => {
      const list: Contact[] = snap.docs.map((d) => d.data() as Contact);
      console.log('[Sync] contacts', list.length);
      handlers.onContacts!(list);
    }));
  }
  if (handlers.onBalance) {
    unsubs.push(onSnapshot(metaDocRef(orgId, 'balance'), (snap) => {
      const data = snap.data() as any;
      console.log('[Sync] balance doc exists =', !!data);
      if (data && typeof data.currentBalance === 'number') handlers.onBalance!(data.currentBalance);
    }));
  }

  return () => unsubs.forEach((u) => u());
};

// One-time migration: copy data from old per-user path users/{userUid} to shared org path orgs/{orgId}
export const migrateUserToOrgIfEmpty = async (userUid: string, orgId: string) => {
  if (!userUid || !orgId) return;
  try {
    // Always merge current user's legacy data into org (idempotent)
    const [userExpensesSnap, userDebitsSnap, userLoansSnap, userContactsSnap, userBalanceSnap] = await Promise.all([
      getDocs(collection(db, 'users', userUid, 'expenses')),
      getDocs(collection(db, 'users', userUid, 'debits')),
      getDocs(collection(db, 'users', userUid, 'loans')),
      getDocs(collection(db, 'users', userUid, 'contacts')),
      getDoc(doc(db, 'users', userUid, 'meta', 'balance')),
    ]);

    const writes: Promise<any>[] = [];
    userExpensesSnap.forEach(d => writes.push(setDoc(docRef(orgId, 'expenses', d.id), { ...d.data() }, { merge: true })));
    userDebitsSnap.forEach(d => writes.push(setDoc(docRef(orgId, 'debits', d.id), { ...d.data() }, { merge: true })));
    userLoansSnap.forEach(d => writes.push(setDoc(docRef(orgId, 'loans', d.id), { ...d.data() }, { merge: true })));
    userContactsSnap.forEach(d => writes.push(setDoc(docRef(orgId, 'contacts', d.id), { ...d.data() }, { merge: true })));
    if (userBalanceSnap.exists()) {
      writes.push(setDoc(metaDocRef(orgId, 'balance'), userBalanceSnap.data() as any, { merge: true }));
    }
    await Promise.all(writes);
  } catch (_e) {
    // ignore errors; migration is best-effort
  }
};

// Danger: deletes all docs in org's top-level collections and resets balance
export const clearOrgData = async (orgId: string) => {
  if (!orgId) return;
  try {
    console.log('[DB] clearOrgData start', orgId);
    const collNames: Array<'expenses' | 'debits' | 'loans' | 'contacts'> = ['expenses', 'debits', 'loans', 'contacts'];
    for (const name of collNames) {
      const snap = await getDocs(colRef(orgId, name));
      const deletes: Promise<void>[] = [];
      snap.forEach((d) => deletes.push(deleteDoc(docRef(orgId, name, d.id))));
      await Promise.all(deletes);
    }
    // Clear meta docs (e.g., balance) then set to 0
    const metaSnap = await getDocs(collection(db, 'orgs', orgId, 'meta'));
    const metaDeletes: Promise<void>[] = [];
    metaSnap.forEach((d) => metaDeletes.push(deleteDoc(doc(db, 'orgs', orgId, 'meta', d.id))));
    await Promise.all(metaDeletes);
    await setBalance(orgId, 0);
    console.log('[DB] clearOrgData done', orgId);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[DB] clearOrgData failed', e);
    throw e;
  }
};


