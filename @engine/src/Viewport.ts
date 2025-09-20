import { BoxGeometry, Camera, ColorRepresentation, ConeGeometry, DirectionalLight, Euler, EventDispatcher, GridHelper, Group, Mesh, MeshPhongMaterial, Object3D, Object3DEventMap, ObjectLoader, PerspectiveCamera, PlaneGeometry, PointLight, Scene, SphereGeometry, SpotLight, Vector3, WebGLRenderer } from 'three';
// @ts-expect-error moduleResolution:nodenext issue ts(1479)
import { TransformControls } from 'three/addons/controls/TransformControls.js';
// @ts-expect-error moduleResolution:nodenext issue ts(1479)
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import ObjectSelector from './ObjectSelector';
import { throttle } from './utils';
import { addObject } from './mixins';

type ColorScheme = 'dark' | 'light';

type ViewportColorThemes = {
  [K in ColorScheme]: {
    background: [hex: ColorRepresentation, alpha: number];
    grid: [hex: number, alpha: number];
  };
};

const THEMES: ViewportColorThemes = {
  'dark': { background: [0x000000, 0], grid: [0x555555, 0x888888] },
  'light': { background: [0xaaaaaa, 1], grid: [0x999999, 0x777777] },
};

const CAMERA_DEFAULT = new PerspectiveCamera(50, 1, 0.01, 1000);
CAMERA_DEFAULT.name = 'Camera';
CAMERA_DEFAULT.position.set(5, 5, 10);
CAMERA_DEFAULT.lookAt(new Vector3());

type ObjectInitialTransform = {
  translation?: Vector3;
  rotation?: Euler;
  scale?: Vector3;
};

type ViewportConfiguration = {
  translationSnap?: number;
  rotationSnap?: number;
  scaleSnap?: number;
};

type ViewportStatistics = {
  objects: number;
  vertices: number;
  triangles: number;
  frametime: number;
};

type ViewportEventMap = {
  focus: {};
  blur: {};
  rendered: { frametime: number; };
  objectadded: { object: Object3D; };
  objectremoved: { object: Object3D; };
  geometrychanged: {};
  camerareset: { camera: Camera; };
  scenegraphchanged: {};
  objectselected: { selected?: Object3D; };
  statschanged: ViewportStatistics;
  'add.shape': { shape: 'cube' | 'sphere' | 'cone' | 'plane'; };
  'add.light': { light: 'directional' | 'point' | 'sky' | 'spot'; };
};

export default class Viewport extends EventDispatcher<ViewportEventMap> {
  $root: HTMLElement;
  renderer: WebGLRenderer;
  scene: Scene;
  animations: FrameRequestCallback[] = [
    () => {
      if (this.selected) {
        this.selector.helper.box.setFromObject(this.selected, true);
      }
    }
  ];
  cameras: Dictionary<Camera> = {};
  camera: PerspectiveCamera;
  grid: Group<Object3DEventMap>;
  pid: number = -1;
  controls: OrbitControls;
  selector: ObjectSelector;
  scripts: URL[] = [];
  geometries: Dictionary = {};
  materials: Dictionary = {};
  gizmo: TransformControls;
  stats: Omit<ViewportStatistics, 'frametime'> = { objects: 0, vertices: 0, triangles: 0, };
  selected?: Object3D;
  enabled: boolean = true;

  overlays: Object3D[] = [];

  get theme(): ColorScheme { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }

