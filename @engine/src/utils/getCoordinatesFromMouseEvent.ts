/** Function that returns the X, Y coordinates from the given MouseEvent. */
export default function getCoordinatesFromMouseEvent(dom: HTMLElement, event: Pick<MouseEvent, 'clientX' | 'clientY'>): [x: number, y: number] {
  const rect = dom.getBoundingClientRect();

  return [
    (event.clientX - rect.left) / rect.width,
    (event.clientY - rect.top) / rect.height
  ];
}
