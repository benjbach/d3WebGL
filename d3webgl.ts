/// <reference path="defs/three.d.ts" />

module d3webgl {
    
    
    // SETUP
    
    // object used for writing text elements
    var txtCanvas = document.createElement("canvas")

    // Webgl context that contains all the necessary THREE.js objects
    // e.g. camera, scene, etc.
    export class WebGLContext{

        scene:THREE.Scene;
        camera:THREE.OrthographicCamera;
        renderer:THREE.WebGLRenderer;
        canvas;
        geometry:THREE.BufferGeometry;
        interactor:WebGLInteractor;

        // set of all data bindings (data object -> visual object)
        dataBindings:DataBinding[] = []


        // params - placeholder for initialization parameters. 
        constructor(config?:Object){

            txtCanvas = document.createElement("canvas");
            txtCanvas.setAttribute('id', 'textCanvas');

        }


        // render routine. Needs to be called externally
        render(){

            // check which dataBindings must be updated
            for(var i=0 ; i < this.dataBindings.length ; i++){
                if(this.dataBindings[i].updateAttributes || this.dataBindings[i].updateStyle){
                    this.dataBindings[i].set();
                }
            }

            this.renderer.render(this.scene, this.camera)
        }

        // D3 syntax to create data binding
        selectAll(){
            return d3webgl.selectAll()
        }


        ///////////////////////
        // RENDER PARAMETERS //
        ///////////////////////
        
        // enables or diables zoom
        enableZoom(b?:boolean){
            if(b){
                window.addEventListener("mousewheel", mouseWheel, false);
                function mouseWheel(event){
                    event.preventDefault();
                    
                    webgl.camera.zoom += event.wheelDelta/1000;
                    webgl.camera.zoom = Math.max (0.1, webgl.camera.zoom)
                    webgl.camera.updateProjectionMatrix();
                    webgl.render();
                }
            }else{
                window.addEventListener("mousewheel", mouseWheel, false);
            }
        }

        // enables or diables general panning via drag and drop
        enablePanning(b:boolean){
            this.interactor.isPanEnabled = b;
        }
        // enables or diables horizontal panning via scroll wheel
        enableHorizontalPanning(b:boolean){
            this.interactor.isHorizontalPanEnabled = b;
        }
    } // end of WebGLContext 
    
    // gobal webgl object
    var webgl;


    // initialize WebGL context. This function is called externally to init this API
    // and prepare the canvas.
    export function initWebGL(parentId:string, width:number, height:number, params?:Object):WebGLContext{

        // init WebGLContext (see above)
        webgl = new WebGLContext(params);
    
        // init orthographic camera (could be adjusted through config-object (see above))        
        webgl.camera = new THREE.OrthographicCamera(
            width/-2,
            width/2,
            height/2,
            height/-2,
            0, 1000)

        // init scene and set camera            
        webgl.scene = new THREE.Scene();
        webgl.scene.add(webgl.camera);
        webgl.camera.position.z = 100;
        

        // renderer
        webgl.renderer = new THREE.WebGLRenderer({
            antialias: true, 
            preserveDrawingBuffer: true 
        });
        webgl.renderer.setSize(width, height)
        webgl.renderer.setClearColor( 0xffffff, 1);
        
        // position canvas element
        webgl.canvas = webgl.renderer.domElement;
        document.getElementById(parentId).appendChild(webgl.canvas);  
        
        // init interaction object
        webgl.interactor = new WebGLInteractor(webgl.scene, webgl.canvas, webgl.camera);  

        // init simple white light
        var light = new THREE.PointLight( 0x000000, 1, 100 );
        light.position.set( 0, 0, 1000 );
        webgl.scene.add( light );
        
        return webgl;
    }
    
    // if a WebGLContext object already exists, set it explicitly here.
    export function setWebGL(scene:THREE.Scene, camera:THREE.Camera, renderer:THREE.Renderer, canvas){
        webgl = new WebGLContext();
        webgl.camera = camera;
        webgl.scene = scene;
        webgl.renderer = renderer;
    }
    
    
    
        
    ///////////////////////////
    /// SELECTIONS          ///
    ///////////////////////////


    // creates new data binding 
    export function selectAll():DataBinding{
        var q = new d3webgl.DataBinding();
        webgl.dataBindings.push(q)
        return q;
    }
    
    
    // Data Binding class that maps data objects
    // in an array to visual objects on the 
    // screen.
    // There are two ways to manage visual objects: 
    // 1. Directly by instantiating one THREE.js object 
    // per data element. This was simplest to implement 
    // in the first place but is not very performant. 
    // 2. In-directly by creating one THREE.js buffer geometry
    // and do the rendering through shaders. This is currently 
    // only implemented for the shape 'circle'. 
    export class DataBinding{
        
        // data elements in this binding
        dataElements:Object[] = [];

        // Visual objects, one for every data objects
        // when shaders are used, only one mesh is necessary
        // to represent this data binding (see below)
        visualElements:Object[] = [];

        // single mesh representing this data bining, 
        // if shape implements shader 
        mesh:THREE.Mesh;
        
        // scene, this mesh or visual objects are attached to.
        scene:THREE.Scene;

        // event handler call-back functions
        mouseOverHandler:Function;
        mouseMoveHandler:Function;
        mouseOutHandler:Function;
        mouseDownHandler:Function;
        mouseUpHandler:Function;
        clickHandler:Function;

        // Attribute arrays storing one value per data objects 
        // These attributes are neccessary only when working 
        // with shaders. Otherwise, the attributes are stored
        // with each THREE object (one per data object).
        x:number[] = [];
        y:number[] = [];
        z:number[] = [];
        r:number[] = [];

        // Arrays with style values (also for shaders)
        fill:number[] = [];
        stroke:number[] = [];
        strokewidth:number[] = [];
        opacity:number[] = []

        // stores the type of shape for this data binding, 
        // e.g. 'circle', 'line', etc.
        shape:string;

        // flag is set when visual attributes have changed.
        updateAttributes:boolean = false
        // flag is set when visual style has changed.
        updateStyle:boolean = false

        // flag to indicate that this databining uses a shader. 
        // Progressively, all visual objects should use shaders.
        IS_SHADER:boolean = false
              