  constructor(root: HTMLElement) {
    super();
    this.focus = this.focus.bind(this);
    this.blur = this.blur.bind(this);
    this.tick = this.tick.bind(this);
    this.render = this.render.bind(this);
    this.handleWindowResize = this.handleWindowResize.bind(this);
    this.handleStatChanged = this.handleStatChanged.bind(this);
    this.handleRendered = this.handleRendered.bind(this);
    this.handleAddShape = this.handleAddShape.bind(this);

    console.log(`THREE.js Embedded Viewport will use color scheme %c${this.theme}`, 'font-weight: bold');

    this.$root = root;
    const renderer = this.renderer = new WebGLRenderer({ antialias: true });
    const colours = THEMES[this.theme];
    renderer.setClearColor(colours.background[0], colours.background[1]);

    root.innerHTML = '';
    root.appendChild(renderer.domElement);

    const scene = this.scene = new Scene();
    const camera = this.camera = CAMERA_DEFAULT.clone();

    scene.add(camera);

    const grid = this.grid = new Group();
    // 1 tick every unit
    const grid1 = new GridHelper(30, 30);
    grid1.material.color.setHex(colours.grid[0]);
    grid1.material.vertexColors = false;
    grid.add(grid1);

    // 1 tick every 5 units
    const grid2 = new GridHelper(30, 6);
    grid2.material.color.setHex(colours.grid[1]);
    grid2.material.vertexColors = false;
    grid.add(grid2);

    this.selector = new ObjectSelector({ camera, canvas: renderer.domElement, scene });
    this.selector.addEventListener('change', ({ selected }) => {
      this.selected = selected;
      this.dispatchEvent({ type: 'objectselected', selected });
    });

    const initialtransform: ObjectInitialTransform = {};

    // Camera controls
    this.controls = new OrbitControls(camera, renderer.domElement);
    // Create gizmo 1st as it overrides the mousedown events
    this.gizmo = new TransformControls(camera, renderer.domElement);
    this.selector.addEventListener('change', ({ selected }) => {
      this.gizmo.detach();

      if (selected)
        this.gizmo.attach(selected);
    });

    this.gizmo.addEventListener('dragging-changed', e => this.controls.enabled = !e.value);
    this.gizmo.addEventListener('mouseDown', e => {
      initialtransform.translation = e.target.object.position.clone();
      initialtransform.rotation = e.target.object.rotation.clone();
      initialtransform.scale = e.target.object.scale.clone();
    });
    this.gizmo.addEventListener('mouseUp', e => {
      if (e.target.object) {
        if (initialtransform.translation && !e.target.object.position.equals(initialtransform.translation))
          this.dispatchEvent({ type: 'scenegraphchanged' });
        else if (initialtransform.rotation && !e.target.object.rotation.equals(initialtransform.rotation))
          this.dispatchEvent({ type: 'scenegraphchanged' });
        else if (initialtransform.scale && !e.target.object.scale.equals(initialtransform.scale))
          this.dispatchEvent({ type: 'scenegraphchanged' });
      }
    });

    this.addEventListener('focus', this.focus);
    this.addEventListener('blur', this.blur);
    this.addEventListener('rendered', throttle(this.handleRendered, 100));
    this.addEventListener('objectadded', this.handleStatChanged);
    this.addEventListener('objectremoved', this.handleStatChanged);
    this.addEventListener('geometrychanged', this.handleStatChanged);
    this.addEventListener('add.shape', this.handleAddShape);
    this.addEventListener('add.light', this.handleAddLight);

    document.addEventListener('keydown', e => {
      switch (e.key) {
        case 'w': return this.gizmo.mode = 'translate';
        case 'e': return this.gizmo.mode = 'rotate';
        case 'r': return this.gizmo.mode = 'scale';
        case 'Delete': {
          if (this.selected) {
            this.scene.remove(this.selected);
            this.dispatchEvent({ type: 'objectremoved', object: this.selected });
            this.selected = undefined;
            this.dispatchEvent({ type: 'objectselected', selected: undefined });
          }
        }
        case 'Escape': {
          this.gizmo.detach();
          this.selector.helper.visible = false;
          this.dispatchEvent({ type: 'objectselected', selected: undefined });
          break;
        }
      }
    });

    // Kick off a resize event right away to update the camera aspect ratio
    window.addEventListener('resize', this.handleWindowResize);
    window.dispatchEvent(new Event('resize'));

    this.overlays.push(
      grid,
      this.selector.helper,
      this.gizmo.getHelper()
    );

    this.tick(0);
  }

