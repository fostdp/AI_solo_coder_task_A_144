import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';


const API_BASE = window.location.origin;
let socket = null;
let currentVehicleId = 'chariot-qin-001';


let scene, camera, renderer, controls;
let chariotGroup;
let leftWheel, rightWheel, frontLeftWheel, frontRightWheel;
let poleGroup;
let leftTieRod, rightTieRod;
let leftKingpin, rightKingpin;
let wheelTrajectoryLine;
let trajectoryPoints = [];
let animationId;

const CHARIOT_WHEELBASE = 2.5;
const CHARIOT_TRACK_WIDTH = 1.8;
const WHEEL_RADIUS = 0.35;
const POLE_LENGTH = 1.8;


function initThreeJS() {
    const container = document.getElementById('canvasContainer');
    const width = container.clientWidth;
    const height = container.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a15);
    scene.fog = new THREE.Fog(0x0a0a15, 20, 50);

    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(4, 3, 5);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 20;
    controls.maxPolarAngle = Math.PI / 2 + 0.1;

    addLights();
    addGround();
    createChariot();
    createTrajectoryLine();

    window.addEventListener('resize', onWindowResize);

    animate();
}


function addLights() {
    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0x00d9ff, 0.5, 10);
    pointLight.position.set(0, 2, 3);
    scene.add(pointLight);
}


function addGround() {
    const gridHelper = new THREE.GridHelper(20, 20, 0x00d9ff, 0x0f3460);
    gridHelper.position.y = -WHEEL_RADIUS;
    gridHelper.material.opacity = 0.3;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    const groundGeometry = new THREE.PlaneGeometry(30, 30);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a2e,
        roughness: 0.9,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -WHEEL_RADIUS - 0.01;
    ground.receiveShadow = true;
    scene.add(ground);
}


function createWheel(radius, width) {
    const group = new THREE.Group();

    const tireGeometry = new THREE.TorusGeometry(radius, width * 0.3, 8, 32);
    const tireMaterial = new THREE.MeshStandardMaterial({
        color: 0x2c1810,
        roughness: 0.8,
        metalness: 0.2
    });
    const tire = new THREE.Mesh(tireGeometry, tireMaterial);
    tire.rotation.y = Math.PI / 2;
    tire.castShadow = true;
    group.add(tire);

    const rimGeometry = new THREE.CylinderGeometry(radius * 0.7, radius * 0.7, width * 0.6, 16);
    const rimMaterial = new THREE.MeshStandardMaterial({
        color: 0x8b4513,
        roughness: 0.6,
        metalness: 0.3
    });
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.rotation.z = Math.PI / 2;
    rim.castShadow = true;
    group.add(rim);

    for (let i = 0; i < 8; i++) {
        const spokeGeometry = new THREE.BoxGeometry(radius * 0.65, 0.04, 0.04);
        const spokeMaterial = new THREE.MeshStandardMaterial({
            color: 0x654321,
            roughness: 0.7
        });
        const spoke = new THREE.Mesh(spokeGeometry, spokeMaterial);
        spoke.rotation.y = (i * Math.PI) / 4;
        spoke.castShadow = true;
        group.add(spoke);
    }

    const hubGeometry = new THREE.CylinderGeometry(0.08, 0.08, width * 0.8, 12);
    const hubMaterial = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        roughness: 0.4,
        metalness: 0.8
    });
    const hub = new THREE.Mesh(hubGeometry, hubMaterial);
    hub.rotation.z = Math.PI / 2;
    hub.castShadow = true;
    group.add(hub);

    return group;
}