        // CONSTRUCTOR
        constructor(){
            this.scene = webgl.scene;
        }
        

        // assigns data objects
        data(arr:Object[]):DataBinding{
            this.dataElements = arr.slice(0);
            return this;
        }
        
        // assings a type of visual object to this data binding 
        // and initializes one default instance of these objects
        // for each data object.                
        append(shape:string):DataBinding{
            var elements = []
            switch(shape){
                case 'circle': createCirclesWithBuffers(this, this.scene); break
                case 'path': elements = createPaths(this.dataElements, this.scene); break
                case 'line': elements = createLines(this.dataElements, this.scene); break
                case 'rect': elements = createRectangles(this.dataElements, this.scene); break
                case 'text': elements = createWebGLText(this.dataElements, this.scene); break
                case 'polygon': elements = createPolygons(this.dataElements, this.scene); break
                default: console.error('Shape', shape, 'does not exist.')     
            }

            // init position arrays if not shader
            if(!this.IS_SHADER){
                for(var i=0 ; i <elements.length ; i++){
                    this.x.push(0);
                    this.y.push(0);
                    this.z.push(0);
                }
            }

            this.shape = shape;
            this.visualElements = elements;
            return this;
        }

        push(e:any):DataBinding{
            this.dataElements.push(e);
            return this;
        }

        // returns the i-th data object        
        getData(i:any):any{
            return this.dataElements[this.visualElements.indexOf(i)];
        }

        // returns the i-th visual object (if no-shader)
        getVisual(i:any):any{
            return this.visualElements[this.dataElements.indexOf(i)];
        }
        
        // returns number of data elements in this binding.
        get length(){
            return this.dataElements.length;
        }

        // returns only those data elements that return 
        // true in the passed function f. f gets passed 
        // two parameters: d, and i. d is the data object
        // and i the index of d in this array of data objects.        
        filter(f:Function):DataBinding{
            var arr=[];
            var visArr = []
            for(var i=0 ; i<this.dataElements.length ; i++){
                if(f(this.dataElements[i], i)){
                    arr.push(this.dataElements[i])
                    visArr.push(this.visualElements[i])
                }
            }
            var q = new DataBinding()
                .data(arr);
            q.visualElements = visArr;
            return q;
        }

        // Assigns a geometric attribute
        // v can be of two types: 
        // a) a scalar value, which is assigned to all 
        // visual elemnts in this binding. 
        // b) a function, which is executed for each 
        // data object/visual object individually.
        // If v is a function f, f gets passed two parameters:
        // the data object d and the data object's index i.
        attr(name:string, v:any):DataBinding{
            var l = this.visualElements.length;
            if(this.IS_SHADER){
                for(var i=0 ; i < this.dataElements.length ; i++){
                    this[name][i] = v instanceof Function?v(this.dataElements[i], i):v
                }
            }else{
                for(var i=0 ; i <l ; i++){ 
                    this.setAttr(this.visualElements[i], name, v instanceof Function?v(this.dataElements[i], i):v, i);
                    if(this.visualElements[i].hasOwnProperty('wireframe')){
                        this.setAttr(this.visualElements[i].wireframe, name, v instanceof Function?v(this.dataElements[i], i):v, i);                        
                    }
                }
            }
            this.updateAttributes = true;
            return this;
        }

        // Assigns a geometric attribute
          // v can be of two types: 
        // a) a scalar value, which is assigned to all 
        // visual elemnts in this binding. 
        // b) a function, which is executed for each 
        // data object/visual object individually.
        // If v is a function f, f gets passed two parameters:
        // the data object d and the data object's index i.
        style(name:string, v:any):DataBinding{
            var l = this.visualElements.length;
            if(this.IS_SHADER){
                name = name.replace('-','');
                for(var i=0 ; i < this.dataElements.length ; i++){
                    this[name][i] = v instanceof Function?v(this.dataElements[i], i):v
                }
            }else{
                for(var i=0 ; i<l ; i++){ 
                    setStyle(this.visualElements[i], name, v instanceof Function?v(this.dataElements[i], i):v, this);
                }
            }
            this.updateStyle = true;
            return this;
        }

        // Interally called after all visual attributes have been specified.
        // Method passes updated values to the shader. 
        set():DataBinding{
            if(!this.IS_SHADER)
                return this;
                
            var l = this.visualElements.length;
            var vertexPositionBuffer = []
            var vertexColorBuffer = []
            var c
            if(this.shape == 'circle'){
                for(var i=0 ; i < this.dataElements.length ; i++){
                    c = new THREE.Color(this.fill[i])
                    addBufferedCirlce(vertexPositionBuffer, this.x[i],this.y[i], this.z[i], this.r[i] , vertexColorBuffer, [c.r, c.g, c.b, this.opacity[i]])
                }
            }
            var geometry = this.mesh.geometry;
            geometry.addAttribute('position', new THREE.BufferAttribute(makeBuffer3f(vertexPositionBuffer), 3));
            geometry.addAttribute('customColor', new THREE.BufferAttribute(makeBuffer4f(vertexColorBuffer), 4));
            geometry.needsUpdate = true;
            geometry.verticesNeedUpdate = true;
            this.mesh.material.needsUpdate = true;
            
            this.updateAttributes = false;
            this.updateStyle = false;

            return this;
        }
        
        // Sets the text string for a text element.
        text(v:any):DataBinding{
            var l = this.visualElements.length;
            for(var i=0 ; i<l ; i++){ 
                this.visualElements[i]['text'] = v instanceof Function ? v(this.dataElements[i], i) : v
                if(this.visualElements[i]['text'] == undefined)
                    continue;
                setText(this.visualElements[i], this.visualElements[i]['text']);
            }
            return this;
        }
        
