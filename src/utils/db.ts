import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, Firestore, serverTimestamp } from 'firebase/firestore';
import { Expense, Debit, Loan, Contact } from '../types';

const db: Firestore = getFirestore();

const colRef = (uid: string, name: 'expenses' | 'debits' | 'loans' | 'contacts') => collection(db, 'users', uid, name);
const docRef = (uid: string, name: 'expenses' | 'debits' | 'loans' | 'contacts', id: string) => doc(db, 'users', uid, name, id);
const metaDocRef = (uid: string, name: string) => doc(db, 'users', uid, 'meta', name);

export const upsertExpense = async (uid: string, expense: Expense) => {
  if (!uid) return;
  await setDoc(docRef(uid, 'expenses', expense.id), { ...expense, _updatedAt: serverTimestamp() }, { merge: true });
};

export const deleteExpense = async (uid: string, id: string) => {
  if (!uid) return;
  await deleteDoc(docRef(uid, 'expenses', id));
};

export const upsertDebit = async (uid: string, debit: Debit) => {
  if (!uid) return;
  await setDoc(docRef(uid, 'debits', debit.id), { ...debit, _updatedAt: serverTimestamp() }, { merge: true });
};

export const deleteDebit = async (uid: string, id: string) => {
  if (!uid) return;
  await deleteDoc(docRef(uid, 'debits', id));
};

export const upsertLoan = async (uid: string, loan: Loan) => {
  if (!uid) return;
  await setDoc(docRef(uid, 'loans', loan.id), { ...loan, _updatedAt: serverTimestamp() }, { merge: true });
};

export const deleteLoan = async (uid: string, id: string) => {
  if (!uid) return;
  await deleteDoc(docRef(uid, 'loans', id));
};

export const upsertContact = async (uid: string, contact: Contact) => {
  if (!uid) return;
  await setDoc(docRef(uid, 'contacts', contact.id), { ...contact, _updatedAt: serverTimestamp() }, { merge: true });
};

export const deleteContact = async (uid: string, id: string) => {
  if (!uid) return;
  await deleteDoc(docRef(uid, 'contacts', id));
};

export const setBalance = async (uid: string, currentBalance: number) => {
  if (!uid) return;
  await setDoc(metaDocRef(uid, 'balance'), { currentBalance, _updatedAt: serverTimestamp() }, { merge: true });
};

type SyncHandlers = {
  onExpenses?: (items: Expense[]) => void;
  onDebits?: (items: Debit[]) => void;
  onLoans?: (items: Loan[]) => void;
  onContacts?: (items: Contact[]) => void;
  onBalance?: (value: number) => void;
};

export const startRealtimeSync = (uid: string, handlers: SyncHandlers) => {
  const unsubs: Array<() => void> = [];
  if (!uid) return () => {};

  if (handlers.onExpenses) {
    unsubs.push(onSnapshot(colRef(uid, 'expenses'), (snap) => {
      const list: Expense[] = snap.docs.map((d) => d.data() as Expense).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      handlers.onExpenses!(list);
    }));
  }
  if (handlers.onDebits) {
    unsubs.push(onSnapshot(colRef(uid, 'debits'), (snap) => {
      const list: Debit[] = snap.docs.map((d) => d.data() as Debit).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      handlers.onDebits!(list);
    }));
  }
  if (handlers.onLoans) {
    unsubs.push(onSnapshot(colRef(uid, 'loans'), (snap) => {
      const list: Loan[] = snap.docs.map((d) => d.data() as Loan).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      handlers.onLoans!(list);
    }));
  }
  if (handlers.onContacts) {
    unsubs.push(onSnapshot(colRef(uid, 'contacts'), (snap) => {
      const list: Contact[] = snap.docs.map((d) => d.data() as Contact);
      handlers.onContacts!(list);
    }));
  }
  if (handlers.onBalance) {
    unsubs.push(onSnapshot(metaDocRef(uid, 'balance'), (snap) => {
      const data = snap.data() as any;
      if (data && typeof data.currentBalance === 'number') handlers.onBalance!(data.currentBalance);
    }));
  }

  return () => unsubs.forEach((u) => u());
};