function createChariot() {
    chariotGroup = new THREE.Group();
    scene.add(chariotGroup);

    const bodyLength = CHARIOT_WHEELBASE + 0.6;
    const bodyWidth = CHARIOT_TRACK_WIDTH * 0.9;
    const bodyHeight = 0.3;

    const bodyGeometry = new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyLength);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x8b4513,
        roughness: 0.7,
        metalness: 0.1
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = WHEEL_RADIUS + bodyHeight / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    chariotGroup.add(body);

    const floorGeometry = new THREE.BoxGeometry(bodyWidth * 0.9, 0.05, bodyLength * 0.85);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x654321,
        roughness: 0.8
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.y = WHEEL_RADIUS + bodyHeight + 0.02;
    floor.castShadow = true;
    chariotGroup.add(floor);

    const railingMaterial = new THREE.MeshStandardMaterial({
        color: 0x654321,
        roughness: 0.7
    });

    for (let side of [-1, 1]) {
        const postGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8);
        for (let z of [-bodyLength * 0.3, 0, bodyLength * 0.3]) {
            const post = new THREE.Mesh(postGeometry, railingMaterial);
            post.position.set(side * bodyWidth * 0.4, WHEEL_RADIUS + bodyHeight + 0.3, z);
            post.castShadow = true;
            chariotGroup.add(post);
        }

        const railGeometry = new THREE.BoxGeometry(0.04, 0.04, bodyLength * 0.7);
        const rail = new THREE.Mesh(railGeometry, railingMaterial);
        rail.position.set(side * bodyWidth * 0.4, WHEEL_RADIUS + bodyHeight + 0.6, 0);
        rail.castShadow = true;
        chariotGroup.add(rail);
    }

    const backPostGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8);
    for (let side of [-1, 1]) {
        const post = new THREE.Mesh(backPostGeometry, railingMaterial);
        post.position.set(side * bodyWidth * 0.3, WHEEL_RADIUS + bodyHeight + 0.4, -bodyLength * 0.4);
        post.castShadow = true;
        chariotGroup.add(post);
    }

    const backRailGeometry = new THREE.BoxGeometry(bodyWidth * 0.7, 0.04, 0.04);
    const backRail = new THREE.Mesh(backRailGeometry, railingMaterial);
    backRail.position.set(0, WHEEL_RADIUS + bodyHeight + 0.8, -bodyLength * 0.4);
    backRail.castShadow = true;
    chariotGroup.add(backRail);

    const wheelWidth = 0.15;

    leftKingpin = new THREE.Group();
    leftKingpin.position.set(-CHARIOT_TRACK_WIDTH / 2, 0, CHARIOT_WHEELBASE / 2 - 0.2);
    chariotGroup.add(leftKingpin);

    frontLeftWheel = createWheel(WHEEL_RADIUS, wheelWidth);
    frontLeftWheel.position.set(0, WHEEL_RADIUS, 0);
    leftKingpin.add(frontLeftWheel);

    rightKingpin = new THREE.Group();
    rightKingpin.position.set(CHARIOT_TRACK_WIDTH / 2, 0, CHARIOT_WHEELBASE / 2 - 0.2);
    chariotGroup.add(rightKingpin);

    frontRightWheel = createWheel(WHEEL_RADIUS, wheelWidth);
    frontRightWheel.position.set(0, WHEEL_RADIUS, 0);
    rightKingpin.add(frontRightWheel);

    leftWheel = createWheel(WHEEL_RADIUS, wheelWidth);
    leftWheel.position.set(-CHARIOT_TRACK_WIDTH / 2, WHEEL_RADIUS, -CHARIOT_WHEELBASE / 2 + 0.2);
    chariotGroup.add(leftWheel);

    rightWheel = createWheel(WHEEL_RADIUS, wheelWidth);
    rightWheel.position.set(CHARIOT_TRACK_WIDTH / 2, WHEEL_RADIUS, -CHARIOT_WHEELBASE / 2 + 0.2);
    chariotGroup.add(rightWheel);

    createSteeringLinkage();

    poleGroup = new THREE.Group();
    poleGroup.position.set(0, WHEEL_RADIUS + bodyHeight * 0.3, CHARIOT_WHEELBASE / 2 + 0.3);
    chariotGroup.add(poleGroup);

    const poleGeometry = new THREE.BoxGeometry(0.08, 0.1, POLE_LENGTH);
    const poleMaterial = new THREE.MeshStandardMaterial({
        color: 0x654321,
        roughness: 0.6
    });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(0, 0, POLE_LENGTH / 2);
    pole.castShadow = true;
    poleGroup.add(pole);

    const yokeGeometry = new THREE.BoxGeometry(0.6, 0.15, 0.2);
    const yokeMaterial = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        roughness: 0.4,
        metalness: 0.7
    });
    const yoke = new THREE.Mesh(yokeGeometry, yokeMaterial);
    yoke.position.set(0, 0, POLE_LENGTH + 0.1);
    yoke.castShadow = true;
    poleGroup.add(yoke);

    chariotGroup.position.z = -CHARIOT_WHEELBASE / 4;
}