        // Internal function to set an attribute for one 
        // visual object (if no-shader).
        setAttr(element:THREE.Mesh, attr:string, v:any, index:number){ 
            switch(attr){
                case 'x': element.position.x = v; this.x[index] = v; break;
                case 'y': element.position.y = v; this.y[index] = v; break;
                case 'z': element.position.z = v; this.z[index] = v; break;
                case 'x1': setX1(element, v); break; // lines only
                case 'y1': setY1(element, v); break; // lines only
                case 'x2': setX2(element, v); break; // lines only
                case 'y2': setY2(element, v); break; // lines only
                case 'r': element.scale.set(v,v,v); break; // circles only
                case 'width': element.scale.setX(v); break;
                case 'height': element.scale.setY(v); break;        
                case 'depth': element.scale.setZ(v); break;
                case 'd': createPath(element, v); break;
                case 'points': createPolygon(element, v); break;
                case 'rotation': element.rotation.z = v * Math.PI / 180; break;
                case 'scaleX': element.scale.x = v; break;
                case 'scaleY': element.scale.y = v;  break;
                default: console.error('Attribute', attr, 'does not exist.')     
            }
            element.geometry.verticesNeedUpdate = true;
            element.geometry.elementsNeedUpdate = true;
            element.geometry.lineDistancesNeedUpdate = true;
        }
        
        removeAll(){
            for(var i=0 ; i <this.visualElements.length ; i++){ 
                if(this.visualElements[i].wireframe)
                    this.scene.remove(this.visualElements[i].wireframe)
                this.scene.remove(this.visualElements[i]);
            }
        }

        // Assign event handlers 
        on(event:string, f:Function):DataBinding{
            switch(event){
                case 'mouseover': this.mouseOverHandler = f; break;
                case 'mousemove': this.mouseMoveHandler = f; break;
                case 'mouseout': this.mouseOutHandler = f; break;                 
                case 'mousedown': this.mouseDownHandler = f; break;
                case 'mouseup': this.mouseUpHandler = f; break;                 
                case 'click': this.clickHandler = f; break;                 
            }
            webgl.interactor.register(this, event);
            return this;
        }        
        
    
    }
    
    
    ////////////////////////
    /// INTERNAL METHODS /// 
    ////////////////////////

    // The following methods are internal convenience method, called from within
    // the DataBinding object, but not visible to the developer. 
    // Some of the following methods may vanish as the library moves
    // entirly to using shaders.


    // SET ATTRIBUTE AND STYLE
    
    function setStyle(element:any, attr:string, v:any, dataBinding:DataBinding){ 
        switch(attr){
            case 'fill': 
                if(dataBinding.shape == 'text')
                    setText(element, element['text'], {color:v})
                else
                    element.material.color = new THREE.Color(v); 
                break;
            case 'stroke': 
                if(element.hasOwnProperty('wireframe')){
                    element.wireframe.material.color = new THREE.Color(v);                                        
                } else{
                    element.material.color = new THREE.Color(v);
                }
                break;
            case 'opacity': 
                element.material.opacity = v;
                if(element.hasOwnProperty('wireframe')) element.wireframe.material.opacity = v; 
                break;
            case 'stroke-width': 
                 if(element.hasOwnProperty('wireframe'))
                    element.wireframe.material.linewidth = v;                                        
                 else
                     element.material.linewidth = v; 
                 break;
            case 'font-size': 
                element.scale.x = v/30; 
                element.scale.y = v/30;         
                element.geometry.verticesNeedUpdate = true;
                break;
            default: console.error('Style', attr, 'does not exist.')     
        }
        element.material.needsUpdate=true; 
        if(element.hasOwnProperty('wireframe'))
            element.wireframe.material.needsUpdate=true; 
    }

    function setText(mesh:any, text:string, parConfig?:Object){
        var config = parConfig;            
        if(config == undefined){
            config = {};
        }
        if(config.color == undefined)        
           config.color = '#000000'

        mesh['text'] = text;
        var backgroundMargin = 10;
        var txtCanvas = document.createElement("canvas");
        
        var context = txtCanvas.getContext("2d");

        var SIZE = 30;
        context.font = SIZE + "pt Helvetica";
        var WIDTH = context.measureText(text).width;
        txtCanvas.width = WIDTH;
        txtCanvas.height = SIZE;

        context.textAlign = "left"; 
        context.textBaseline = "middle";
        context.fillStyle = config.color;
        context.font = SIZE + "pt Helvetica";
        // context.clearColor(1.0, 1.0, 0.0, 1.0)
        // context.clear(gl.COLOR_BUFFER_BIT)
        context.fillText(text, 0, txtCanvas.height / 2);
    
        var tex = new THREE.Texture(txtCanvas);
        tex.minFilter = THREE.LinearFilter
        tex.flipY = true;
        tex.needsUpdate = true;

        mesh.material.map = tex;
        mesh.material.transparent = true;
        mesh.material.needsUpdate = true;
        
        // adjust mesh geometry
        mesh.geometry = new THREE.PlaneGeometry(WIDTH, SIZE);
        mesh.geometry.needsUpdate = true;
        mesh.geometry.verticesNeedUpdate = true;
        mesh.needsUpdate = true;

    }


    function setX1(mesh:THREE.Line, v){
        mesh.geometry.vertices[0].x = v
    }
    function setY1(mesh:THREE.Line, v){
        mesh.geometry.vertices[0].y = v
    }
    function setX2(mesh:THREE.Line, v){
        mesh.geometry.vertices[1].x = v
    }
    function setY2(mesh:THREE.Line, v){
        mesh.geometry.vertices[1].y = v
    }
    
    
    /// CREATE SHAPES

    // not used nor tested: stub    
    function createG(dataElements:any[], scene:THREE.Scene){
        var visualElements = []
        // create group element for every data element
        for(var i=0 ; i<dataElements.length ; i++){
            visualElements.push(new GroupElement());
        }
        return visualElements;
    }

    // group element representing the 'g' element in D3.
    class GroupElement{
        position = {x: 0, y:0, z: 0};
        children:Object = [];
    }


    ///////////////        
    /// SHADERS ///
    ///////////////        

    /// CIRCLES

    var vertexShaderProgram = "\
        attribute vec4 customColor;\
        varying vec4 vColor;\
        void main() {\
            vColor = customColor;\
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1 );\
        }";


    var fragmentShaderProgram = "\
        varying vec4 vColor;\
        void main() {\
            gl_FragColor = vec4(vColor[0], vColor[1], vColor[2], vColor[3]);\
        }";

