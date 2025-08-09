import { auth } from './auth';
// This module posts to a local path /audit; Vite proxies it to the SMTP relay (http://localhost:4000)
const DEFAULT_ENDPOINT = '/audit';
const AUDIT_ENDPOINT = (import.meta as any).env?.VITE_AUDIT_URL || DEFAULT_ENDPOINT;

// Recipients (override with VITE_AUDIT_RECIPIENTS if needed)
const DEFAULT_RECIPIENTS = [
  'mushahid@ecomgliders.com',
  'rizwan@ecomgliders.com',
  'mushahidyaseen56@gmail.com',
];
const ENV_RECIPIENTS = (import.meta as any).env?.VITE_AUDIT_RECIPIENTS as string | undefined;
const RECIPIENTS = ENV_RECIPIENTS
  ? ENV_RECIPIENTS.split(',').map((s) => s.trim()).filter(Boolean)
  : DEFAULT_RECIPIENTS;

export type AuditEvent = {
  action: string; // e.g., create, update, delete, export
  entity: string; // e.g., expense, debit, loan, contact, repayment
  details?: any; // optional payload
};

// WARNING: Sending emails directly from the browser exposes SMTP credentials to users.
// This implementation follows user request but is insecure for production.
export const sendAudit = async (event: AuditEvent) => {
  try {
    const user = auth.currentUser;
    const payload = {
      ...event,
      actor: {
        uid: user?.uid || 'anonymous',
        email: user?.email || 'unknown',
      },
      recipients: RECIPIENTS,
      timestamp: new Date().toISOString(),
    };
    const res = await fetch(AUDIT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Audit endpoint error ${res.status}`);
  } catch (err) {
    console.error('Audit send failed', err);
  }
};