function createSteeringLinkage() {
    const linkageMaterial = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        roughness: 0.4,
        metalness: 0.8
    });

    const tieRodLength = CHARIOT_TRACK_WIDTH * 0.85;
    const tieRodGeometry = new THREE.CylinderGeometry(0.025, 0.025, tieRodLength, 8);
    const tieRodMaterial = linkageMaterial.clone();

    leftTieRod = new THREE.Mesh(tieRodGeometry, tieRodMaterial);
    leftTieRod.rotation.z = Math.PI / 2;
    leftTieRod.position.set(-tieRodLength / 2, WHEEL_RADIUS * 0.5, CHARIOT_WHEELBASE / 2 - 0.3);
    chariotGroup.add(leftTieRod);

    rightTieRod = new THREE.Mesh(tieRodGeometry, tieRodMaterial);
    rightTieRod.rotation.z = Math.PI / 2;
    rightTieRod.position.set(tieRodLength / 2, WHEEL_RADIUS * 0.5, CHARIOT_WHEELBASE / 2 - 0.3);
    chariotGroup.add(rightTieRod);

    const armGeometry = new THREE.BoxGeometry(0.04, 0.04, 0.3);
    const leftArm = new THREE.Mesh(armGeometry, linkageMaterial);
    leftArm.position.set(0, 0, 0.15);
    leftKingpin.add(leftArm);

    const rightArm = new THREE.Mesh(armGeometry, linkageMaterial);
    rightArm.position.set(0, 0, 0.15);
    rightKingpin.add(rightArm);
}


function createTrajectoryLine() {
    const material = new THREE.LineBasicMaterial({
        color: 0x00d9ff,
        linewidth: 2,
        opacity: 0.8,
        transparent: true
    });

    const geometry = new THREE.BufferGeometry();
    wheelTrajectoryLine = new THREE.Line(geometry, material);
    wheelTrajectoryLine.position.y = -WHEEL_RADIUS + 0.02;
    scene.add(wheelTrajectoryLine);

    const material2 = new THREE.LineBasicMaterial({
        color: 0xe94560,
        linewidth: 2,
        opacity: 0.6,
        transparent: true
    });
    const geometry2 = new THREE.BufferGeometry();
    const innerLine = new THREE.Line(geometry2, material2);
    innerLine.position.y = -WHEEL_RADIUS + 0.02;
    scene.add(innerLine);
}


function updateSteering(poleAngleDeg) {
    if (!leftKingpin || !rightKingpin) return;

    const poleAngleRad = THREE.MathUtils.degToRad(poleAngleDeg);

    const L = CHARIOT_WHEELBASE;
    const T = CHARIOT_TRACK_WIDTH;

    if (Math.abs(poleAngleRad) < 0.001) {
        leftKingpin.rotation.y = 0;
        rightKingpin.rotation.y = 0;
        return;
    }

    const R = L / Math.tan(Math.abs(poleAngleRad));
    const innerAngle = Math.atan(L / (R - T / 2));
    const outerAngle = Math.atan(L / (R + T / 2));

    if (poleAngleDeg > 0) {
        leftKingpin.rotation.y = outerAngle;
        rightKingpin.rotation.y = innerAngle;
    } else {
        leftKingpin.rotation.y = -innerAngle;
        rightKingpin.rotation.y = -outerAngle;
    }

    if (poleGroup) {
        poleGroup.rotation.y = poleAngleRad * 0.8;
    }

    updateLinkageVisual(poleAngleDeg);
}


function updateLinkageVisual(poleAngleDeg) {
    const poleAngleRad = THREE.MathUtils.degToRad(poleAngleDeg);

    if (leftTieRod && rightTieRod) {
        const offset = Math.sin(poleAngleRad) * 0.3;
        leftTieRod.position.y = WHEEL_RADIUS * 0.5 + offset * 0.1;
        rightTieRod.position.y = WHEEL_RADIUS * 0.5 + offset * 0.1;
    }
}


function updateWheelRotation(speed, dt) {
    const angularSpeed = speed / WHEEL_RADIUS;

    if (leftWheel) {
        leftWheel.children[0].rotation.x += angularSpeed * dt;
    }
    if (rightWheel) {
        rightWheel.children[0].rotation.x += angularSpeed * dt;
    }
    if (frontLeftWheel) {
        frontLeftWheel.children[0].rotation.x += angularSpeed * dt;
    }
    if (frontRightWheel) {
        frontRightWheel.children[0].rotation.x += angularSpeed * dt;
    }
}