    // Creates circles through one geomery per data binding 
    // and shaders.
    function createCirclesWithBuffers(dataBinding:DataBinding, scene:THREE.Scene){
        var dataElements = dataBinding.dataElements;
        dataBinding.IS_SHADER = true;     
        var attributes = {
            customColor: { type: 'c', value: [] }
        }
        var shaderMaterial: THREE.ShaderMaterial = new THREE.ShaderMaterial({
            attributes: attributes,
            vertexShader: vertexShaderProgram,
            fragmentShader: fragmentShaderProgram,
            linewidth: 2
        });
        shaderMaterial.blending = THREE.NormalBlending;
        shaderMaterial.depthTest = true;
        shaderMaterial.transparent = true;
        shaderMaterial.side = THREE.DoubleSide;
        
        var visualElements = []
        var c;   
        var vertexPositionBuffer = []
        var vertexColorBuffer = []
        var geometry = new THREE.BufferGeometry();
        // geometry.vertices.push(new THREE.Vector3(10, -10,0))
        addBufferedRect([], 0, 0, 0, 10, 10, [], [0,0,1,.5])

        for(var i=0 ; i < dataElements.length ; i++){
            // addBufferedCirlce(vertexPositionBuffer, Math.random()*10,Math.random()*10,0,2, vertexColorBuffer, [0,0,1,.5] )
            dataBinding.x.push(0)
            dataBinding.y.push(0)
            dataBinding.z.push(0)
            dataBinding.r.push(0)
            dataBinding.fill.push('0x000000')
            dataBinding.stroke.push('0x000000')
            dataBinding.strokewidth.push(1)
            dataBinding.opacity.push(1)
        }
        // geometry = new THREE.BufferGeometry();

        // CREATE + ADD MESH
        geometry.addAttribute('position', new THREE.BufferAttribute(makeBuffer3f([]), 3));

        geometry.addAttribute('customColor', new THREE.BufferAttribute(makeBuffer4f([]), 4));
        dataBinding.mesh = new THREE.Mesh(geometry, shaderMaterial);
        dataBinding.mesh.position.set(0,0,1)
        
        scene.add(dataBinding.mesh);
        return dataBinding;
    }




