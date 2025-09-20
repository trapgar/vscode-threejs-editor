import { Object3D } from 'three';
import Viewport from '../Viewport';

type addObjectParams = {
  object: Object3D;
  parent?: any;
  index?: number;
  focus?: boolean;
};

export default function addObject(this: Viewport, params: addObjectParams) {
  const { object, parent, index, focus=false } = params;

  object.traverse((child: any) => {
    if (child.geometry)
      this.geometries[child.geometry.uuid] = child.geometry;
    if (child.material)
      this.materials[child.material.uuid] = child.material;
  });

  if (!parent)
    this.scene.add(object);
  else {
    parent.children.splice(index, 0, object);
    object.parent = parent;
  }

  if (this.enabled) {
    this.dispatchEvent({ type: 'objectadded', object });
    this.dispatchEvent({ type: 'scenegraphchanged' });
  }

  if (focus)
    this.selector.connect(object);
}
