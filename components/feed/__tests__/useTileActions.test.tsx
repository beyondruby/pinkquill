import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostProps } from '../PostCard/types';
import { useTileActions } from '../useTileActions';
import { __resetEngagementStore } from '@/lib/engagement/store';
const mocks = vi.hoisted(() => ({
  listeners: new Set<(event: { postId: string; field: string; isActive: boolean; countChange: number }) => void>(),
  rpc: vi.fn(), save: vi.fn(), notification: vi.fn(), error: vi.fn(), open: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'viewer' } }) }));
vi.mock('@/components/providers/AuthModalProvider', () => ({ useAuthModal: () => ({ openModal: vi.fn() }) }));
vi.mock('@/components/providers/ModalProvider', () => ({ useModal: () => ({
  openPostModal: mocks.open,
  subscribeToUpdates: (cb: Parameters<typeof mocks.listeners.add>[0]) => { mocks.listeners.add(cb); return () => mocks.listeners.delete(cb); },
  notifyUpdate: (event: Parameters<Parameters<typeof mocks.listeners.add>[0]>[0]) => mocks.listeners.forEach(cb => cb(event)),
}) }));
vi.mock('@/lib/hooks/useInteractions', () => ({ useToggleSave: () => ({ toggle: mocks.save }) }));
vi.mock('@/lib/hooks/useNotifications', () => ({ createNotification: mocks.notification }));
vi.mock('@/lib/hooks/useTracking', () => ({ useTrackPostImpression: vi.fn() }));
vi.mock('@/lib/utils/toast', () => ({ actionToast: { reactionError: mocks.error, genericError: mocks.error, postSaved: vi.fn(), postUnsaved: vi.fn() } }));
const post = { id: 'post', authorId: 'author', reactionType: null, stats: { reactions: 2, comments: 0, relays: 0 } } as PostProps;
const event = () => ({ stopPropagation: vi.fn() }) as unknown as React.MouseEvent;
const counts = (total: number, admire = total) => ({ admire, snap: 0, ovation: 0, support: 0, inspired: 0, applaud: 0, total });
beforeEach(() => { vi.clearAllMocks(); mocks.listeners.clear(); __resetEngagementStore(); mocks.notification.mockResolvedValue(undefined); });
afterEach(cleanup);
describe('optimistic feed actions', () => {
  it('increments once in each view, guards repeated taps, and rolls back every subscriber', async () => {
    let reject!: (reason: Error) => void;
    mocks.rpc.mockReturnValue(new Promise((_, no) => { reject = no; }));
    const first = renderHook(() => useTileActions(post)); const second = renderHook(() => useTileActions(post));
    let pending!: Promise<void>;
    act(() => { pending = first.result.current.onAdmire(event()); });
    expect(first.result.current.reactionCount).toBe(3); expect(second.result.current.reactionCount).toBe(3);
    expect(first.result.current.isReacted).toBe(true);
    await act(async () => { await first.result.current.onAdmire(event()); }); expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('set_post_reaction', { p_post_id: 'post', p_type: 'admire' });
    await act(async () => { reject(new Error('offline')); await pending; });
    expect(first.result.current.reactionCount).toBe(2); expect(second.result.current.reactionCount).toBe(2);
    expect(first.result.current.isReacted).toBe(false);
    expect(first.result.current.reacting).toBe(false); expect(mocks.error).toHaveBeenCalledTimes(1);
  });
  it('writes the server answer back to every view without a client-side notification', async () => {
    mocks.rpc.mockResolvedValue({ data: { mine: 'admire', previous: null, changed: true, counts: counts(7) }, error: null });
    const first = renderHook(() => useTileActions(post)); const second = renderHook(() => useTileActions(post));
    await act(async () => { await first.result.current.onAdmire(event()); });
    expect(first.result.current.reactionCount).toBe(7); expect(second.result.current.reactionCount).toBe(7);
    expect(mocks.notification).not.toHaveBeenCalled();
  });
  it('rolls back saved state across views', async () => {
    mocks.save.mockRejectedValue(new Error('offline'));
    const first = renderHook(() => useTileActions(post)); const second = renderHook(() => useTileActions(post));
    await act(async () => { await first.result.current.onSave(event()); });
    expect(first.result.current.isSaved).toBe(false); expect(second.result.current.isSaved).toBe(false);
  });
  it('does not open a card when a child handles its own keyboard action', () => {
    const hook = renderHook(() => useTileActions(post));
    hook.result.current.onKeyDown({ key: 'Enter', target: {}, currentTarget: {}, preventDefault: vi.fn() } as unknown as React.KeyboardEvent);
    expect(mocks.open).not.toHaveBeenCalled();
  });
});