    // create rectangles (no shaders)    
    function createRectangles(dataElements:any[], scene:THREE.Scene){
        var material;
        var geometry;
        var visualElements = []
        var c;   
        for(var i=0 ; i < dataElements.length ; i++){
            var rectShape = new THREE.Shape();
            rectShape.moveTo( 0, 0 );
            rectShape.lineTo( 0, -1 );
            rectShape.lineTo( 1, -1 );
            rectShape.lineTo( 1, 0 );
            rectShape.lineTo( 0, 0 );

            geometry = new THREE.ShapeGeometry( rectShape );
            c = new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( {color:0x000000, transparent:true} ) ) ;
            c.position.set(0,0,1)
            visualElements.push(c);
            scene.add( c );
                
            geometry = new THREE.Geometry()
            geometry.vertices.push(
                new THREE.Vector3(0,0,0),
                new THREE.Vector3(0,-1,0),
                new THREE.Vector3(1,-1,0),
                new THREE.Vector3(1,0,0),
                new THREE.Vector3(0,0,0)
            );
            var wireframe = new THREE.Line( geometry, new THREE.LineBasicMaterial( {color:0x000000, transparent:true, linewidth:1}) ) ;            
            c['wireframe'] = wireframe;
            wireframe.position.set(0,0,1.1)
            scene.add(wireframe);
        }
        return visualElements;
    }

    // create paths (no shaders)    
    function createPaths(dataElements:any[], scene:THREE.Scene){
        var material;
        var geometry;
        var visualElements = []
        var c,p;   
        for(var i=0 ; i < dataElements.length ; i++){
            geometry = new THREE.Geometry();
            c = new THREE.Line( geometry, new THREE.LineBasicMaterial( {color:0x000000, transparent:true} ) ) ;
            c.position.set(0,0,0)
            visualElements.push(c);
            scene.add( c );
        }
        return visualElements;      
    }

    // create polygons (no shaders)    
    function createPolygons(dataElements:any[], scene:THREE.Scene){
        var material;
        var geometry;
        var visualElements = []
        var c,p;   
        for(var i=0 ; i < dataElements.length ; i++){
            geometry = new THREE.Geometry();
            // geometry.vertices.push(
            //     new THREE.Vector3(5, 0, 0 ),
            //     new THREE.Vector3( 15, 3, 0 ),
            //     new THREE.Vector3( 15, -3, 0 )
            // );
            // geometry.faces.push(new THREE.Face3(0, 1, 2)); 
            c = new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( {color:0x000000, transparent:true, side:THREE.DoubleSide })) ;
            c.doubleSided = true;
            c.position.set(0,0,0)
            visualElements.push(c);
            scene.add( c );
        }
        return visualElements;      
    }

    // create lines (no shaders)    
    function createLines(dataElements:any[], scene:THREE.Scene){
        var material;
        var geometry;
        var visualElements = []
        var c,p;   
        for(var i=0 ; i < dataElements.length ; i++){
            geometry = new THREE.Geometry();
            geometry.vertices.push(
                new THREE.Vector3( -10, 0, 0 ),
                new THREE.Vector3( 0, 10, 0 ));
            c = new THREE.Line( geometry, new THREE.LineBasicMaterial( {color:0x000000, transparent:true} ) ) ;
            c.position.set(0,0,0)
            visualElements.push(c);
            scene.add( c );
        }
        return visualElements;      
    }
    
    // create text (no shaders)    
    function createWebGLText(dataElements:any[], scene:THREE.Scene){
        var visualElements = []
        var mesh;
        for(var i=0 ; i < dataElements.length ; i++){
            mesh = new THREE.Mesh(new THREE.PlaneGeometry(1000, 100), new THREE.MeshBasicMaterial());
            mesh.doubleSided = true;
            visualElements.push(mesh);
            scene.add(mesh);        
        }
        return visualElements;     
    }
    
    // internal function for creating single path (no shaders)    
    function createPath(mesh:THREE.Line, points:Object[]){
        mesh.geometry.vertices = []
        for(var i=0 ; i < points.length ; i++){
            mesh.geometry.vertices.push(new THREE.Vector3(points[i].x ,points[i].y, 0));
        }
        mesh.geometry.verticesNeedUpdate = true;
    }
    
    
    // internal function for creating single polygon (no shaders)    
    function createPolygon(mesh:THREE.Mesh, points:Object[]){
        var vectors = []
        var shape = new THREE.Shape(points);
        mesh.geometry = new THREE.ShapeGeometry(shape);
        mesh.geometry.verticesNeedUpdate = true;
    }




    ///////////////////
    /// INTERACTION /// 
    ///////////////////


    // Convenience object handling all kinds of interaction
    export class WebGLInteractor{
        scene;
        canvas;
        camera
        raycaster;
        mouse = [];
        mouseStart = []
        mouseDown:boolean = false;
        cameraStart = []
        panOffset = []
        lastIntersectedSelections = []
        lastIntersectedElements = []
        isPanEnabled = true;
        isHorizontalPanEnabled = true;
        
        isLassoEnabled = true;
        lassoPoints = []
        lassoStartHandler:Function;
        lassoMoveHandler:Function;
        lassoEndHandler:Function;

        mouseOverSelections:DataBinding[] = []
        mouseMoveSelections:DataBinding[] = []
        mouseOutSelections:DataBinding[] = []
        mouseDownSelections:DataBinding[] = []
        mouseUpSelections:DataBinding[] = []
        clickSelections:DataBinding[] = []
        
        constructor(scene:THREE.Scene, canvas:HTMLCanvasElement, camera:THREE.Camera){
            this.scene = scene;
            this.canvas = canvas
            this.camera = camera;
            this.mouse = [0,0];
            canvas.addEventListener('mousemove', (e) => {
                this.mouseMoveHandler(e);
            })
            canvas.addEventListener('mousedown', (e) => {
                this.mouseDownHandler(e);
            })
            canvas.addEventListener('mouseup', (e) => {
                this.mouseUpHandler(e);
            })
            canvas.addEventListener('click', (e) => {
                this.clickHandler(e);
            })

            // not really working in iFrames.. needs fix 
            // window.addEventListener('keyDown', (e)=>{
            //     this.keyDownHandler(e);
            // })
            // window.addEventListener('keyUp', (e)=>{
            //     this.keyUpHandler(e);
            // })
        }
        
        register(selection:DataBinding, method:string){
            switch(method){
                case 'mouseover': this.mouseOverSelections.push(selection); break;
                case 'mousemove': this.mouseMoveSelections.push(selection); break;
                case 'mouseout': this.mouseOutSelections.push(selection); break;
                case 'mousedown': this.mouseDownSelections.push(selection); break;
                case 'mouseup': this.mouseUpSelections.push(selection); break;
                case 'click': this.clickSelections.push(selection); break;
            }
        }

        addEventListener(eventName:String, f:Function){
            if(eventName == 'lassoStart')
                this.lassoStartHandler = f;
            if(eventName == 'lassoEnd')
                this.lassoEndHandler = f;
            if(eventName == 'lassoMove')
                this.lassoMoveHandler = f;
        }
        

        // Event handlers
        mouseMoveHandler(e){
            this.mouse = mouseToWorldCoordinates(e.clientX, e.clientY)
            
            if(this.isLassoEnabled && e.which == 2){
                this.lassoPoints.push(this.mouse)
                if(this.lassoMoveHandler)
                    this.lassoMoveHandler(this.lassoPoints);
            }else{
                var intersectedVisualElements:any[] = []
                
                // remove previous highlighting
                for(var i = 0 ; i < this.lastIntersectedSelections.length ; i++){
                    for(var j = 0 ; j < this.lastIntersectedElements[i].length ; j++){
                        this.lastIntersectedSelections[i].call('mouseout', this.lastIntersectedElements[i][j])
                    }
                }
                
                this.lastIntersectedSelections = []
                this.lastIntersectedElements = []

                var nothingIntersected = true;
                
                // call mouseover on all elements with a mouse over handler
                for(var i = 0 ; i < this.mouseOverSelections.length ; i++){
                    // If selecton is SHADER, check manually
                    intersectedVisualElements = this.intersect( this.mouseOverSelections[i], this.mouse[0], this.mouse[1]);
                    if(intersectedVisualElements.length > 0){
                        this.lastIntersectedElements.push(intersectedVisualElements);
                        this.lastIntersectedSelections.push(this.mouseOverSelections[i])
                    }
                    for(var j = 0 ; j < intersectedVisualElements.length ; j++){
                        this.mouseOverSelections[i].call('mouseover',intersectedVisualElements[j], e)
                    }
                    if(intersectedVisualElements.length > 0)
                        nothingIntersected = false;    
                }
                
                // call mousemove on all elements with a mouse move handler
                for(var i = 0 ; i < this.mouseMoveSelections.length ; i++){
                    intersectedVisualElements = this.intersect( this.mouseMoveSelections[i], this.mouse[0], this.mouse[1]);
                    // console.log('intersectedVisualElements', intersectedVisualElements, this.mouseMoveSelections[i])
                    for(var j = 0 ; j < intersectedVisualElements.length ; j++){
                        this.mouseMoveSelections[i].call('mousemove',intersectedVisualElements[j], e)
                    }
                    if(intersectedVisualElements.length > 0)
                        nothingIntersected  = false;    
                }

                // if nothing intersected pan:
                if(nothingIntersected && this.mouseDown){
                    if(this.isPanEnabled){
                        this.panOffset = [e.clientX - this.mouseStart[0], e.clientY - this.mouseStart[1]]
                        if(this.isHorizontalPanEnabled) 
                        webgl.camera.position.x = this.cameraStart[0] - this.panOffset[0]/webgl.camera.zoom;
                        webgl.camera.position.y = this.cameraStart[1] + this.panOffset[1]/webgl.camera.zoom;
                        webgl.render();    
                    }
                }
            }
            


        }
        clickHandler(e){
            this.mouse = mouseToWorldCoordinates(e.clientX, e.clientY)

            var intersectedVisualElements:any[] = []
            
            // call mouseclick on all elements with a mouse over handler
            for(var i = 0 ; i < this.clickSelections.length ; i++){
                intersectedVisualElements = this.intersect( this.clickSelections[i], this.mouse[0], this.mouse[1]);
                for(var j = 0 ; j < intersectedVisualElements.length ; j++){
                    this.clickSelections[i].call('click',intersectedVisualElements[j], e)
                }
            }
            this.mouseDown = false;
        }
        
        mouseDownHandler(e){
            this.mouse = mouseToWorldCoordinates(e.clientX, e.clientY)
            this.mouseStart= [e.clientX, e.clientY]
            this.cameraStart = [webgl.camera.position.x, webgl.camera.position.y];
            this.mouseDown = true;
            var intersectedVisualElements:any[] = []
            for(var i = 0 ; i < this.mouseDownSelections.length ; i++){
                intersectedVisualElements = this.intersect( this.mouseDownSelections[i], this.mouse[0], this.mouse[1]);
                for(var j = 0 ; j < intersectedVisualElements.length ; j++){
                    this.mouseDownSelections[i].call('mousedown',intersectedVisualElements[j], e)
                }
            }
            this.lassoPoints = []
            this.lassoPoints.push(this.mouse)
            if(this.lassoStartHandler && e.which == 2){
                this.lassoStartHandler(this.lassoPoints);
            }
        }
        mouseUpHandler(e){
            this.mouse = mouseToWorldCoordinates(e.clientX, e.clientY)
            var intersectedVisualElements:any[] = []
            for(var i = 0 ; i < this.mouseUpSelections.length ; i++){
                intersectedVisualElements = this.intersect( this.mouseUpSelections[i], this.mouse[0], this.mouse[1]);
                for(var j = 0 ; j < intersectedVisualElements.length ; j++){
                    this.mouseUpSelections[i].call('mouseup',intersectedVisualElements[j], e)
                }
            }
            this.mouseDown = false;
            if(this.lassoEndHandler && e.which == 2){
                this.lassoEndHandler(this.lassoPoints);
            }
        }
                

        // Tests for mouse intersection of any of the visual objects in 
        // the passed data binding.
        // Returns list of data elements. 
        intersect(selection:DataBinding, mousex, mousey):any[]{
            switch(selection.shape){
                case 'circle': return this.intersectCircles(selection);
                case 'rect': return this.intersectRects(selection); 
                case 'path': return this.intersectPaths(selection); 
                case 'text': return this.intersectRects(selection);
            }
            return []    
        }
        
        intersectCircles(selection:DataBinding):any[]{
            var intersectedElements = []
            var d;
            for(var i = 0 ; i < selection.dataElements.length ; i++){
                d = Math.sqrt(Math.pow(this.mouse[0] - selection.x[i], 2) + Math.pow(this.mouse[1] - selection.y[i], 2))
                if(d <= selection.r[i])  
                    intersectedElements.push(selection.dataElements[i]);
            }
      
            return intersectedElements;
        }

        intersectRects(selection:DataBinding):any[]{
            var intersectedElements = []
            var d;
            var e;
            for(var i = 0 ; i < selection.visualElements.length ; i++){
                e = selection.visualElements[i];
                if(this.mouse[0] >= e.position.x && this.mouse[0] <= e.position.x + e.geometry.vertices[0].x *e.scale.x
                && this.mouse[1] <= e.position.y && this.mouse[1] >= e.position.y + e.geometry.vertices[1].y *e.scale.y
                )
                    intersectedElements.push(selection.dataElements[i]);
            }
            return intersectedElements;
        }

        intersectPaths(selection:DataBinding):any[]{
            var intersectedElements = []
            var e;
            var v1, v2
            var x, y
            var found = false
            for(var i = 0 ; i < selection.visualElements.length ; i++){
                e = selection.visualElements[i];
                for(var j = 1 ; j < e.geometry.vertices.length ; j++){
                    v1 = e.geometry.vertices[j-1] 
                    v1 = {x: v1.x + selection.x[i],
                          y: v1.y + selection.y[i]
                    }
                    v2 = e.geometry.vertices[j]
                    v2 = {x: v2.x + selection.x[i],
                          y: v2.y + selection.y[i]
                    }
                    if(distToSegmentSquared({x: this.mouse[0], y:this.mouse[1]}, v1, v2) < 3){
                        intersectedElements.push(selection.dataElements[i]);  
                        found = true;               
                        break;    
                    }
                }
                if(found) 
                    break;
            }
      
            return intersectedElements;
            
            function sqr(x) { 
                return x * x 
            }
            function dist2(v, w) { 
                return sqr(v.x - w.x) + sqr(v.y - w.y) 
            }
            function distToSegmentSquared(p, v, w) {
                var l2 = dist2(v, w);
                    
                if (l2 == 0) return dist2(p, v);
                    
                var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
                    
                if (t < 0) return dist2(p, v);
                if (t > 1) return dist2(p, w);
                    
                return dist2(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
            }

            function distToSegment(p, v, w) { 
                return Math.sqrt(distToSegmentSquared(p, v, w));
            }
        }
        
        
    }
    
    // Converts mouse screen coordinates to world coordinates in webgl.
    export function mouseToWorldCoordinates(mouseX, mouseY){
        var rect = webgl.canvas.getBoundingClientRect();
        var x = webgl.camera.position.x + webgl.camera.left/webgl.camera.zoom + ( mouseX - rect.left)/webgl.camera.zoom;
        var y = webgl.camera.position.y + webgl.camera.top/webgl.camera.zoom - ( mouseY - rect.top)/webgl.camera.zoom;            // this.mouse[1] *= -1
        return [x,y];
    }

    
    // Returns a smooth B-spline for the passed points..
    export function curve(points:any[]):any[]{
        var arrayPoints = []
        for(var i=0 ; i<points.length ; i++){
            if(!isNaN(points[i].x))
                arrayPoints.push([points[i].x, points[i].y])
        }
        
        var spline = new BSpline(arrayPoints,3); //making BSpline
        var curvePoints = []
        for(var t = 0 ; t <= 1 ; t+=0.01){
            var p = spline.calcAt(t); 
            curvePoints.push({x:p[0], y:p[1]})
        }
        return curvePoints;
    }
    



    ///////////////////
    /// UI ELEMENTS ///
    ///////////////////

    export class CheckBox{
        selected = false;
        changeCallBack:Function;
        circle;
        frame;

        constructor(){
            this.frame = selectAll()
                .data([0])
                .append('circle')
                    .attr('r', 5)
                    .style('fill', '#fff')
                    .style('stroke', '#000000')
                    .on('click', ()=>{
                        this.selected = !this.selected;
                        this.circle.style('opacity', this.selected ? 1 : 0)
                        if(this.changeCallBack != undefined)
                            this.changeCallBack();
                    })
            this.circle = selectAll()
                .data([0])
                // .append('circle')
                //     .attr('r', 3)
                //     .attr('z', 1)
                //     .style('fill', '#000000')
                //     .style('opacity', 0)
        }

        attr(attrName:string, value:any):d3webgl.CheckBox{
            switch(attrName){
                case 'x': 
                    this.frame.attr('x', value); 
                    // this.circle.attr('x', value); 
                    return this;
                case 'y': 
                    this.frame.attr('y', value); 
                    // this.circle.attr('y', value); 
                    return this;
            }    

        }

        on(eventType:string, fn:Function){
            switch(eventType){
                case 'change': this.changeCallBack = fn;
            }    
        }
    }



    //////////////////////////////////
    /// HELPER FUNCTIONS FOR       /// 
    /// CREATING BUFFER GEOMETRIES ///
    //////////////////////////////////
    // Most of the following functions are currently 
    // not used. However, they could be used, when 
    // gradually switching to shaders.

    export function makeAlphaBuffer(array: number[], stretch: number) {
        var buffer: Float32Array = new Float32Array(array.length * stretch); // three components per vertex
        for (var i = 0; i < array.length; i++) {
            for (var j = 0; j < stretch; j++) {
                buffer[i * stretch + j] = array[i];
            }
        }
        return buffer
    }


    export function addBufferedRect(vertexArray: number[][], x: number, y: number, z: number, width: number, height: number, colorArray: number[][], c: number[]) {
        width = width / 2;
        height = height / 2;
        vertexArray.push(
            [x - width, y - height, z],
            [x + width, y - height, z],
            [x + width, y + height, z],
            [x + width, y + height, z],
            [x - width, y + height, z],
            [x - width, y - height, z]
        );
        colorArray.push(
            [c[0], c[1], c[2], c[3]],
            [c[0], c[1], c[2], c[3]],
            [c[0], c[1], c[2], c[3]],
            [c[0], c[1], c[2], c[3]],
            [c[0], c[1], c[2], c[3]],
            [c[0], c[1], c[2], c[3]]
        );
    }

    export function addBufferedCirlce(vertexArray: number[][], x: number, y: number, z: number, radius: number, colorArray: number[][], c: number[]) {
        var segments = 11;
        var angle = Math.PI / (segments / 2)
        for(var i=0 ; i < segments ; i++){
            vertexArray.push(
                [x + Math.cos(i*angle) * radius, y + Math.sin(i*angle) *radius, z],
                [x + Math.cos((i+1)*angle) * radius, y + Math.sin((i+1)*angle) *radius, z],
                [x, y, z]
            )
            colorArray.push(
                [c[0], c[1], c[2], c[3]],
                [c[0], c[1], c[2], c[3]],
                [c[0], c[1], c[2], c[3]]
            )  
        }
    }

    export function addBufferedDiamond(vertexArray: number[][], x: number, y: number, z: number, width: number, height: number, colorArray: number[][], c: number[]) {
        width = width / 2;
        height = height / 2;
        vertexArray.push(
            [x - width, y, z],
            [x, y - height, z],
            [x + width, y, z],
            [x + width, y, z],
            [x, y + height, z],
            [x - width, y, z]
        );
        colorArray.push(
            [c[0], c[1], c[2], c[3]],
            [c[0], c[1], c[2], c[3]],
            [c[0], c[1], c[2], c[3]],
            [c[0], c[1], c[2], c[3]],
            [c[0], c[1], c[2], c[3]],
            [c[0], c[1], c[2], c[3]]
        );
    }

    export function createRectFrame(w: number, h: number, color: number, lineThickness: number): THREE.Line {
        w = w / 2
        h = h / 2
        var geom: THREE.Geometry = new THREE.Geometry();
        geom.vertices = [
            new THREE.Vector3(-w, -h, 0),
            new THREE.Vector3(-w, h, 0),
            new THREE.Vector3(w, h, 0),
            new THREE.Vector3(w, -h, 0),
            new THREE.Vector3(-w, -h, 0)
        ]

        var material: THREE.LineBasicMaterial = new THREE.LineBasicMaterial({
            color: color,
            // linewidth: lineThickness,
        });

        return new THREE.Line(geom, material);
    }

    export function createDiagonalCross(w: number, h: number, color: number, lineThickness: number): THREE.Line {
        w = w / 2
        h = h / 2
        var geom: THREE.Geometry = new THREE.Geometry();
        geom.vertices = [
            new THREE.Vector3(-w, -h, 0),
            new THREE.Vector3(-w, h, 0),
            new THREE.Vector3(w, h, 0),
            new THREE.Vector3(w, -h, 0),
            new THREE.Vector3(-w, -h, 0),
            new THREE.Vector3(w, h, 0),
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(-w, h, 0),
            new THREE.Vector3(w, -h, 0)
        ];

        var material: THREE.LineBasicMaterial = new THREE.LineBasicMaterial({
            color: color,
            linewidth: lineThickness,
        });

        return new THREE.Line(geom, material);
    }

    export function makeBuffer3f(array: number[][]): Float32Array {
        var buffer: Float32Array = new Float32Array(array.length * 3); // three components per vertex
        for (var i = 0; i < array.length; i++) {
            buffer[i * 3 + 0] = array[i][0];
            buffer[i * 3 + 1] = array[i][1];
            buffer[i * 3 + 2] = array[i][2];
        }
        return buffer
    }
    export function makeBuffer4f(array: number[][]): Float32Array {
        var buffer: Float32Array = new Float32Array(array.length * 4); // three components per vertex
        for (var i = 0; i < array.length; i++) {
            buffer[i * 4 + 0] = array[i][0];
            buffer[i * 4 + 1] = array[i][1];
            buffer[i * 4 + 2] = array[i][2];
            buffer[i * 4 + 3] = array[i][3];
        }
        return buffer
    }


    export function updateBuffer(buffer: number[], array: number[][], size: number) {
        for (var i = 0; i < array.length; i++) {
            for (var j = 0; j < size; j++) {
                buffer[i * size + j] = array[i][j];
            }
        }
    }
}


