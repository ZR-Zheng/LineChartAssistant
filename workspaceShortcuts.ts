export function workspaceShortcutScope(target: EventTarget | null) {
  const element = target as Element | null;
  if (element?.closest?.('input, textarea, select, [contenteditable], [role="separator"], [popover], dialog[open], .color-picker[open]')) {
    return 'blocked';
  }
  if (element?.closest?.('.chart-sheet')) return 'canvas';
  if (element?.closest?.('.toolbar-strip')) return 'object';
  if (element?.closest?.('.tool-rail, .canvas-view-controls, .desk[data-pan-mode]')) return 'tools';
  return 'workspace';
}
