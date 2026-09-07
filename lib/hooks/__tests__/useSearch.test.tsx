import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearch } from '../../hooks.legacy';
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));
vi.mock('@/lib/hooks/useNotifications', () => ({ createNotification: vi.fn() }));
vi.mock('@/components/providers/UserEventsProvider', () => ({ useUserEvent: vi.fn() }));
vi.mock('@/components/communities/CommunityContext', () => ({ useCommunityContext: vi.fn() }));
vi.mock('@/lib/posts/enrich', () => ({ enrichPost: vi.fn(), fetchUserPostFlags: vi.fn() }));
function request(result: Promise<unknown>) {
  const builder = { select: () => builder, or: () => builder, ilike: () => builder, limit: () => result };
  return builder;
}
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('search feedback', () => {
  it('reports returned server errors and allows retrying the same query', async () => {
    mocks.from.mockImplementation(() => request(Promise.resolve({ data: null, error: { message: 'offline' } })));
    const hook = renderHook(() => useSearch('art'));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(hook.result.current.error).toBeTruthy(); expect(hook.result.current.loading).toBe(false);
    mocks.from.mockImplementation(() => request(Promise.resolve({ data: [], error: null })));
    act(() => hook.result.current.retry());
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(hook.result.current.error).toBeNull(); expect(mocks.from).toHaveBeenCalledTimes(6);
  });
  it('ignores stale responses when a newer query completes first', async () => {
    let finishOld!: (value: unknown) => void;
    const old = new Promise(resolve => { finishOld = resolve; });
    mocks.from.mockImplementation(() => request(old));
    const hook = renderHook(({ query }) => useSearch(query), { initialProps: { query: 'old' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    mocks.from.mockImplementation((table: string) => request(Promise.resolve({ data: table === 'profiles' ? [{ id: 'new', username: 'new' }] : [], error: null })));
    hook.rerender({ query: 'new' });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(hook.result.current.results.profiles[0].id).toBe('new');
    await act(async () => { finishOld({ data: [], error: null }); });
    expect(hook.result.current.results.profiles[0].id).toBe('new');
  });
});