//////////////////////////// 
/// EXTERNAL HELPER CODE ///
//////////////////////////// 



// /// http://www.threejsgames.com/extensions/
// var THREEx	= THREEx	|| {}

// //////////////////////////////////////////////////////////////////////////////////
// //		Constructor							//
// //////////////////////////////////////////////////////////////////////////////////

// /**
//  * create a dynamic texture with a underlying canvas
//  * 
//  * @param {Number} width  width of the canvas
//  * @param {Number} height height of the canvas
//  */
// THREEx.DynamicTexture	= function(width, height){
// 	var canvas	= document.createElement( 'canvas' )
// 	canvas.width	= width
// 	canvas.height	= height
// 	this.canvas	= canvas

// 	var context	= canvas.getContext( '2d' )	
// 	this.context	= context
	
// 	var texture	= new THREE.Texture(canvas)
// 	this.texture	= texture
// }

// //////////////////////////////////////////////////////////////////////////////////
// //		methods								//
// //////////////////////////////////////////////////////////////////////////////////

// /**
//  * clear the canvas
//  * 
//  * @param  {String*} fillStyle 		the fillStyle to clear with, if not provided, fallback on .clearRect
//  * @return {THREEx.DynamicTexture}      the object itself, for chained texture
//  */
// THREEx.DynamicTexture.prototype.clear = function(fillStyle){
// 	// depends on fillStyle
// 	if( fillStyle !== undefined ){
// 		this.context.fillStyle	= fillStyle
// 		this.context.fillRect(0,0,this.canvas.width, this.canvas.height)		
// 	}else{
// 		this.context.clearRect(0,0,this.canvas.width, this.canvas.height)		
// 	}
// 	// make the texture as .needsUpdate
// 	this.texture.needsUpdate	= true;
// 	// for chained API 
// 	return this;
// }

