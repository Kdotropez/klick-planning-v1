// src/hooks/usePlanningLock.js
import { useEffect, useRef, useState } from 'react';
import { acquireLock, renewLock, releaseLock, emergencyTakeover, subscribeLock } from '../utils/lockService';
import { saveCompletePlanningData } from '../utils/remoteStore';

const HEARTBEAT_SEC = 30;   // renouvelle toutes les 30 s (plus fréquent)
const TTL_SEC       = 600;  // bail de 600 s (10 minutes - plus long)

// Système de verrouillage DÉSACTIVÉ pour permettre le travail libre
const LOCK_SYSTEM_DISABLED = true;

export function usePlanningLock(resourceId, holderId) {
  const [status, setStatus] = useState(LOCK_SYSTEM_DISABLED ? 'owner' : 'loading'); // loading | owner | readonly | lost
  const [lockInfo, setLockInfo] = useState(LOCK_SYSTEM_DISABLED ? { holder: holderId, lease_token: 'disabled', expires_at: new Date(Date.now() + 3600000).toISOString() } : null);  // { holder, lease_token, expires_at }
  const hbRef = useRef(null);
  const unsubRef = useRef(null);

  // Si le système de verrouillage est désactivé, retourner directement le contrôle
  if (LOCK_SYSTEM_DISABLED) {
    return {
      status: 'owner',
      isOwner: true,
      readOnly: false,
      lockInfo: { holder: holderId, lease_token: 'disabled', expires_at: new Date(Date.now() + 3600000).toISOString() },
      release: async () => { console.log('Système de verrouillage désactivé'); },
      emergency: async () => { console.log('Système de verrouillage désactivé'); return true; }
    };
  }

  // tentative d'acquisition au montage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await acquireLock(resourceId, holderId, TTL_SEC);
        if (cancelled) return;
        if (res?.acquired) {
          setStatus('owner');
          setLockInfo({ holder: res.holder, lease_token: res.lease_token, expires_at: res.expires_at });
          startHeartbeat();
        } else {
          setStatus('readonly');
          setLockInfo({ holder: res?.holder, lease_token: res?.lease_token, expires_at: res?.expires_at });
          watchLock();
        }
      } catch (e) {
        console.error('acquireLock error', e);
        setStatus('readonly');
        watchLock();
      }
    })();
    return () => { cancelled = true; cleanup(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId, holderId]);

  function startHeartbeat() {
    stopHeartbeat();
    hbRef.current = setInterval(async () => {
      try {
        const ok = await renewLock(resourceId, holderId, lockInfo?.lease_token, TTL_SEC);
        if (!ok) {
          // Bail perdu (expiré/volé) → bascule en readonly
          setStatus('lost');
          stopHeartbeat();
          watchLock();
        }
      } catch (e) {
        console.warn('renewLock error', e);
      }
    }, HEARTBEAT_SEC * 1000);
    window.addEventListener('beforeunload', onBeforeUnload);
  }
  
  function stopHeartbeat() {
    if (hbRef.current) clearInterval(hbRef.current);
    hbRef.current = null;
    window.removeEventListener('beforeunload', onBeforeUnload);
  }
  
  async function onBeforeUnload() {
    try {
      if (status === 'owner' && lockInfo?.lease_token) {
        await releaseLock(resourceId, holderId, lockInfo.lease_token);
      }
    } catch (_) {}
  }

  function watchLock() {
    unwatchLock();
    unsubRef.current = subscribeLock(resourceId, async () => {
      // Dès qu'un changement arrive sur la ligne de lock, on tente de récupérer le bail
      try {
        const jitter = Math.floor(Math.random() * 300); // anti-thundering herd
        await new Promise(r => setTimeout(r, jitter));
        const res = await acquireLock(resourceId, holderId, TTL_SEC);
        if (res?.acquired) {
          setStatus('owner');
          setLockInfo({ holder: res.holder, lease_token: res.lease_token, expires_at: res.expires_at });
          startHeartbeat();
        } else {
          setStatus('readonly');
          setLockInfo({ holder: res?.holder, lease_token: res?.lease_token, expires_at: res?.expires_at });
        }
      } catch (e) {
        console.error('watch acquire error', e);
      }
    });
  }
  
  function unwatchLock() {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
  }
  
  function cleanup() { stopHeartbeat(); unwatchLock(); }

  async function release() {
    if (lockInfo?.lease_token) {
      const ok = await releaseLock(resourceId, holderId, lockInfo.lease_token);
      if (ok) {
        setStatus('readonly');
        unwatchLock();
        watchLock();
      }
    }
  }
  
  async function emergency(pin) {
    const res = await emergencyTakeover(resourceId, holderId, pin, TTL_SEC);
    if (res?.acquired) {
      setStatus('owner');
      setLockInfo({ holder: res.holder, lease_token: res.lease_token, expires_at: res.expires_at });
      startHeartbeat();
      return true;
    }
    return false;
  }

  const isOwner   = status === 'owner';
  const readOnly  = status !== 'owner';

  return { status, isOwner, readOnly, lockInfo, release, emergency };
}
