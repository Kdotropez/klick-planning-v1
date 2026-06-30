import { describe, expect, it, vi, beforeEach } from 'vitest';
import { clearVitestLocalStorage } from '../../vitest.setup.js';
import {
  isPlanningUpsertRpcMissingError,
  resetPlanningUpsertRpcAvailability,
  upsertPlanningRow
} from './planningSupabaseRpc';

describe('planningSupabaseRpc', () => {
  beforeEach(() => {
    clearVitestLocalStorage();
    resetPlanningUpsertRpcAvailability();
  });

  it('détecte une RPC upsert_planning_row absente', () => {
    expect(isPlanningUpsertRpcMissingError({ code: 'PGRST202' })).toBe(true);
    expect(
      isPlanningUpsertRpcMissingError({
        message: 'Could not find the function public.upsert_planning_row'
      })
    ).toBe(true);
    expect(isPlanningUpsertRpcMissingError({ message: 'permission denied' })).toBe(false);
  });

  it('utilise la RPC quand disponible', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const from = vi.fn();
    const client = { rpc, from };

    const result = await upsertPlanningRow(client, {
      shop_id: 'shop_a',
      week_key: '2025-06-02',
      data: { planning: {} }
    });

    expect(result.ok).toBe(true);
    expect(result.viaRpc).toBe(true);
    expect(rpc).toHaveBeenCalledOnce();
    expect(from).not.toHaveBeenCalled();
  });

  it('retombe sur upsert direct si la RPC est absente', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function public.upsert_planning_row' }
    });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ upsert }));
    const client = { rpc, from };

    const result = await upsertPlanningRow(client, {
      shop_id: 'shop_a',
      week_key: '2025-06-02',
      data: { foo: 1 }
    });

    expect(result.ok).toBe(true);
    expect(result.viaRpc).toBe(false);
    expect(rpc).toHaveBeenCalledOnce();
    expect(from).toHaveBeenCalledWith('plannings');
    expect(upsert).toHaveBeenCalledOnce();
  });
});