// /**
//  * draw text
//  * 
//  * @param  {String}		text	the text to display
//  * @param  {Number|undefined}	x	if provided, it is the x where to draw, if not, the text is centered
//  * @param  {Number}		y	the y where to draw the text
//  * @param  {String*} 		fillStyle the fillStyle to clear with, if not provided, fallback on .clearRect
//  * @param  {String*} 		contextFont the font to use
//  * @return {THREEx.DynamicTexture}	the object itself, for chained texture
//  */
// THREEx.DynamicTexture.prototype.drawText = function(text, x, y, fillStyle, contextFont){
// 	// set font if needed
// 	if( contextFont !== undefined )	this.context.font = contextFont;
// 	// if x isnt provided 
// 	if( x === undefined || x === null ){
// 		var textSize	= this.context.measureText(text);
// 		x = (this.canvas.width - textSize.width) / 2;
// 	}
// 	// actually draw the text
// 	this.context.fillStyle = fillStyle;
// 	this.context.fillText(text, x, y);
// 	// make the texture as .needsUpdate
// 	this.texture.needsUpdate	= true;
// 	// for chained API 
// 	return this;
// };

// THREEx.DynamicTexture.prototype.drawTextCooked = function(text, options){
// 	var context	= this.context
// 	var canvas	= this.canvas
// 	options		= options	|| {}
// 	var params	= {
// 		margin		: options.margin !== undefined ? options.margin	: 0.1,
// 		lineHeight	: options.lineHeight !== undefined ? options.lineHeight : 0.1,
// 		align		: options.align !== undefined ? options.align : 'left',
// 		fillStyle	: options.fillStyle !== undefined ? options.fillStyle : 'black',
// 	}
// 	context.save()
// 	context.fillStyle	= params.fillStyle;