function updateTrajectory(poleAngleDeg, speed, dt) {
    if (!wheelTrajectoryLine) return;

    const point = new THREE.Vector3(
        chariotGroup.position.x,
        -WHEEL_RADIUS + 0.02,
        chariotGroup.position.z
    );

    trajectoryPoints.push(point);

    if (trajectoryPoints.length > 500) {
        trajectoryPoints.shift();
    }

    const positions = new Float32Array(trajectoryPoints.length * 3);
    for (let i = 0; i < trajectoryPoints.length; i++) {
        positions[i * 3] = trajectoryPoints[i].x;
        positions[i * 3 + 1] = trajectoryPoints[i].y;
        positions[i * 3 + 2] = trajectoryPoints[i].z;
    }

    wheelTrajectoryLine.geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3)
    );
    wheelTrajectoryLine.geometry.computeBoundingSphere();
}


function updateChariotPosition(poleAngleDeg, speed, dt) {
    const poleAngleRad = THREE.MathUtils.degToRad(poleAngleDeg);

    if (Math.abs(poleAngleRad) < 0.001) {
        chariotGroup.position.z -= speed * dt;
    } else {
        const R = CHARIOT_WHEELBASE / Math.tan(poleAngleRad * 0.85);
        const angularVel = speed / R;

        const centerX = chariotGroup.position.x + R;
        const centerZ = chariotGroup.position.z;

        const angle = angularVel * dt;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const newX = centerX - R * cos;
        const newZ = centerZ + R * sin;

        chariotGroup.position.x = newX;
        chariotGroup.position.z = newZ;

        chariotGroup.rotation.y += angle;
    }
}


function onWindowResize() {
    const container = document.getElementById('canvasContainer');
    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
}


let lastTime = 0;
function animate(time) {
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    const speed = parseFloat(document.getElementById('speedSlider').value) || 5;
    const poleAngle = parseFloat(document.getElementById('poleAngleSlider').value) || 0;

    updateSteering(poleAngle);
    updateWheelRotation(speed * 0.5, dt);

    controls.update();
    renderer.render(scene, camera);

    animationId = requestAnimationFrame(animate);
}


function setView(view) {
    if (view === '3d') {
        camera.position.set(4, 3, 5);
    } else if (view === 'top') {
        camera.position.set(0, 10, 0.1);
    } else if (view === 'side') {
        camera.position.set(6, 1.5, 0);
    }
    camera.lookAt(0, 0, 0);
}


function drawLinkageDiagram(poleAngleDeg) {
    const canvas = document.getElementById('linkageCanvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = '#0f3460';
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, h);
        ctx.stroke();
    }
    for (let i = 0; i < h; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(w, i);
        ctx.stroke();
    }

    const scale = 80;
    const centerX = w / 2;
    const centerY = h * 0.6;

    const wheelbase = CHARIOT_WHEELBASE * scale;
    const trackWidth = CHARIOT_TRACK_WIDTH * scale;
    const poleLen = POLE_LENGTH * scale;

    const poleAngleRad = poleAngleDeg * Math.PI / 180;

    const rearLeftX = centerX - trackWidth / 2;
    const rearRightX = centerX + trackWidth / 2;
    const rearY = centerY + wheelbase / 2;

    const frontLeftX = centerX - trackWidth / 2;
    const frontRightX = centerX + trackWidth / 2;
    const frontY = centerY - wheelbase / 2;

    const R = Math.abs(poleAngleRad) < 0.001 ? 999999 : CHARIOT_WHEELBASE / Math.tan(Math.abs(poleAngleRad));
    const innerAngle = Math.atan(CHARIOT_WHEELBASE / (R - CHARIOT_TRACK_WIDTH / 2));
    const outerAngle = Math.atan(CHARIOT_WHEELBASE / (R + CHARIOT_TRACK_WIDTH / 2));

    ctx.fillStyle = '#16213e';
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 2;
    ctx.fillRect(centerX - trackWidth / 2 + 10, frontY + 20, trackWidth - 20, wheelbase - 40);
    ctx.strokeRect(centerX - trackWidth / 2 + 10, frontY + 20, trackWidth - 20, wheelbase - 40);

    const wheelRadius = 15;
    const wheelWidth = 8;

    drawWheel2D(ctx, rearLeftX, rearY, wheelRadius, wheelWidth, 0, '#2c1810');
    drawWheel2D(ctx, rearRightX, rearY, wheelRadius, wheelWidth, 0, '#2c1810');

    const leftWheelAngle = poleAngleDeg > 0 ? outerAngle : -innerAngle;
    const rightWheelAngle = poleAngleDeg > 0 ? innerAngle : -outerAngle;

    drawWheel2D(ctx, frontLeftX, frontY, wheelRadius, wheelWidth, leftWheelAngle, '#00d9ff');
    drawWheel2D(ctx, frontRightX, frontY, wheelRadius, wheelWidth, rightWheelAngle, '#00d9ff');

    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY - wheelbase / 2 + 30);
    const poleTipX = centerX + poleLen * Math.sin(poleAngleRad);
    const poleTipY = centerY - wheelbase / 2 + 30 - poleLen * Math.cos(poleAngleRad);
    ctx.lineTo(poleTipX, poleTipY);
    ctx.stroke();

    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.arc(poleTipX, poleTipY, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);

    const tieRodY = frontY + 25;
    const armLen = 25;

    const leftArmEndX = frontLeftX + armLen * Math.sin(leftWheelAngle);
    const leftArmEndY = tieRodY + armLen * Math.cos(leftWheelAngle);

    const rightArmEndX = frontRightX + armLen * Math.sin(rightWheelAngle);
    const rightArmEndY = tieRodY + armLen * Math.cos(rightWheelAngle);

    ctx.beginPath();
    ctx.moveTo(leftArmEndX, leftArmEndY);
    ctx.lineTo(rightArmEndX, rightArmEndY);
    ctx.stroke();

    ctx.setLineDash([]);

    ctx.fillStyle = '#aaa';
    ctx.font = '11px sans-serif';
    ctx.fillText('辕杆', poleTipX + 10, poleTipY - 5);
    ctx.fillText('转向横拉杆', (leftArmEndX + rightArmEndX) / 2 - 30, leftArmEndY - 8);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`内轮转角: ${(Math.abs(poleAngleDeg > 0 ? innerAngle : -innerAngle) * 180 / Math.PI).toFixed(1)}°`, 20, 30);
    ctx.fillText(`外轮转角: ${(Math.abs(poleAngleDeg > 0 ? outerAngle : -outerAngle) * 180 / Math.PI).toFixed(1)}°`, 20, 50);
}


