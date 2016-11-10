/// <reference path="defs/three.d.ts" />
declare module d3webgl {
    class WebGLContext {
        scene: THREE.Scene;
        camera: THREE.OrthographicCamera;
        renderer: THREE.WebGLRenderer;
        canvas: any;
        geometry: THREE.BufferGeometry;
        interactor: WebGLInteractor;
        dataBindings: DataBinding[];
        constructor(config?: Object);
        render(): void;
        selectAll(): DataBinding;
        enableZoom(b?: boolean): void;
        enablePanning(b: boolean): void;
        enableHorizontalPanning(b: boolean): void;
    }
    function initWebGL(parentId: string, width: number, height: number, params?: Object): WebGLContext;
    function setWebGL(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.Renderer, canvas: any): void;
    function selectAll(): DataBinding;
    class DataBinding {
        dataElements: Object[];
        visualElements: Object[];
        mesh: THREE.Mesh;
        scene: THREE.Scene;
        mouseOverHandler: Function;
        mouseMoveHandler: Function;
        mouseOutHandler: Function;
        mouseDownHandler: Function;
        mouseUpHandler: Function;
        clickHandler: Function;
        x: number[];
        y: number[];
        z: number[];
        r: number[];
        fill: number[];
        stroke: number[];
        strokewidth: number[];
        opacity: number[];
        shape: string;
        updateAttributes: boolean;
        updateStyle: boolean;
        IS_SHADER: boolean;
        constructor();
        data(arr: Object[]): DataBinding;
        append(shape: string): DataBinding;
        push(e: any): DataBinding;
        getData(i: any): any;
        getVisual(i: any): any;
        length: number;
        filter(f: Function): DataBinding;
        attr(name: string, v: any): DataBinding;
        style(name: string, v: any): DataBinding;
        set(): DataBinding;
        text(v: any): DataBinding;
        setAttr(element: THREE.Mesh, attr: string, v: any, index: number): void;
        removeAll(): void;
        on(event: string, f: Function): DataBinding;
    }
    class WebGLInteractor {
        scene: any;
        canvas: any;
        camera: any;
        raycaster: any;
        mouse: any[];
        mouseStart: any[];
        mouseDown: boolean;
        cameraStart: any[];
        panOffset: any[];
        lastIntersectedSelections: any[];
        lastIntersectedElements: any[];
        isPanEnabled: boolean;
        isHorizontalPanEnabled: boolean;
        isLassoEnabled: boolean;
        lassoPoints: any[];
        lassoStartHandler: Function;
        lassoMoveHandler: Function;
        lassoEndHandler: Function;
        mouseOverSelections: DataBinding[];
        mouseMoveSelections: DataBinding[];
        mouseOutSelections: DataBinding[];
        mouseDownSelections: DataBinding[];
        mouseUpSelections: DataBinding[];
        clickSelections: DataBinding[];
        constructor(scene: THREE.Scene, canvas: HTMLCanvasElement, camera: THREE.Camera);
        register(selection: DataBinding, method: string): void;
        addEventListener(eventName: String, f: Function): void;
        mouseMoveHandler(e: any): void;
        clickHandler(e: any): void;
        mouseDownHandler(e: any): void;
        mouseUpHandler(e: any): void;
        intersect(selection: DataBinding, mousex: any, mousey: any): any[];
        intersectCircles(selection: DataBinding): any[];
        intersectRects(selection: DataBinding): any[];
        intersectPaths(selection: DataBinding): any[];
    }
    function mouseToWorldCoordinates(mouseX: any, mouseY: any): any[];
    function curve(points: any[]): any[];
    class CheckBox {
        selected: boolean;
        changeCallBack: Function;
        circle: any;
        frame: any;
        constructor();
        attr(attrName: string, value: any): d3webgl.CheckBox;
        on(eventType: string, fn: Function): void;
    }
    function makeAlphaBuffer(array: number[], stretch: number): Float32Array;
    function addBufferedRect(vertexArray: number[][], x: number, y: number, z: number, width: number, height: number, colorArray: number[][], c: number[]): void;
    function addBufferedCirlce(vertexArray: number[][], x: number, y: number, z: number, radius: number, colorArray: number[][], c: number[]): void;
    function addBufferedDiamond(vertexArray: number[][], x: number, y: number, z: number, width: number, height: number, colorArray: number[][], c: number[]): void;
    function createRectFrame(w: number, h: number, color: number, lineThickness: number): THREE.Line;
    function createDiagonalCross(w: number, h: number, color: number, lineThickness: number): THREE.Line;
    function makeBuffer3f(array: number[][]): Float32Array;
    function makeBuffer4f(array: number[][]): Float32Array;
    function updateBuffer(buffer: number[], array: number[][], size: number): void;
}