// 	var y	= (params.lineHeight + params.margin)*canvas.height
// 	while(text.length > 0 ){
// 		// compute the text for specifically this line
// 		var maxText	= computeMaxTextLength(text)
// 		// update the remaining text
// 		text	= text.substr(maxText.length)


// 		// compute x based on params.align
// 		var textSize	= context.measureText(maxText);
// 		if( params.align === 'left' ){
// 			var x	= params.margin*canvas.width
// 		}else if( params.align === 'right' ){
// 			var x	= (1-params.margin)*canvas.width - textSize.width
// 		}else if( params.align === 'center' ){
// 			var x = (canvas.width - textSize.width) / 2;
// 		}else	console.assert( false )

// 		// actually draw the text at the proper position
// 		this.context.fillText(maxText, x, y);

// 		// goto the next line
// 		y	+= params.lineHeight*canvas.height
// 	}
// 	context.restore()

// 	// make the texture as .needsUpdate
// 	this.texture.needsUpdate	= true;
// 	// for chained API
// 	return this;

// 	function computeMaxTextLength(text){
// 		var maxText	= ''
// 		var maxWidth	= (1-params.margin*2)*canvas.width
// 		while( maxText.length !== text.length ){
// 			var textSize	= context.measureText(maxText);
// 			if( textSize.width > maxWidth )	break;
// 			maxText	+= text.substr(maxText.length, 1)
// 		}
// 		return maxText
// 	}
// }

// /**
//  * execute the drawImage on the internal context
//  * the arguments are the same the official context2d.drawImage
//  */
// THREEx.DynamicTexture.prototype.drawImage	= function(/* same params as context2d.drawImage */){
// 	// call the drawImage
// 	this.context.drawImage.apply(this.context, arguments)
// 	// make the texture as .needsUpdate
// 	this.texture.needsUpdate	= true;
// 	// for chained API 
// 	return this;
// }





// //////////////////
// /// VECTOR OPS ///
// //////////////////
// module geometry{
    
//     export function length(v1){
//         return Math.sqrt(v1[0]*v1[0] + v1[1]*v1[1]);
//     }

//     export function normalize(v:number[]){
//         var l = length(v)
//         return [v[0]/l, v[1]/l]        
//     }
    
//     export function setLength(v:number[], l:number){
//         var len = length(v)
//         return [l*v[0]/len, l*v[1]/len]        
//     }
    
    
// }

