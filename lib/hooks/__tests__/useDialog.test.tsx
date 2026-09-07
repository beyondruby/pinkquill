import { useRef } from 'react';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDialog } from '../useDialog';

function Dialog({ name, open = true, busy = false, close }: { name: string; open?: boolean; busy?: boolean; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(open, ref, close, busy);
  return open ? <div ref={ref} role="dialog" aria-label={name} tabIndex={-1}><button>{name} first</button><button>{name} last</button></div> : null;
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.body.style.overflow = ''; });
describe('dialog stack', () => {
  it('only dismisses the top dialog and retains the original scroll lock until all close', () => {
    document.body.style.overflow = 'clip';
    const parent = vi.fn(); const child = vi.fn();
    const root = render(<Dialog name="Parent" close={parent} />);
    const nested = render(<Dialog name="Child" close={child} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(child).toHaveBeenCalledTimes(1); expect(parent).not.toHaveBeenCalled();
    nested.unmount(); expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' }); expect(parent).toHaveBeenCalledTimes(1);
    root.unmount(); expect(document.body.style.overflow).toBe('clip');
  });
  it('does not let Escape through a busy child or reset the stack on callback updates', () => {
    const parent = vi.fn(); const child = vi.fn();
    render(<Dialog name="Parent" close={parent} />);
    const nested = render(<Dialog name="Child" close={child} busy />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(child).not.toHaveBeenCalled(); expect(parent).not.toHaveBeenCalled();
    nested.rerender(<Dialog name="Child" close={child} />);
    fireEvent.keyDown(document, { key: 'Escape' }); expect(child).toHaveBeenCalledTimes(1);
  });
  it('traps Tab in the top dialog and restores its opener', () => {
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{ width: 10 }] as unknown as DOMRectList);
    render(<button>Open</button>); const opener = screen.getByText('Open'); opener.focus();
    const dialog = render(<Dialog name="Test" close={vi.fn()} />);
    screen.getByText('Test last').focus(); fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByText('Test first')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }); expect(screen.getByText('Test last')).toHaveFocus();
    dialog.unmount(); expect(opener).toHaveFocus();
  });
});