  /** Updates the viewport configuration to the specified values. */
  configure(config: ViewportConfiguration) {
    if (config.translationSnap)
      this.gizmo.setTranslationSnap(config.translationSnap);
    if (config.rotationSnap)
      this.gizmo.setRotationSnap(config.rotationSnap);
    if (config.scaleSnap)
      this.gizmo.setScaleSnap(config.scaleSnap);
  }

  /** Callback for when a tracked statistic changed (objects, geometry, etc) */
  handleStatChanged() {
    let objects = 0, vertices = 0, triangles = 0;

    for (let i = 0, l = this.scene.children.length; i < l; i++) {
      const object = this.scene.children[i];

      object.traverseVisible(function (object) {
        objects++;

        // @ts-ignore
        if (object.isMesh || object.isPoints) {
          // @ts-ignore
          const geometry = object.geometry;
          vertices += geometry.attributes.position.count;

          // @ts-ignore
          if (object.isMesh) {
            if (geometry.index !== null)
              triangles += geometry.index.count / 3;
            else
              triangles += geometry.attributes.position.count / 3;
          }
        }
      });
    }

    this.stats = { objects, vertices, triangles };
  }

  handleAddShape({ shape }: ViewportEventMap['add.shape']) {
    let newObject: Object3D;

    switch (shape) {
      case 'cube': {
        const boxGeometry = new BoxGeometry(1, 1, 1);
        const material = new MeshPhongMaterial({ color: 0xffffff });
        const cube = new Mesh(boxGeometry, material);
        cube.position.set(0, 0.5, 0);
        newObject = cube;
        break;
      }
      case 'sphere': {
        const sphereGeometry = new SphereGeometry(0.5, 32, 32);
        const material = new MeshPhongMaterial({ color: 0xffffff });
        const sphere = new Mesh(sphereGeometry, material);
        sphere.position.set(0, 0.5, 0);
        newObject = sphere;
        break;
      }
      case 'cone': {
        const coneGeometry = new ConeGeometry(0.5, 1, 32);
        const material = new MeshPhongMaterial({ color: 0xffffff });
        const cone = new Mesh(coneGeometry, material);
        cone.position.set(0, 0.5, 0);
        newObject = cone;
        break;
      }
      case 'plane': {
        const planeGeometry = new PlaneGeometry(1, 1);
        const material = new MeshPhongMaterial({ color: 0xffffff });
        const plane = new Mesh(planeGeometry, material);
        plane.rotation.x = -Math.PI / 2; // Rotate to horizontal
        newObject = plane;
        break;
      }
      default:
        console.warn(`Unknown shape type: ${shape}`);
        return;
    }

    this.addObject({ object: newObject, focus: true });
  }

  handleAddLight({ light }: ViewportEventMap['add.light']) {
    const newObject: Object3D | undefined = {
      'directional': () => {
        const light = new DirectionalLight(0xffffff, 1);
        light.position.set(5, 10, 7.5);
        return light;
      },
      'point': () => new PointLight(0x222222),
      'spot': () => {
        const light = new SpotLight(0xffffff, 1, 0, Math.PI * 0.1, 0);
        light.position.set(5, 10, 7.5);
        return light;
      },
      'sky': () => undefined,
    }[light]?.();

    if (newObject)
      this.addObject({ object: newObject, focus: true });
    else
      console.warn(`Unknown light type: ${light}`);
  }

  /** Callback for when the scene was rendered */
  handleRendered({ frametime }: ViewportEventMap['rendered']) {
    this.dispatchEvent({ type: 'statschanged', ...this.stats, frametime });
  }

  /** Callback for when the window is re-sized */
  handleWindowResize() {
    const { width, height } = this.$root.getBoundingClientRect();
    this.renderer.setSize(width, height);
    const aspect = this.renderer.domElement.offsetWidth / this.renderer.domElement.offsetHeight;

    if (this.camera.isPerspectiveCamera)
      this.camera.aspect = aspect;

    this.camera.updateProjectionMatrix();
  }