function drawWheel2D(ctx, x, y, radius, width, angle, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-width / 2, -radius, width, radius * 2, 3);
    ctx.fill();

    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-width / 2 - 2, 0);
    ctx.lineTo(width / 2 + 2, 0);
    ctx.stroke();

    ctx.restore();
}


function drawRolloverGauge(riskPercent) {
    const canvas = document.getElementById('rolloverGauge');
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const centerX = w / 2;
    const centerY = h - 10;
    const radius = h * 0.9;

    ctx.strokeStyle = '#1a4a7a';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI);
    ctx.stroke();

    const gradient = ctx.createLinearGradient(0, centerY, w, centerY);
    gradient.addColorStop(0, '#00ff88');
    gradient.addColorStop(0.5, '#ffc107');
    gradient.addColorStop(1, '#e94560');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 12;
    ctx.beginPath();
    const angle = Math.PI + (riskPercent / 100) * Math.PI;
    ctx.arc(centerX, centerY, radius, Math.PI, angle);
    ctx.stroke();

    const needleAngle = Math.PI + (riskPercent / 100) * Math.PI;
    const needleLen = radius - 5;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
        centerX + Math.cos(needleAngle) * needleLen,
        centerY + Math.sin(needleAngle) * needleLen
    );
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${riskPercent.toFixed(1)}%`, centerX, centerY + 18);
}


function updateSensorDisplay(data) {
    document.getElementById('sensorPoleAngle').textContent = `${data.pole_angle.toFixed(1)}°`;
    document.getElementById('sensorSlipRate').textContent = data.slip_rate.toFixed(3);
    document.getElementById('sensorRollAngle').textContent = `${data.roll_angle.toFixed(1)}°`;
    document.getElementById('sensorFriction').textContent = data.friction_coeff.toFixed(3);

    document.getElementById('barPoleAngle').style.width = `${((data.pole_angle + 40) / 80) * 100}%`;
    document.getElementById('barSlipRate').style.width = `${data.slip_rate * 100}%`;
    document.getElementById('barRollAngle').style.width = `${((data.roll_angle + 35) / 70) * 100}%`;
    document.getElementById('barFriction').style.width = `${data.friction_coeff * 100}%`;
}


function updateSteeringDisplay(analysis) {
    document.getElementById('turningRadius').textContent =
        analysis.turning_radius === Infinity || analysis.turning_radius > 999
            ? '∞ m'
            : `${analysis.turning_radius.toFixed(2)} m`;
    document.getElementById('innerWheelAngle').textContent = `${analysis.inner_wheel_angle.toFixed(1)}°`;
    document.getElementById('outerWheelAngle').textContent = `${analysis.outer_wheel_angle.toFixed(1)}°`;
    document.getElementById('wheelSpeedDiff').textContent = `${(analysis.wheel_speed_diff * 100).toFixed(2)}%`;
    document.getElementById('ackermannError').textContent = `${(analysis.ackermann_error * 100).toFixed(2)}%`;
}


function updateStabilityDisplay(analysis) {
    document.getElementById('yawRate').textContent = `${analysis.yaw_rate.toFixed(2)}°/s`;
    document.getElementById('lateralAccel').textContent = `${analysis.lateral_acceleration.toFixed(2)} m/s²`;
    document.getElementById('rollCenterHeight').textContent = `${analysis.roll_center_height.toFixed(3)} m`;
    document.getElementById('stabilityIndex').textContent = analysis.stability_index.toFixed(2);
    document.getElementById('criticalSpeed').textContent =
        analysis.critical_speed ? `${analysis.critical_speed.toFixed(2)} m/s` : '— m/s';

    drawRolloverGauge(analysis.rollover_risk);

    if (chariotGroup) {
        const rollRad = (analysis.roll_angle || 0) * Math.PI / 180;
        chariotGroup.rotation.z = rollRad * 0.3;
    }
}


function addAlert(alert) {
    const alertsList = document.getElementById('alertsList');
    const noAlerts = alertsList.querySelector('.no-alerts');
    if (noAlerts) noAlerts.remove();

    const alertItem = document.createElement('div');
    alertItem.className = `alert-item ${alert.severity}`;

    const timeStr = new Date(alert.timestamp * 1000).toLocaleTimeString();

    alertItem.innerHTML = `
        <div class="alert-message">${alert.message}</div>
        <div class="alert-time">${timeStr} · ${alert.vehicle_id}</div>
    `;

    alertsList.insertBefore(alertItem, alertsList.firstChild);

    while (alertsList.children.length > 20) {
        alertsList.removeChild(alertsList.lastChild);
    }
}


async function fetchSteeringAnalysis(poleAngle, speed) {
    try {
        const response = await fetch(`${API_BASE}/api/analysis/steering`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pole_angle: poleAngle,
                vehicle_speed: speed,
                friction_coeff: 0.7
            })
        });
        return await response.json();
    } catch (e) {
        console.error('获取转向分析失败:', e);
        return null;
    }
}


function connectWebSocket() {
    const wsUrl = `ws://${window.location.host}/ws/realtime`;
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        document.getElementById('connectionStatus').textContent = '已连接';
        document.getElementById('connectionStatus').classList.add('connected');
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            if (data.sensor_data && data.sensor_data.vehicle_id === currentVehicleId) {
                updateSensorDisplay(data.sensor_data);

                if (data.steering_analysis) {
                    updateSteeringDisplay(data.steering_analysis);
                }

                if (data.stability_analysis) {
                    updateStabilityDisplay(data.stability_analysis);
                }

                if (data.alerts && data.alerts.length > 0) {
                    data.alerts.forEach(alert => addAlert(alert));
                }
            }
        } catch (e) {
            console.error('解析WebSocket消息失败:', e);
        }
    };

    socket.onclose = () => {
        document.getElementById('connectionStatus').textContent = '未连接';
        document.getElementById('connectionStatus').classList.remove('connected');
        setTimeout(connectWebSocket, 3000);
    };

    socket.onerror = () => {
        console.error('WebSocket错误');
    };
}


function setupEventListeners() {
    document.getElementById('poleAngleSlider').addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        document.getElementById('poleAngleValue').textContent = value.toFixed(1);
        drawLinkageDiagram(value);
    });

    document.getElementById('speedSlider').addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        document.getElementById('speedValue').textContent = value.toFixed(1);
    });

    document.getElementById('vehicleSelect').addEventListener('change', (e) => {
        currentVehicleId = e.target.value;
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setView(btn.dataset.view);
        });
    });
}


async function init() {
    initThreeJS();
    drawLinkageDiagram(0);
    drawRolloverGauge(0);
    setupEventListeners();

    setTimeout(() => {
        connectWebSocket();
    }, 500);

    try {
        const steering = await fetchSteeringAnalysis(0, 5);
        if (steering) {
            updateSteeringDisplay(steering);
        }
    } catch (e) {
        console.log('使用默认数据');
    }
}


init();
