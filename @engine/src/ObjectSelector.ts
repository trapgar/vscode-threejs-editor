import { Box3, Box3Helper, Camera, EventDispatcher, Object3D, Raycaster, Scene, Vector2 } from 'three';
import { getCoordinatesFromMouseEvent } from './utils';

type ViewportSelectorEventMap = {
  change: { selected?: Object3D; };
};

type ViewportSelectorParams = {
  camera: Camera;
  canvas: HTMLCanvasElement;
  scene: Scene;
};

/** Controller used to track what object in the scene the user has 'selected', or wants to select (e.g. what did they click on?) */
export default class ObjectSelector extends EventDispatcher<ViewportSelectorEventMap> {
  element: HTMLCanvasElement;
  camera: Camera;
  scene: Scene;
  raycaster = new Raycaster();
  selectionHighlighter = new Box3Helper(new Box3());

  get helper() { return this.selectionHighlighter; }

  constructor({ camera, canvas, scene }: ViewportSelectorParams) {
    super();
    this.element = canvas;
    this.camera = camera;
    this.scene = scene;

    this.handleMouseDown = this.handleMouseDown.bind(this);

    this.selectionHighlighter.visible = false;

    if ('depthTest' in this.selectionHighlighter.material)
      this.selectionHighlighter.material.depthTest = false;
    if ('transparent' in this.selectionHighlighter.material)
      this.selectionHighlighter.material.transparent = true;

    this.element.addEventListener('mousedown', this.handleMouseDown);
  }

  handleMouseDown(event: MouseEvent) {
    const $el = this.element;

    if (event.target !== $el)
      return;

    const [xDown, yDown] = getCoordinatesFromMouseEvent($el, event);
    const down = new Vector2(xDown, yDown);

    const handleMouseUp = (event: MouseEvent) => {
      const [xUp, yUp] = getCoordinatesFromMouseEvent($el, event);
      const up = new Vector2(xUp, yUp);

      // Not a drag event
      if (down.distanceTo(up) === 0) {
        const mouse = new Vector2((up.x * 2) - 1, - (up.y * 2) + 1);

        this.raycaster.setFromCamera(mouse, this.camera);
        const intersecting = this.getIntersectingObjects();
        const selected = intersecting[0]?.object;
        this.selectionHighlighter.visible = !!selected;

        this.dispatchEvent({ type: 'change', selected });
      }

      $el.removeEventListener('mouseup', handleMouseUp);
    };

    $el.addEventListener('mouseup', handleMouseUp);
  }

  getIntersectingObjects() {
    const objects: Object3D[] = [];

    this.scene.traverseVisible(function (child) {
      objects.push(child);
    });

    // this.helpers.traverseVisible(function (child) {
    //   if (child.name === 'picker')
    //     objects.push(child);
    // });

    return this.raycaster.intersectObjects(objects, false);
  }

  connect(newSelected: Object3D) {
    this.selectionHighlighter.visible = true;
    this.dispatchEvent({ type: 'change', selected: newSelected });
  }

  disconnect() {
    this.selectionHighlighter.visible = false;
    this.dispatchEvent({ type: 'change', selected: undefined });
  }
}