  async fromJson(json: any) {
    this.scene.clear();
    this.animations = [
      () => {
        if (this.selected) {
          this.selector.helper.box.setFromObject(this.selected, true);
        }
      }
    ];

    const loader = new ObjectLoader();
    const camera = await loader.parseAsync(json.camera);

    const existingUuid = this.camera.uuid;
    const incomingUuid = camera.uuid;

    // copy all properties, including uuid
    this.camera.copy(camera);
    this.camera.uuid = incomingUuid;

    // remove old entry [existingUuid, this.camera]
    delete this.cameras[existingUuid];
    // add new entry [incomingUuid, this.camera]
    this.cameras[incomingUuid] = this.camera;

    this.dispatchEvent({ type: 'camerareset', camera: this.camera });

    this.scripts = json.scripts;

    const scene: any = await loader.parseAsync(json.scene);

    this.scene.uuid = scene.uuid;
    this.scene.name = scene.name;

    this.scene.background = scene.background;
    this.scene.environment = scene.environment;
    this.scene.fog = scene.fog;
    this.scene.backgroundBlurriness = scene.backgroundBlurriness;
    this.scene.backgroundIntensity = scene.backgroundIntensity;
    this.scene.userData = JSON.parse(JSON.stringify(scene.userData));

    this.enabled = false;

    // Try to maintain the currently selected object
    while (scene.children.length > 0)
      this.addObject({ object: scene.children[0] });

    if (this.selected) {
      const found = this.scene.getObjectByProperty('uuid', this.selected.uuid);

      if (found)
        this.selector.connect(found);
    }

    this.enabled = true;

    this.handleStatChanged();
    this.dispatchEvent({ type: 'scenegraphchanged' });
  }

  async toJson() {
    return await new Promise(resolve => {
      const scene = this.scene.toJSON();
      const camera = this.camera.toJSON();
      const state = {
        project: {
          shadows: true,
          vr: false,
        },
        camera,
        scene,
        scripts: this.scripts,
      };

      // @bug https://github.com/mrdoob/three.js/issues/31141
      for (const child of scene.object.children ?? []) {
        // @ts-ignore
        if (['DirectionalLight', 'SpotLight'].includes(child?.type))
          // @ts-ignore
          delete child.target;
      }

      return resolve(state);
    });
  }

  addObject = addObject.bind(this);

  /** Resets the scene and adds a single cube mesh & directional light. */
  scaffold() {
    this.scene.clear();

    const boxGeometry = new BoxGeometry();
    const material = new MeshPhongMaterial({ color: 0xffffff });
    const cube = new Mesh(boxGeometry, material);
    cube.position.set(0, 0.5, 0);
    this.scene.add(cube);

    const light = new DirectionalLight(0xffffff);
    light.position.set(-10, 15, 50);
    this.scene.add(light);

    // 180 / 10 deg per second
    // this.animations.push(delta => cube.rotation.y = delta / (180 * 10));

    this.dispatchEvent({ type: 'objectadded', object: cube });
  }

  /** Renders the scene */
  render() {
    const startTime = performance.now();
    this.renderer.render(this.scene, this.camera);
    const endTime = performance.now();

    this.renderer.autoClear = false;
    for (const overlay of this.overlays)
      this.renderer.render(overlay, this.camera);
    this.renderer.autoClear = true;

    this.dispatchEvent({ type: 'rendered', frametime: endTime - startTime });
  }

  private focus() {
    this.tick(0);
  }

  private blur() {
    cancelAnimationFrame(this.pid);
  }

  /** Tick function for animations */
  private tick(delta: DOMHighResTimeStamp) {
    this.pid = requestAnimationFrame(this.tick);

    if (!this.animations.length)
      return;

    this.animations.forEach(cb => cb(delta));

    this.render();
  }
}
