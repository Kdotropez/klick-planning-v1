const AUDIT_LOG_KEY = 'planning_audit_log_v1';
const AUDIT_LOG_MAX_ITEMS = 5000;

const safeRead = () => {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const safeWrite = (entries) => {
  try {
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn('⚠️ Impossible de sauvegarder le journal d audit:', error);
  }
};

export const addAuditLog = ({
  action,
  details = '',
  userCode = 'inconnu',
  userName = 'inconnu',
  shopId = '',
  shopName = ''
}) => {
  const entry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    action: String(action || 'action'),
    details: String(details || ''),
    userCode: String(userCode || 'inconnu'),
    userName: String(userName || 'inconnu'),
    shopId: String(shopId || ''),
    shopName: String(shopName || '')
  };

  const current = safeRead();
  current.unshift(entry);
  if (current.length > AUDIT_LOG_MAX_ITEMS) {
    current.length = AUDIT_LOG_MAX_ITEMS;
  }
  safeWrite(current);
};

export const listAuditLogs = (limit = 300) => {
  const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 300));
  return safeRead().slice(0, safeLimit);
};

export const clearAuditLogs = () => {
  safeWrite([]);
};
