import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, Firestore, serverTimestamp, getDocs, updateDoc, arrayUnion, increment, addDoc, query, orderBy, limit } from 'firebase/firestore';
import { Expense, Debit, Loan, Contact } from '../types';

const db: Firestore = getFirestore();

// Use a shared org-scoped path so multiple admins see the same data
const colRef = (orgId: string, name: 'expenses' | 'debits' | 'loans' | 'contacts' | 'audit') => collection(db, 'orgs', orgId, name);
const docRef = (orgId: string, name: 'expenses' | 'debits' | 'loans' | 'contacts' | 'audit', id: string) => doc(db, 'orgs', orgId, name, id);
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

// Atomic repayment append to avoid last-write-wins on concurrent writers
export const appendRepayment = async (
  orgId: string,
  loanId: string,
  repayment: any
) => {
  if (!orgId) return;
  const ref = docRef(orgId, 'loans', loanId);
  console.log('[DB] appendRepayment', orgId, loanId, repayment?.id);
  await updateDoc(ref, {
    repayments: arrayUnion(repayment),
    usdAmount: increment(-Number(repayment.usdAmount || 0)),
    amount: increment(-Number(repayment.amount || 0)),
    _updatedAt: serverTimestamp(),
  } as any);
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
  onAudit?: (items: any[]) => void;
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
  if (handlers.onAudit) {
    const q = query(colRef(orgId, 'audit'), orderBy('timestamp', 'desc'), limit(500));
    unsubs.push(onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      handlers.onAudit!(list);
    }));
  }

  return () => unsubs.forEach((u) => u());
};

export const recordAuditEvent = async (orgId: string, event: any) => {
  if (!orgId) return;
  const payload = { ...event, timestamp: new Date().toISOString(), _createdAt: serverTimestamp() };
  try {
    await addDoc(colRef(orgId, 'audit'), payload);
  } catch (e) {
    console.warn('[DB] recordAuditEvent failed', e);
  }
};

// One-time migration: copy data from old per-user path users/{userUid} to shared org path orgs/{orgId}
// Removed automatic migration to prevent re-appearing entries after reset

// Danger: deletes all docs in org's top-level collections and resets balance
export const clearOrgData = async (orgId: string) => {
  if (!orgId) return;
  try {
    console.log('[DB] clearOrgData start', orgId);
    const collNames: Array<'expenses' | 'debits' | 'loans' | 'contacts' | 'audit'> = ['expenses', 'debits', 'loans', 'contacts', 'audit'];
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
    // Hard check: verify collections are empty
    for (const name of collNames) {
      const verify = await getDocs(colRef(orgId, name));
      console.log('[DB] verify empty', name, verify.empty);
    }
    console.log('[DB] clearOrgData done', orgId);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[DB] clearOrgData failed', e);
    throw e;
  }
};

// Optional safety: clear legacy per-user data to avoid resurrection from old clients
export const clearAllLegacyUsersData = async () => {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    const perUserDeletes: Promise<void>[] = [];
    usersSnap.forEach((userDoc) => {
      const uid = userDoc.id;
      const cols: Array<'expenses' | 'debits' | 'loans' | 'contacts'> = ['expenses', 'debits', 'loans', 'contacts'];
      for (const name of cols) {
        perUserDeletes.push(
          (async () => {
            const snap = await getDocs(collection(db, 'users', uid, name));
            const deletes: Promise<void>[] = [];
            snap.forEach((d) => deletes.push(deleteDoc(doc(db, 'users', uid, name, d.id))));
            await Promise.all(deletes);
          })()
        );
      }
    });
    await Promise.all(perUserDeletes);
    console.log('[DB] clearAllLegacyUsersData done');
  } catch (e) {
    console.warn('[DB] clearAllLegacyUsersData skipped/failed', e);
  }
};


