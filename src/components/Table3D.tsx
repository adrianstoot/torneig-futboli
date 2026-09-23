import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Foosball } from "./Foosball";

export function Table3D({
  active,
  table,
  matchKey,
  impact = 0,
}: {
  active: boolean;
  table: number;
  matchKey: string;
  impact?: number;
}) {
  const host = useRef<HTMLDivElement>(null),
    activity = useRef(active),
    flash = useRef(0),
    [fallback, setFallback] = useState(false);
  useEffect(() => {
    activity.current = active;
  }, [active]);
  useEffect(() => {
    flash.current = performance.now();
  }, [matchKey, impact]);
  useEffect(() => {
    if (!host.current) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      setFallback(true);
      return;
    }
    const node = host.current;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    node.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    camera.position.set(0.15, 9.3, 8.2);
    camera.lookAt(0, 0, 0);
    camera.zoom = 1.13;
    const stage = new THREE.Group();
    scene.add(stage);
    const accent = [0xff253d, 0x16b8ff, 0xffd621][table - 1];
    const material = (color: number, metalness = 0, roughness = 0.4) =>
      new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const wood = material(0x934822, 0.05, 0.37),
      edge = material(0xf4bd72, 0.15, 0.27),
      darkWood = material(0x311a13, 0.1, 0.3),
      field = material(0x08742f, 0, 0.78),
      white = material(0xffffff, 0.1, 0.28),
      chrome = material(0xd4e8f7, 0.9, 0.16),
      black = material(0x09111a, 0.3, 0.3),
      red = material(0xf41432, 0.22, 0.24),
      blue = material(0x0577f1, 0.25, 0.22),
      gold = material(0xffd635, 0.3, 0.3);
    const box = (
      w: number,
      h: number,
      d: number,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      parent: THREE.Object3D = stage,
    ) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    box(8.9, 0.62, 5.25, darkWood, 0, -0.4, 0);
    box(8.6, 0.16, 4.8, field, 0, -0.02, 0);
    for (let i = 0; i < 8; i++)
      box(
        1.04,
        0.006,
        4.4,
        material(i % 2 ? 0x128c3f : 0x0b7c34, 0, 0.8),
        -3.65 + i * 1.04,
        0.067,
        0,
      );
    for (const z of [-2.5, 2.5]) {
      box(9, 0.42, 0.28, wood, 0, 0.12, z);
      box(9, 0.07, 0.33, edge, 0, 0.36, z);
      box(8.7, 0.12, 0.04, black, 0, -0.05, z + Math.sign(z) * 0.155);
    }
    for (const x of [-4.42, 4.42]) {
      box(0.28, 0.42, 5.1, wood, x, 0.12, 0);
      box(0.34, 0.07, 5.2, edge, x, 0.36, 0);
      box(0.1, 0.5, 1.45, black, x - Math.sign(x) * 0.16, 0.17, 0);
    }
    for (const x of [-3.65, 3.65])
      for (const z of [-1.98, 1.98]) {
        box(0.34, 1.1, 0.34, black, x, -1, z);
        box(0.53, 0.12, 0.53, chrome, x, -1.58, z);
      }
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xe1ffeb,
      transparent: true,
      opacity: 0.88,
    });
    const line = (points: number[][], closed = false) => {
      const geom = new THREE.BufferGeometry().setFromPoints(
        points.map((p) => new THREE.Vector3(p[0], 0.09, p[1])),
      );
      const mesh = closed
        ? new THREE.LineLoop(geom, lineMat)
        : new THREE.Line(geom, lineMat);
      stage.add(mesh);
    };
    line(
      [
        [-4, -2.15],
        [4, -2.15],
        [4, 2.15],
        [-4, 2.15],
      ],
      true,
    );
    line([
      [0, -2.15],
      [0, 2.15],
    ]);
    line(
      Array.from({ length: 65 }, (_, i) => [
        Math.cos((i / 64) * Math.PI * 2) * 0.68,
        Math.sin((i / 64) * Math.PI * 2) * 0.68,
      ]),
    );
    for (const side of [-1, 1]) {
      line([
        [side * 4, -1.2],
        [side * 2.95, -1.2],
        [side * 2.95, 1.2],
        [side * 4, 1.2],
      ]);
      line([
        [side * 4, -0.65],
        [side * 3.6, -0.65],
        [side * 3.6, 0.65],
        [side * 4, 0.65],
      ]);
      for (let i = 0; i < 8; i++)
        line([
          [side * 4.08, -0.65 + i * 0.18],
          [side * 4.32, -0.65 + i * 0.18],
        ]);
    }
    const rods: THREE.Group[] = [];
    const handles: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const group = new THREE.Group();
      group.position.set(-3.7 + i * 1.055, 0.62, 0);
      stage.add(group);
      rods.push(group);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.036, 6.15, 12),
        chrome,
      );
      pole.rotation.x = Math.PI / 2;
      group.add(pole);
      pole.castShadow = true;
      const teamRed = [0, 1, 3, 5].includes(i),
        side = teamRed ? 1 : -1;
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.11, 0.62, 16),
        black,
      );
      handle.rotation.x = Math.PI / 2;
      handle.position.z = side * 3.35;
      group.add(handle);
      handles.push(handle);
      for (let ring = 0; ring < 5; ring++) {
        const grip = new THREE.Mesh(
          new THREE.TorusGeometry(0.097, 0.009, 5, 16),
          chrome,
        );
        grip.position.z = side * (3.1 + ring * 0.1);
        group.add(grip);
      }
      const count = i === 0 || i === 7 ? 1 : i === 1 || i === 6 ? 2 : 3;
      for (let j = 0; j < count; j++) {
        const player = new THREE.Group();
        player.position.z = (j - (count - 1) / 2) * (count === 2 ? 1.5 : 1.2);
        group.add(player);
        const shirt = teamRed ? red : blue;
        const torso = new THREE.Mesh(
          new THREE.CylinderGeometry(0.125, 0.16, 0.3, 12),
          shirt,
        );
        torso.position.y = 0.005;
        torso.castShadow = true;
        player.add(torso);
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.132, 16, 12),
          black,
        );
        head.position.y = 0.28;
        head.castShadow = true;
        player.add(head);
        const neck = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.07, 0.075, 10),
          chrome,
        );
        neck.position.y = 0.165;
        player.add(neck);
        box(0.24, 0.115, 0.19, white, 0, -0.185, 0, player);
        box(0.17, 0.22, 0.14, shirt, 0, -0.32, 0, player);
        box(0.29, 0.095, 0.21, shirt, 0, -0.44, 0, player);
        if (teamRed)
          for (const z of [-0.065, 0.065])
            box(0.015, 0.26, 0.033, gold, 0.126, 0.02, z, player);
        else box(0.012, 0.07, 0.19, white, 0.126, -0.005, 0, player);
      }
      for (const z of [-2.42, 2.42]) {
        const bearing = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.1, 0.12, 12),
          black,
        );
        bearing.rotation.x = Math.PI / 2;
        bearing.position.set(group.position.x, 0.62, z);
        stage.add(bearing);
      }
    }
    const ball = new THREE.Group();
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 18, 14),
      white,
    );
    sphere.castShadow = true;
    ball.add(sphere);
    for (let i = 0; i < 8; i++) {
      const patch = new THREE.Mesh(new THREE.CircleGeometry(0.05, 5), black);
      const axis = new THREE.Vector3(
        Math.sin(i * 2.4),
        Math.cos(i * 2.4),
        Math.sin(i * 1.7),
      ).normalize();
      patch.position.copy(axis.multiplyScalar(0.129));
      patch.lookAt(patch.position.clone().multiplyScalar(2));
      ball.add(patch);
    }
    ball.position.y = 0.22;
    stage.add(ball);
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: 0xd9fff2,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    const trails = Array.from({ length: 5 }, () => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 6),
        trailMaterial,
      );
      stage.add(m);
      return m;
    });
    const plinth = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 12),
      new THREE.ShadowMaterial({ opacity: 0.4 }),
    );
    plinth.rotation.x = -Math.PI / 2;
    plinth.position.y = -1.66;
    plinth.receiveShadow = true;
    scene.add(plinth);
    scene.add(new THREE.HemisphereLight(0xe7f9ff, 0x05213b, 2));
    const keyLight = new THREE.DirectionalLight(0xffedcb, 2.8);
    keyLight.position.set(-3, 7, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.normalBias = 0.025;
    scene.add(keyLight);
    const rim = new THREE.PointLight(accent, 20, 14);
    rim.position.set(0, 2, -4);
    scene.add(rim);
    const spark = new THREE.PointLight(0xffeb98, 0, 12);
    spark.position.set(0, 3, 1);
    scene.add(spark);
    const resize = () => {
      if (!node.clientWidth || !node.clientHeight) return;
      renderer.setSize(node.clientWidth, node.clientHeight);
      camera.aspect = node.clientWidth / node.clientHeight;
      camera.position.y = camera.aspect < 1.5 ? 11 : 9.3;
      camera.position.z = camera.aspect < 1.5 ? 9.4 : 8.2;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    resize();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      last = 0;
    // The path stays inside the painted field even at the curve's extremes.
    const ballPath = new THREE.CatmullRomCurve3(
      [
        [-3.35, -0.45],
        [-1.65, 1.35],
        [0.2, -0.9],
        [2.1, 1.45],
        [3.45, 0.3],
        [1.35, -1.55],
        [-1.55, -1.25],
        [-3.15, 0.95],
        [-0.5, 0.45],
        [2.6, -1.25],
      ].map(([x, z]) => new THREE.Vector3(x, 0.22, z)),
      true,
      "centripetal",
    );
    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));
    const animate = (time: number) => {
      frame = requestAnimationFrame(animate);
      if (document.hidden || time - last < (reduced.matches ? 180 : 15)) return;
      last = time;
      const t = time / 1000 + table * 2.7;
      const playing = activity.current && !reduced.matches;
      if (playing) {
        const travel = (t * 0.23 + Math.sin(t * 1.1) * 0.018) % 1;
        const position = ballPath.getPoint(travel);
        ball.position.set(
          clamp(position.x, -3.75, 3.75),
          0.22 + Math.pow(Math.max(0, Math.sin(t * 8.5)), 10) * 0.055,
          clamp(position.z, -1.92, 1.92),
        );
        ball.rotation.x += 0.11;
        ball.rotation.z += 0.075;
      }
      for (const [i, rod] of rods.entries()) {
        if (!playing) {
          rod.position.z = 0;
          rod.rotation.z = 0;
          continue;
        }
        const nearBall = Math.max(
          0,
          1 - Math.abs(ball.position.x - rod.position.x) / 1.25,
        );
        const kick = Math.pow(Math.max(0, Math.sin(t * 5.8 + i * 1.45)), 12);
        rod.position.z = clamp(
          Math.sin(t * 2.65 + i * 1.1) * 0.25 +
            Math.sin(t * 4.7 + i * 0.56) * 0.08 +
            clamp(ball.position.z * 0.12, -0.15, 0.15) * nearBall,
          -0.48,
          0.48,
        );
        rod.rotation.z = clamp(
          Math.sin(t * (i % 2 ? 3.1 : 3.7) + i * 1.23) * 0.22 +
            Math.sin(t * 8.6 + i * 0.85) *
              (0.35 * kick + 0.48 * nearBall),
          -1.05,
          1.05,
        );
      }
      if (playing) {
        trails.forEach((m, i) => {
          if (!m.visible) m.position.copy(ball.position);
          m.position.lerp(ball.position, 0.34 - i * 0.045);
          m.scale.setScalar(1 - i * 0.13);
          m.visible = true;
        });
        stage.rotation.y = Math.sin(t * 0.55) * 0.025;
        stage.position.x = Math.sin(t * 0.7) * 0.025;
        camera.position.x = 0.15 + Math.sin(t * 0.38) * 0.1;
        camera.lookAt(0, 0, 0);
        rim.intensity = 20 + Math.sin(t * 2.1) * 3;
      } else {
        trails.forEach((m) => (m.visible = false));
        stage.rotation.y = 0;
        stage.position.x = 0;
        camera.position.x = 0.15;
        camera.lookAt(0, 0, 0);
        rim.intensity = 12;
      }
      const hit = Math.max(0, 1 - (time - flash.current) / 1200);
      spark.intensity = hit * 15;
      stage.position.y = !reduced.matches
        ? (playing ? Math.sin(t * 3.4) * 0.025 : 0) +
          Math.sin(hit * Math.PI) * 0.035
        : 0;
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [table]);
  return (
    <div
      className="model-table"
      ref={host}
      role="img"
      aria-label={`Futbolí ${table} en 3D · ${active ? "partida en joc" : "en espera"}`}
    >
      {fallback && <Foosball active={active} table={table} />}
    </div>
  );
}
