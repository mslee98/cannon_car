import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import CannonDebugRenderer from 'cannon-es-debugger'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
// import { Geometry } from 'three/examples/jsm/d'

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

class Game {
    constructor() {
        this.container;
		// this.stats;
		this.camera;
		this.scene;
		this.renderer;
		// this.debug = true;
		// this.debugPhysics = true;
		this.fixedTimeStep = 1.0/60.0;
        
		
		const game = this;
		
		this.js = { forward:0, turn:0 };
		this.clock = new THREE.Clock();
        this.oldElapsedTime = 0;

        this.gltfLoader = new GLTFLoader();


		this.init();
        
    }
    
    init() {
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1 ,1000);
        
        this.renderer = new THREE.WebGLRenderer()
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
        
        // this.helper = new CannonHelper(this.scene);
        // this.helper.addLights(this.renderer);

        document.body.appendChild(this.renderer.domElement);

        // this.joystick = new Joystick({
        //     game: this,
        //     onMove: this.joystickCallback
        // });

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);

        this.camera.position.z = 10;
        this.camera.position.y = 3;

        this.ambientLight = new THREE.AmbientLight(0xffffff, 1);
        this.scene.add(this.ambientLight);

        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        this.scene.add(this.directionalLight);

        
        //테스트용 차체임
        this.threeChassisBody = new THREE.Mesh(
            new THREE.BoxGeometry(5,0.5,4),
            new THREE.MeshBasicMaterial({'color':'gray'})
        )
        this.threeChassisBody.rotation.y = -Math.PI / 2
            
        this.scene.add(this.threeChassisBody)
            
        this.carPivot = new THREE.Object3D();
        // this.carPivot.position.set(5,5,5)
        this.carPivot.add(this.threeChassisBody);
        this.scene.add(this.carPivot);

        this.cameraPivot = new THREE.Object3D();
        // this.cameraPivot.position.set(0, 0, 0);
        this.cameraPivot.rotation.y = Math.PI;

        this.carPivot.add(this.cameraPivot)
        
        this.cameraPivot.add(this.camera)

        this.initPhysics();

        window.addEventListener('resize', this.resize.bind(this))
    }

    initPhysics() {
        const game = this;

        //물리엔진 월드 생성
        const world = new CANNON.World();
        this.world = world;
        // this.damping = 0.01;

        world.broadphase = new CANNON.SAPBroadphase(world);
        
        // //중력 설정
        world.gravity.set(0, -9.8, 0);
        // world.defaultContactMaterial.friction = 0.2;

        //이거 빠짐
        this.debugRenderer = new CannonDebugRenderer(this.scene, this.world);

        
        const groundMaterial = new CANNON.Material("groundMaterial");
        const wheelMaterial = new CANNON.Material("wheelMaterial");
        
        const wheelGroundContactMaterial = new CANNON.ContactMaterial(
            wheelMaterial,
            groundMaterial,
            {
                friction: 0.3,//마찰력
                restitution: 0,//반발벽
                contactEquationStiffness: 1000 //생성된 접촉 방정식의 강성
            }
        )
        world.addContactMaterial(wheelGroundContactMaterial);
            
        // Add the ground
        const sizeX = 64
        const sizeZ = sizeX
        const matrix = []
        for (let i = 0; i < sizeX; i++) {
          matrix.push([])
          for (let j = 0; j < sizeZ; j++) {
            if (i === 0 || i === sizeX - 1 || j === 0 || j === sizeZ - 1) {
              const height = 6
              matrix[i].push(height)
              continue
            }

            const height = Math.sin((i / sizeX) * Math.PI * 7) * Math.sin((j / sizeZ) * Math.PI * 7) * 6 + 6
            matrix[i].push(height)
          }
        }

        const heightFieldShape = new CANNON.Heightfield(matrix, {
            elementSize: 300/ sizeX
        });

        const heightFieldBody = new CANNON.Body({mass: 0, material: groundMaterial})
        heightFieldBody.addShape(heightFieldShape);
        heightFieldBody.position.set(
            (-(sizeX - 1) * heightFieldShape.elementSize) / 2,
            -15,
            ((sizeZ - 1) * heightFieldShape.elementSize) / 2
        )

        heightFieldBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        world.addBody(heightFieldBody)


        
        /** 물리엔진 - 차체 생성 */
        const chassisShape = new CANNON.Box(new CANNON.Vec3(2.5, 0.25, 2));
        const chassisBody = new CANNON.Body({
            mass: 150,
            shape: chassisShape,
            position: new CANNON.Vec3(0, 2, 0),
        });

        chassisBody.quaternion.setFromAxisAngle( new CANNON.Vec3(0, 1, 0) ,  - Math.PI / 2);
        this.chassisBody = chassisBody;

        /************************************************************************ */
        // this.followCam = new THREE.Object3D();
        // this.followCam.position.copy(this.camera.position);
        // this.scene.add(this.followCam);
        /************************************************************************ */


        const vehicle = new CANNON.RigidVehicle({
            chassisBody: chassisBody,
        });

        // const wheelShape = new CANNON.Cylinder(1, 1, 1/2, 20)
        
        const wheelShape = new CANNON.Sphere(1.1)
        // const wheelShape = new CANNON.Cylinder(1,1,1,20,20);

        const axisWidth = 7;

        //Back_Right
        const wheelBody1 = new CANNON.Body({
            mass: 1,
            material: wheelMaterial,
            shape: wheelShape,
            angularDamping: 0.4,
        });

        // wheelBody1.quaternion.setFromAxisAngle( new CANNON.Vec3(1, 0, 0), Math.PI/2);
        
        //우측 앞
        vehicle.addWheel({
            body: wheelBody1,
            position: new CANNON.Vec3(-2, 0, 2),//위치
            axis: new CANNON.Vec3(0, 0, 1),//축
            direction: new CANNON.Vec3(0, -1, 0)
        });

        const wheelBody2 = new CANNON.Body({
            mass: 1,
            material: wheelMaterial,
            shape: wheelShape,
            angularDamping: 0.4,
        });

        // // wheelBody2.quaternion.setFromAxisAngle( new CANNON.Vec3(0, 0, -1), - Math.PI/2);
        
        // //우측 뒤
        vehicle.addWheel({
            body: wheelBody2,
            position: new CANNON.Vec3(-2, 0, -2),
            axis: new CANNON.Vec3(0, 0, 1),
            direction: new CANNON.Vec3(0, 0, -1)
        });

        const wheelBody3 = new CANNON.Body({
            mass: 1,
            material: wheelMaterial,
            shape: wheelShape,
        });
        
        // // wheelBody3.quaternion.setFromAxisAngle( new CANNON.Vec3(0, 0, 1), - Math.PI/2);
        
        // //좌측 뒤
        vehicle.addWheel({
            body: wheelBody3,
            position: new CANNON.Vec3(2, 0, 2),
            axis: new CANNON.Vec3(0, 0, 1),
            direction: new CANNON.Vec3(0, 0, -1)
        });

        const wheelBody4 = new CANNON.Body({
            mass: 1,
            material: wheelMaterial,
            shape: wheelShape,
            angularDamping: 0.4,
        });

        // // wheelBody4.quaternion.setFromAxisAngle( new CANNON.Vec3(0, 0, 1), - Math.PI/2);
        
        // //좌측 앞
        vehicle.addWheel({
            body: wheelBody4,
            position: new CANNON.Vec3(2, 0, -2),
            axis: new CANNON.Vec3(0, 0, 1),
            direction: new CANNON.Vec3(0, 0, -1)
        });

        // vehicle.wheelBodies.forEach(wheelBody => {
        //     wheelBody.angularDamping = 0.4;
        // });

        vehicle.addToWorld(world);
        this.vehicle = vehicle;   

        // this.realWheelArr = [];

        // this.realWheelGeo1 = new THREE.CylinderGeometry(1.2, 1.2, 1, 10);
        // this.realWheelMat1 = new THREE.MeshBasicMaterial({color: 0x000000});
        // this.realWheelMash1 = new THREE.Mesh(this.realWheelGeo1, this.realWheelMat1);
        // this.realWheelMash1.geometry.rotateX(Math.PI/2);
        // this.scene.add(this.realWheelMash1);

        // // this.realWheelArr.push(this.realWheelMash1);

        // this.realWheelGeo2 = new THREE.CylinderGeometry(1.2, 1.2, 1, 10);
        // this.realWheelMat2 = new THREE.MeshBasicMaterial({color: 0x000000});
        // this.realWheelMash2 = new THREE.Mesh(this.realWheelGeo2, this.realWheelMat2);
        // this.realWheelMash2.geometry.rotateX(Math.PI/2);
        // this.scene.add(this.realWheelMash2);

        // // this.realWheelArr.push(this.realWheelMash2);


        // this.realWheelGeo3 = new THREE.CylinderGeometry(1.2, 1.2, 1, 10);
        // this.realWheelMat3 = new THREE.MeshBasicMaterial({color: 0x000000});
        // this.realWheelMash3 = new THREE.Mesh(this.realWheelGeo3, this.realWheelMat3);
        // this.realWheelMash3.geometry.rotateX(Math.PI/2);
        // this.scene.add(this.realWheelMash3);

        // // this.realWheelArr.push(this.realWheelMash3);


        // this.realWheelGeo4 = new THREE.CylinderGeometry(1.2, 1.2, 1, 10);
        // this.realWheelMat4 = new THREE.MeshBasicMaterial({color: 0x000000});
        // this.realWheelMash4 = new THREE.Mesh(this.realWheelGeo4, this.realWheelMat4);
        // this.realWheelMash4.geometry.rotateX(Math.PI/2);
        // this.scene.add(this.realWheelMash4);

        // this.realWheelArr.push(this.realWheelMash4);

        this.CHASSIS_GROUP = new THREE.Group();

        // this.BOODY_GROUP = new THREE.Group();
        // this.LF_GROUP = new THREE.Group(); 
        // this.LB_GROUP = new THREE.Group(); 
        // this.BW_GROUP = new THREE.Group(); 
        // this.BC_GROUP = new THREE.Group(); 
        // this.MIRROR_GROUP = new THREE.Group(); 
        this.WHILL_R_F_GROUP = new THREE.Group();
        this.WHILL_L_F_GROUP = new THREE.Group(); 


        // this.setModel();

        // this.gltfLoader.load(
        //     './models/Car_Low_Poly.glb', 
        //     (gltf) => {
        //         // this.scene.add(gltf.scene);
                
        //         //차체, 바퀴 생성을 위해서 하드 코딩이 필요한듯?
        //         gltf.scene.children.forEach(megr => {

        //             // console.log(megr)
        //             // console.log(megr);
        //             if(megr.isGroup) {

        //                 for(let i = 0; i < megr.children.length; i++) {
        //                     const groupGeo = megr.children[i].geometry;
    
        //                     const bufferGeo = new THREE.BufferGeometry();
        //                     bufferGeo.setAttribute('position', new THREE.BufferAttribute(groupGeo.attributes.position.array, 3));
        //                     bufferGeo.setAttribute('uv', new THREE.BufferAttribute(groupGeo.attributes.uv.array, 3));
        //                     bufferGeo.setAttribute('normal', new THREE.BufferAttribute(groupGeo.attributes.normal.array, 3));
        //                     // bufferGeo.boundingBox = groupGeo.boundingBox;
        //                     // bufferGeo.drawRange = groupGeo.drawRange;
        //                     bufferGeo.index = groupGeo.index; // bufferGeometry index 속성은 삼각형을 그리는데 사용할 위치 속성의 인덱스 값 배열을 정의

        //                     if(megr.name === 'BoodyCar') {
        //                         this.BOODY_MATERIAL = megr.children[i].material;
        //                         this.BOODY_CAR = new THREE.Mesh(bufferGeo, this.BOODY_MATERIAL)

        //                         this.CHASSIS_GROUP.add(this.BOODY_CAR)
        //                     } else if (megr.name === 'LightFront') {
        //                         this.LF_MATERIAL = megr.children[i].material;
        //                         this.LF = new THREE.Mesh(bufferGeo, this.LF_MATERIAL);
                                
        //                         this.CHASSIS_GROUP.add(this.LF);
        //                     } else if (megr.name === 'LightBack') {
        //                         this.LB_MATERIAL = megr.children[i].material;
        //                         this.LB = new THREE.Mesh(bufferGeo, this.LB_MATERIAL);

        //                         this.CHASSIS_GROUP.add(this.LB);
        //                     } else if (megr.name === 'BackWhiles') {
        //                         this.BW_MATERIAL = megr.children[i].material;
        //                         this.BW = new THREE.Mesh(bufferGeo, this.BW_MATERIAL);

        //                         // this.CHASSIS_GROUP.add(this.BW);
        //                     } else if (megr.name === 'BackCrash') {
        //                         this.BC_MATERIAL = megr.children[i].material;
        //                         this.BC = new THREE.Mesh(bufferGeo, this.BC_MATERIAL);

        //                         this.CHASSIS_GROUP.add(this.BC);
        //                     } else if (megr.name === 'Mirror') {
        //                         this.MIRROR_MATERIAL = megr.children[i].material;
        //                         this.MIRROR = new THREE.Mesh(bufferGeo, this.MIRROR_MATERIAL);

        //                         this.CHASSIS_GROUP.add(this.MIRROR);
        //                     } else if (megr.name === 'While-R-F') {
        //                         this.WHILL_R_F_MATERIAL = megr.children[i].material;
        //                         this.WHILL_R_F = new THREE.Mesh(bufferGeo, this.WHILL_R_F_MATERIAL);

        //                         this.scene.add(this.WHILL_R_F);
        //                     } else if (megr.name === 'While-L-F') {
        //                         this.WHILL_L_F_MATERIAL = megr.children[i].material;
        //                         this.WHILL_L_F = new THREE.Mesh(bufferGeo, this.WHILL_L_F_MATERIAL);

        //                         this.scene.add(this.WHILL_L_F);
        //                     }
        //                 }

        //                 // this.CHASSIS_GROUP.add(this.BOODY_GROUP);
        //                 // this.CHASSIS_GROUP.add(this.LF_GROUP);
        //                 // this.CHASSIS_GROUP.add(this.LB_GROUP);
        //                 // this.CHASSIS_GROUP.add(this.BW_GROUP);
        //                 // this.CHASSIS_GROUP.add(this.BC_GROUP);
        //                 // this.CHASSIS_GROUP.add(this.MIRROR_GROUP);

        //             } else {

        //                 const meshGeo = megr.geometry;

        //                 const bufferGeo = new THREE.BufferGeometry();
        //                 bufferGeo.setAttribute('position', new THREE.BufferAttribute(meshGeo.attributes.position.array, 3));
        //                 bufferGeo.setAttribute('uv', new THREE.BufferAttribute(meshGeo.attributes.uv.array, 3));
        //                 bufferGeo.setAttribute('normal', new THREE.BufferAttribute(meshGeo.attributes.normal.array, 3));
        //                 bufferGeo.index = meshGeo.index;

        //                 if (megr.name === 'Handle') {
        //                     this.HANDLE_MATERIAL = megr.matieral;
        //                     this.HANDLE = new THREE.Mesh(bufferGeo, this.HANDLE_MATERIAL)
        //                     // this.scene.add(this.HANDLE);
        //                     this.CHASSIS_GROUP.add(this.HANDLE);
        //                 } else if (megr.name === 'BackCrash') {
        //                     this.BC_MATERIAL = megr.matieral;
        //                     this.BC = new THREE.Mesh(bufferGeo, this.BC_MATERIAL)
        //                     // this.scene.add(this.BC);
        //                     this.CHASSIS_GROUP.add(this.BC);

        //                 } else if (megr.name === 'FrontCrash') {
        //                     this.FC_MATERIAL = megr.matieral;
        //                     this.FC = new THREE.Mesh(bufferGeo, this.FC_MATERIAL)
        //                     // this.scene.add(this.FC);
        //                     this.CHASSIS_GROUP.add(this.FC);

        //                 } else if (megr.name === 'HandleDoor') {
        //                     this.HANDLE_DOOR_MATERIAL = megr.matieral;
        //                     this.HANDLE_DOOR = new THREE.Mesh(bufferGeo, this.HANDLE_DOOR_MATERIAL)
        //                     // this.scene.add(this.HANDLE_DOOR);
        //                     this.CHASSIS_GROUP.add(this.HANDLE_DOOR);

        //                 }

        //             }

        //         })
        //         // this.CHASSIS_GROUP.position.set(0, -5, 0);
        //         this.scene.add(this.CHASSIS_GROUP);
        // });


        window.addEventListener('keydown', this.onKeyDownEvt.bind(this));
        window.addEventListener('keyup', this.onKeyUpEvt.bind(this));


        //pivot camera test

		this.animate();

    }

    setModel() {
        
        this.gltfLoader.load(
            './models/Car_Low_Poly.glb', 
            (gltf) => {
                // this.scene.add(gltf.scene);
                
                //차체, 바퀴 생성을 위해서 하드 코딩이 필요한듯?
                gltf.scene.children.forEach(megr => {

                    // console.log(megr)
                    // console.log(megr);
                    if(megr.isGroup) {

                        for(let i = 0; i < megr.children.length; i++) {
                            const groupGeo = megr.children[i].geometry;
    
                            const bufferGeo = new THREE.BufferGeometry();
                            bufferGeo.setAttribute('position', new THREE.BufferAttribute(groupGeo.attributes.position.array, 3));
                            bufferGeo.setAttribute('uv', new THREE.BufferAttribute(groupGeo.attributes.uv.array, 3));
                            bufferGeo.setAttribute('normal', new THREE.BufferAttribute(groupGeo.attributes.normal.array, 3));
                            // bufferGeo.boundingBox = groupGeo.boundingBox;
                            // bufferGeo.drawRange = groupGeo.drawRange;
                            bufferGeo.index = groupGeo.index; // bufferGeometry index 속성은 삼각형을 그리는데 사용할 위치 속성의 인덱스 값 배열을 정의

                            if(megr.name === 'BoodyCar') {
                                this.BOODY_MATERIAL = megr.children[i].material;
                                this.BOODY_CAR = new THREE.Mesh(bufferGeo, this.BOODY_MATERIAL)

                                this.CHASSIS_GROUP.add(this.BOODY_CAR)
                            } else if (megr.name === 'LightFront') {
                                this.LF_MATERIAL = megr.children[i].material;
                                this.LF = new THREE.Mesh(bufferGeo, this.LF_MATERIAL);
                                
                                this.CHASSIS_GROUP.add(this.LF);
                            } else if (megr.name === 'LightBack') {
                                this.LB_MATERIAL = megr.children[i].material;
                                this.LB = new THREE.Mesh(bufferGeo, this.LB_MATERIAL);

                                this.CHASSIS_GROUP.add(this.LB);
                            } else if (megr.name === 'BackWhiles') {
                                this.BW_MATERIAL = megr.children[i].material;
                                this.BW = new THREE.Mesh(bufferGeo, this.BW_MATERIAL);

                                // this.CHASSIS_GROUP.add(this.BW);
                            } else if (megr.name === 'BackCrash') {
                                this.BC_MATERIAL = megr.children[i].material;
                                this.BC = new THREE.Mesh(bufferGeo, this.BC_MATERIAL);

                                this.CHASSIS_GROUP.add(this.BC);
                            } else if (megr.name === 'Mirror') {
                                this.MIRROR_MATERIAL = megr.children[i].material;
                                this.MIRROR = new THREE.Mesh(bufferGeo, this.MIRROR_MATERIAL);

                                this.CHASSIS_GROUP.add(this.MIRROR);
                            } else if (megr.name === 'While-R-F') {
                                this.WHILL_R_F_MATERIAL = megr.children[i].material;
                                this.WHILL_R_F = new THREE.Mesh(bufferGeo, this.WHILL_R_F_MATERIAL);

                                this.scene.add(this.WHILL_R_F);
                            } else if (megr.name === 'While-L-F') {
                                this.WHILL_L_F_MATERIAL = megr.children[i].material;
                                this.WHILL_L_F = new THREE.Mesh(bufferGeo, this.WHILL_L_F_MATERIAL);

                                this.scene.add(this.WHILL_L_F);
                            }
                        }

                        // this.CHASSIS_GROUP.add(this.BOODY_GROUP);
                        // this.CHASSIS_GROUP.add(this.LF_GROUP);
                        // this.CHASSIS_GROUP.add(this.LB_GROUP);
                        // this.CHASSIS_GROUP.add(this.BW_GROUP);
                        // this.CHASSIS_GROUP.add(this.BC_GROUP);
                        // this.CHASSIS_GROUP.add(this.MIRROR_GROUP);

                    } else {

                        const meshGeo = megr.geometry;

                        const bufferGeo = new THREE.BufferGeometry();
                        bufferGeo.setAttribute('position', new THREE.BufferAttribute(meshGeo.attributes.position.array, 3));
                        bufferGeo.setAttribute('uv', new THREE.BufferAttribute(meshGeo.attributes.uv.array, 3));
                        bufferGeo.setAttribute('normal', new THREE.BufferAttribute(meshGeo.attributes.normal.array, 3));
                        bufferGeo.index = meshGeo.index;

                        if (megr.name === 'Handle') {
                            this.HANDLE_MATERIAL = megr.matieral;
                            this.HANDLE = new THREE.Mesh(bufferGeo, this.HANDLE_MATERIAL)
                            // this.scene.add(this.HANDLE);
                            this.CHASSIS_GROUP.add(this.HANDLE);
                        } else if (megr.name === 'BackCrash') {
                            this.BC_MATERIAL = megr.matieral;
                            this.BC = new THREE.Mesh(bufferGeo, this.BC_MATERIAL)
                            // this.scene.add(this.BC);
                            this.CHASSIS_GROUP.add(this.BC);

                        } else if (megr.name === 'FrontCrash') {
                            this.FC_MATERIAL = megr.matieral;
                            this.FC = new THREE.Mesh(bufferGeo, this.FC_MATERIAL)
                            // this.scene.add(this.FC);
                            this.CHASSIS_GROUP.add(this.FC);

                        } else if (megr.name === 'HandleDoor') {
                            this.HANDLE_DOOR_MATERIAL = megr.matieral;
                            this.HANDLE_DOOR = new THREE.Mesh(bufferGeo, this.HANDLE_DOOR_MATERIAL)
                            // this.scene.add(this.HANDLE_DOOR);
                            this.CHASSIS_GROUP.add(this.HANDLE_DOOR);

                        }

                    }

                })
                // this.CHASSIS_GROUP.position.set(0, -5, 0);
                this.scene.add(this.CHASSIS_GROUP);
        });
    }

    onKeyDownEvt(e) {

        const maxSteerVal = Math.PI / 8;
        const maxForce = 300;

        //1이 정면 왼쪽
        //3이 정면 오른쪽?

        switch(e.key) {
            case 'w':
            case 'ArrowUp':
                this.vehicle.setWheelForce(maxForce, 2);
                this.vehicle.setWheelForce(maxForce, 3);
                break;
            case 's':
            case 'ArrowDown':
                this.vehicle.setWheelForce(-maxForce, 3, 2);
                this.vehicle.setWheelForce(-maxForce, 2, 2);
                break;
            case 'a':
            case 'Arrowleft':
                this.vehicle.setSteeringValue(maxSteerVal, 0);
                this.vehicle.setSteeringValue(maxSteerVal, 1);
                break;
            case 'd':
            case 'ArrowRight':
                this.vehicle.setSteeringValue(-maxSteerVal, 0);
                this.vehicle.setSteeringValue(-maxSteerVal, 1);
                break;
        }

    }

    onKeyUpEvt(e) {
        switch(e.key) {
            case 'w':
            case 'ArrowUp':
                this.vehicle.setWheelForce(0, 2);
                this.vehicle.setWheelForce(0, 3);
                break;
            case 's':
            case 'ArrowDown':
                this.vehicle.setWheelForce(0, 2);
                this.vehicle.setWheelForce(0, 3);
                break;
            case 'a':
            case 'Arrowleft':
                this.vehicle.setSteeringValue(0, 0);
                this.vehicle.setSteeringValue(0, 1);
                break;
            case 'd':
            case 'ArrowRight':
                this.vehicle.setSteeringValue(0, 0);
                this.vehicle.setSteeringValue(0, 1);
                break;
        }
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate() {

        // const game = this;

		const elapsedTime = this.clock.getElapsedTime();
		const deltaTime = elapsedTime - this.oldElapsedTime;
		this.oldElapsedTime = elapsedTime
		
		this.renderer.render(this.scene, this.camera);
		
        //차체
        if(this.BOODY_CAR) {
            // console.log(this.BOODY_GROUP);
            this.CHASSIS_GROUP.position.copy(this.chassisBody.position)
            this.CHASSIS_GROUP.quaternion.copy(this.chassisBody.quaternion);

        }
        
        this.threeChassisBody.position.copy(this.chassisBody.position);
        this.threeChassisBody.quaternion.copy(this.chassisBody.quaternion);

        
        
        this.cameraPivot.position.copy(this.threeChassisBody.position)
        this.cameraPivot.quaternion.copy(this.threeChassisBody.quaternion)
        
        this.camera.lookAt(this.threeChassisBody.position)

        // this.chassisMesh.position.copy(this.chassisBody.position);
        // this.chassisMesh.quaternion.copy(this.chassisBody.quaternion);

        // this.vehicle.wheelBodies.forEach((wheel, index) => {

        //     this.realWheelArr[index].position.copy(wheel.position);
        //     this.realWheelArr[index].quaternion.copy(wheel.quaternion);
        // });

		// this.realChassisMesh.position.copy(this.chassisBody.position);
		// this.realChassisMesh.quaternion.copy(this.chassisBody.quaternion);
		
		// this.world.step(this.fixedTimeStemp, deltaTime, 3);
		this.world.step(1/60, deltaTime, 3);

        
        
        // const offset = new THREE.Vector3(this.chassisMesh.position.x + 20, this.chassisMesh.position.y + 10, this.chassisMesh.position.z);
        // this.camera.position.lerp(offset, 0.3);
        // this.camera.lookAt(this.chassisMesh.position);

		this.debugRenderer.update();
		
		requestAnimationFrame(this.animate.bind(this));
        // this.onKeyDownEvt();
    }

}

window.onload = () => {
    new Game();
}