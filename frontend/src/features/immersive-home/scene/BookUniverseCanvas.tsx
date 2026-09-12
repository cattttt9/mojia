import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import * as THREE from "three";
import type { ShelfBook } from "../../../types";

export type UniversePhase =
  | "intro"
  | "assembling"
  | "idle"
  | "dispersing";

type HoveredBook = {
  book: ShelfBook;
  x: number;
  y: number;
} | null;

type Props = {
  featuredBooks: ShelfBook[];
  personalBooks: ShelfBook[];
  personalReady: boolean;
  playIntro: boolean;
  personalTransitionToken: number;
  reducedMotion: boolean;
  onBookSelect: (book: ShelfBook, source: "featured" | "personal") => void;
  onHover: (value: HoveredBook) => void;
  onPhaseChange?: (phase: UniversePhase) => void;
};

const coverColors = [
  ["#26483e", "#b8a36e"],
  ["#693f37", "#d5b47a"],
  ["#283f4b", "#9eb9b0"],
  ["#4b4632", "#c9b87c"],
  ["#463b50", "#b8a8c6"],
  ["#3f5036", "#b8c28d"],
  ["#704d2f", "#e0b77f"],
  ["#274b55", "#9bc0c2"],
  ["#5a3340", "#d4a0a8"],
  ["#4b503f", "#d0c69d"],
] as const;

const bookGeometry = new THREE.PlaneGeometry(0.72, 1.06);

function wrapTitle(context: CanvasRenderingContext2D, title: string, maxWidth: number) {
  const lines: string[] = [];
  let current = "";
  for (const character of title) {
    const next = current + character;
    if (context.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = character;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

function createFallbackTexture(book: ShelfBook, index: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 384;
  const context = canvas.getContext("2d")!;
  const colors = coverColors[index % coverColors.length];
  const gradient = context.createLinearGradient(0, 0, 256, 384);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, "#101b18");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 384);

  context.save();
  context.globalAlpha = 0.3;
  context.fillStyle = colors[1];
  context.strokeStyle = colors[1];
  if (index % 5 === 0) {
    context.beginPath();
    context.arc(196, 118, 68, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#16241f";
    context.fillRect(0, 254, 256, 38);
  } else if (index % 5 === 1) {
    context.translate(128, 210);
    context.rotate(-0.48);
    context.fillRect(-190, -24, 380, 48);
    context.fillStyle = "rgba(242, 234, 211, .55)";
    context.fillRect(-190, 38, 380, 13);
  } else if (index % 5 === 2) {
    for (let row = 0; row < 5; row++) {
      context.fillRect(24 + row * 34, 214 - row * 17, 22, 116 + row * 8);
    }
  } else if (index % 5 === 3) {
    context.lineWidth = 15;
    context.beginPath();
    context.arc(130, 224, 92, 0.15, Math.PI * 1.6);
    context.stroke();
    context.lineWidth = 3;
    context.beginPath();
    context.arc(130, 224, 62, Math.PI * 0.35, Math.PI * 1.85);
    context.stroke();
  } else {
    context.fillRect(0, 238, 256, 86);
    context.globalAlpha = 0.16;
    for (let line = 0; line < 8; line++) {
      context.fillRect(22, 86 + line * 18, 212 - line * 13, 2);
    }
  }
  context.restore();

  context.globalAlpha = 0.24;
  context.strokeStyle = colors[1];
  context.lineWidth = 1;
  context.strokeRect(17, 17, 222, 350);
  context.beginPath();
  context.arc(199, 72, 34, 0, Math.PI * 2);
  context.stroke();
  context.globalAlpha = 1;

  context.fillStyle = colors[1];
  context.font = '600 12px "DM Sans", sans-serif';
  context.letterSpacing = "2px";
  context.fillText("INKSHELF", 30, 56);

  context.fillStyle = "#f3ecda";
  context.font = '600 28px "Noto Serif SC", serif';
  const lines = wrapTitle(context, book.title, 190);
  lines.forEach((line, lineIndex) => context.fillText(line, 30, 139 + lineIndex * 39));

  context.fillStyle = "rgba(239, 232, 212, .68)";
  context.font = '500 13px "Noto Serif SC", serif';
  context.fillText(book.author || "墨架精选", 30, 330);
  context.fillStyle = colors[1];
  context.fillRect(30, 347, 42, 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

function useBookTexture(book: ShelfBook, index: number) {
  const fallback = useMemo(
    () => createFallbackTexture(book, index),
    [book.id, book.title, book.author, index],
  );
  const [remote, setRemote] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    setRemote(null);
    if (!book.cover) return;
    let active = true;
    let loaded: THREE.Texture | null = null;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      book.cover,
      (texture) => {
        loaded = texture;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.anisotropy = 2;
        if (active) setRemote(texture);
        else texture.dispose();
      },
      undefined,
      (error) => {
        if (import.meta.env.DEV)
          console.warn("[BookUniverse] 封面纹理加载失败", {
            bookId: book.id,
            cover: book.cover,
            error,
          });
        if (active) setRemote(null);
      },
    );
    return () => {
      active = false;
      loaded?.dispose();
    };
  }, [book.cover]);

  useEffect(() => () => fallback.dispose(), [fallback]);
  return remote || fallback;
}

function easeOutQuint(value: number) {
  return 1 - Math.pow(1 - value, 5);
}

function seededUnitVector(seed: number) {
  const angle = seed * 12.9898;
  const z = Math.sin(angle * 1.73) * 0.76;
  const radial = Math.sqrt(Math.max(0, 1 - z * z));
  return new THREE.Vector3(
    Math.cos(angle) * radial,
    z,
    Math.sin(angle) * radial,
  ).normalize();
}

function BookMesh({
  book,
  index,
  spherePosition,
  scatterPosition,
  baseScale,
  phase,
  interactive,
  onSelect,
  onHover,
}: {
  book: ShelfBook;
  index: number;
  spherePosition: THREE.Vector3;
  scatterPosition: THREE.Vector3;
  baseScale: number;
  phase: UniversePhase;
  interactive: boolean;
  onSelect: () => void;
  onHover: (value: HoveredBook) => void;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const settledAtMount = useRef(phase === "idle").current;
  const animationOpacity = useRef(settledAtMount ? 1 : 0);
  const [hovered, setHovered] = useState(false);
  const texture = useBookTexture(book, index);
  const { camera } = useThree();
  const parentQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const cameraQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const billboardQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const worldPosition = useMemo(() => new THREE.Vector3(), []);
  const localCamera = useMemo(() => new THREE.Vector3(), []);
  const liftedPosition = useMemo(() => new THREE.Vector3(), []);
  const hoverScale = useMemo(() => new THREE.Vector3(), []);
  const transition = useRef({
    started: performance.now(),
    fromPosition: (settledAtMount ? spherePosition : scatterPosition).clone(),
    toPosition: (settledAtMount ? spherePosition : scatterPosition).clone(),
    fromScale: settledAtMount ? baseScale : 0.42,
    toScale: settledAtMount ? baseScale : 0.42,
    fromOpacity: settledAtMount ? 1 : 0,
    toOpacity: settledAtMount ? 1 : 0,
  });

  useEffect(() => {
    const current = mesh.current;
    const goingOut = phase === "intro" || phase === "dispersing";
    transition.current = {
      started: performance.now(),
      fromPosition: current?.position.clone() || scatterPosition.clone(),
      toPosition: (goingOut ? scatterPosition : spherePosition).clone(),
      fromScale: current?.scale.x ?? 0.42,
      toScale: goingOut ? baseScale * 0.48 : baseScale,
      fromOpacity: animationOpacity.current,
      toOpacity: goingOut ? 0 : 1,
    };
  }, [baseScale, phase, scatterPosition, spherePosition]);

  useEffect(() => {
    return () => {
      if (document.body.style.cursor === "pointer") document.body.style.cursor = "";
    };
  }, []);

  useFrame(() => {
    if (!mesh.current || !material.current) return;
    const state = transition.current;
    const duration = phase === "dispersing" ? 760 : 1750;
    const stagger = phase === "assembling" ? index * 27 : index * 7;
    const raw = THREE.MathUtils.clamp(
      (performance.now() - state.started - stagger) / duration,
      0,
      1,
    );
    const progress = easeOutQuint(raw);
    mesh.current.position.lerpVectors(
      state.fromPosition,
      state.toPosition,
      progress,
    );
    const scale = THREE.MathUtils.lerp(state.fromScale, state.toScale, progress);
    mesh.current.scale.setScalar(scale);
    animationOpacity.current = THREE.MathUtils.lerp(
      state.fromOpacity,
      state.toOpacity,
      progress,
    );

    mesh.current.parent?.getWorldQuaternion(parentQuaternion);
    camera.getWorldQuaternion(cameraQuaternion);
    billboardQuaternion.copy(parentQuaternion).invert().multiply(cameraQuaternion);
    mesh.current.quaternion.slerp(billboardQuaternion, 0.2);

    mesh.current.getWorldPosition(worldPosition);
    const depth = THREE.MathUtils.clamp((worldPosition.z + 2.8) / 5.6, 0, 1);
    const depthOpacity = THREE.MathUtils.lerp(0.34, 1, depth);
    material.current.opacity = animationOpacity.current * depthOpacity;

    if (hovered && interactive) {
      localCamera.copy(camera.position);
      mesh.current.parent?.worldToLocal(localCamera);
      liftedPosition
        .subVectors(localCamera, spherePosition)
        .normalize()
        .multiplyScalar(0.22)
        .add(spherePosition);
      mesh.current.position.lerp(liftedPosition, 0.14);
      hoverScale.setScalar(baseScale * 1.08);
      mesh.current.scale.lerp(hoverScale, 0.14);
    }
  });

  const updateHover = (event: ThreeEvent<PointerEvent>) => {
    onHover({ book, x: event.clientX, y: event.clientY });
  };

  return (
    <mesh
      ref={mesh}
      position={settledAtMount ? spherePosition : scatterPosition}
      scale={settledAtMount ? baseScale : baseScale * 0.42}
      onPointerOver={(event) => {
        if (!interactive) return;
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
        updateHover(event);
      }}
      onPointerMove={(event) => interactive && updateHover(event)}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "";
        onHover(null);
      }}
      onClick={(event) => {
        if (!interactive) return;
        event.stopPropagation();
        onSelect();
      }}
    >
      <primitive object={bookGeometry} attach="geometry" />
      <meshBasicMaterial
        ref={material}
        map={texture}
        transparent
        opacity={0}
        toneMapped={false}
        depthWrite
      />
    </mesh>
  );
}

function createParticlePositions(count: number, spread: number, seed: number) {
  const values = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    const direction = seededUnitVector(index + seed);
    const distance = spread * (0.38 + ((index * 29) % 61) / 100);
    values[index * 3] = direction.x * distance;
    values[index * 3 + 1] = direction.y * distance;
    values[index * 3 + 2] = direction.z * distance;
  }
  return values;
}

function ParticleLayer({
  count,
  spread,
  seed,
  size,
  color,
  opacity,
  speed,
  reducedMotion,
}: {
  count: number;
  spread: number;
  seed: number;
  size: number;
  color: string;
  opacity: number;
  speed: number;
  reducedMotion: boolean;
}) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(
    () => createParticlePositions(count, spread, seed),
    [count, seed, spread],
  );
  useFrame(({ clock }, delta) => {
    if (!points.current || reducedMotion || document.hidden) return;
    points.current.rotation.y += delta * speed;
    points.current.rotation.x = Math.sin(clock.elapsedTime * speed * 0.7) * 0.035;
  });
  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={size}
        opacity={opacity}
        transparent
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(162, 185, 148, .4)");
  gradient.addColorStop(0.22, "rgba(111, 148, 120, .2)");
  gradient.addColorStop(0.58, "rgba(71, 102, 83, .06)");
  gradient.addColorStop(1, "rgba(36, 56, 46, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function CoreGlow({ compact }: { compact: boolean }) {
  const texture = useMemo(createGlowTexture, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={[compact ? 0 : 1.55, compact ? 0.92 : 0, -2.9]} scale={[7.3, 7.3, 1]}>
      <spriteMaterial
        map={texture}
        transparent
        opacity={0.68}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
}

function OrbitLines({ compact, reducedMotion }: { compact: boolean; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const geometries = useMemo(
    () =>
      [
        { radiusX: 3.3, radiusY: 1.72, rotation: 0.24 },
        { radiusX: 3.05, radiusY: 2.05, rotation: -0.62 },
        { radiusX: 2.75, radiusY: 2.34, rotation: 0.88 },
      ].map((item) => {
        const curve = new THREE.EllipseCurve(0, 0, item.radiusX, item.radiusY, 0, Math.PI * 1.55);
        return {
          geometry: new THREE.BufferGeometry().setFromPoints(curve.getPoints(96)),
          rotation: item.rotation,
        };
      }),
    [],
  );
  useEffect(
    () => () => geometries.forEach((item) => item.geometry.dispose()),
    [geometries],
  );
  useFrame((_, delta) => {
    if (!group.current || reducedMotion || document.hidden) return;
    group.current.rotation.z += delta * 0.012;
    group.current.rotation.y += delta * 0.008;
  });
  return (
    <group
      ref={group}
      position={[compact ? 0 : 1.55, compact ? 0.92 : 0, -0.55]}
      rotation={[0.48, -0.18, 0]}
    >
      {geometries.map((item, index) => (
        <lineLoop key={index} geometry={item.geometry} rotation={[0, item.rotation, item.rotation * 0.35]}>
          <lineBasicMaterial
            color={index === 1 ? "#7fa28f" : "#c3b77f"}
            transparent
            opacity={index === 1 ? 0.08 : 0.055}
            depthWrite={false}
          />
        </lineLoop>
      ))}
    </group>
  );
}

function FloatingFragments({
  compact,
  reducedMotion,
}: {
  compact: boolean;
  reducedMotion: boolean;
}) {
  const count = compact ? 10 : 18;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const helper = useMemo(() => new THREE.Object3D(), []);
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        position: seededUnitVector(index + 1301).multiplyScalar(3.7 + (index % 4) * 0.65),
        width: 0.09 + (index % 3) * 0.035,
        height: 0.32 + (index % 4) * 0.08,
        phase: index * 1.37,
        speed: 0.12 + (index % 5) * 0.018,
      })),
    [count],
  );

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const time = reducedMotion ? 0 : clock.elapsedTime;
    items.forEach((item, index) => {
      helper.position.copy(item.position);
      helper.position.y += Math.sin(time * item.speed + item.phase) * 0.18;
      helper.position.x += Math.cos(time * item.speed * 0.72 + item.phase) * 0.09;
      helper.rotation.set(
        item.phase * 0.17 + time * 0.018,
        item.phase * 0.31 + time * 0.012,
        item.phase + time * item.speed * 0.12,
      );
      helper.scale.set(item.width, item.height, 1);
      helper.updateMatrix();
      mesh.current!.setMatrixAt(index, helper.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        color="#d9cf9f"
        transparent
        opacity={0.09}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

function ConstellationLines({ reducedMotion }: { reducedMotion: boolean }) {
  const lines = useRef<THREE.LineSegments>(null);
  const positions = useMemo(() => {
    const segmentCount = 18;
    const values = new Float32Array(segmentCount * 2 * 3);
    for (let index = 0; index < segmentCount; index++) {
      const start = seededUnitVector(index + 1801).multiplyScalar(3.2 + (index % 5) * 0.72);
      const end = start
        .clone()
        .add(seededUnitVector(index + 2203).multiplyScalar(0.55 + (index % 4) * 0.24));
      values.set([start.x, start.y, start.z, end.x, end.y, end.z], index * 6);
    }
    return values;
  }, []);
  useFrame(({ clock }, delta) => {
    if (!lines.current || reducedMotion || document.hidden) return;
    lines.current.rotation.y += delta * 0.006;
    lines.current.rotation.z = Math.sin(clock.elapsedTime * 0.045) * 0.025;
  });
  return (
    <lineSegments ref={lines} position={[0.65, 0, -1.6]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        color="#8ca393"
        transparent
        opacity={0.075}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

function AmbientField({
  compact,
  reducedMotion,
}: {
  compact: boolean;
  reducedMotion: boolean;
}) {
  return (
    <>
      <CoreGlow compact={compact} />
      <ParticleLayer
        count={compact ? 90 : 180}
        spread={8.4}
        seed={113}
        size={0.018}
        color="#a8b9aa"
        opacity={0.3}
        speed={0.009}
        reducedMotion={reducedMotion}
      />
      <ParticleLayer
        count={compact ? 28 : 54}
        spread={5.8}
        seed={811}
        size={0.055}
        color="#d3c582"
        opacity={0.22}
        speed={-0.018}
        reducedMotion={reducedMotion}
      />
      <ParticleLayer
        count={compact ? 18 : 34}
        spread={4.9}
        seed={1247}
        size={0.085}
        color="#6f9b83"
        opacity={0.14}
        speed={0.024}
        reducedMotion={reducedMotion}
      />
      <ConstellationLines reducedMotion={reducedMotion} />
      <FloatingFragments compact={compact} reducedMotion={reducedMotion} />
      <OrbitLines compact={compact} reducedMotion={reducedMotion} />
    </>
  );
}

function BookSphere({
  books,
  phase,
  source,
  compact,
  reducedMotion,
  wheelVelocity,
  onBookSelect,
  onHover,
}: {
  books: ShelfBook[];
  phase: UniversePhase;
  source: "featured" | "personal";
  compact: boolean;
  reducedMotion: boolean;
  wheelVelocity: MutableRefObject<number>;
  onBookSelect: Props["onBookSelect"];
  onHover: Props["onHover"];
}) {
  const root = useRef<THREE.Group>(null);
  const sphere = useRef<THREE.Group>(null);
  const { pointer } = useThree();
  const radius = compact ? 2.08 : 2.55;
  const layout = useMemo(() => {
    const count = Math.max(books.length, 1);
    const outerCount = Math.max(8, Math.ceil(count * 0.68));
    const innerCount = Math.max(1, count - outerCount);
    return books.map((_, index) => {
      const outer = index < outerCount;
      const localIndex = outer ? index : index - outerCount;
      const localCount = outer ? outerCount : innerCount;
      const y = 1 - ((localIndex + 0.5) / localCount) * 2;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = Math.PI * (3 - Math.sqrt(5)) * localIndex + (outer ? 0 : 0.57);
      const sequence = (index * 0.754877666 + 0.31) % 1;
      const volumeRadius = outer
        ? 0.87 + sequence * 0.1
        : 0.24 + Math.cbrt(sequence) * 0.55;
      const target = new THREE.Vector3(
        Math.cos(theta) * ring,
        y * 0.82,
        Math.sin(theta) * ring,
      ).multiplyScalar(radius * volumeRadius);
      const scatterDirection = seededUnitVector(index + (source === "personal" ? 701 : 29));
      const depthBias = index % 3 === 0 ? 1.3 : 0;
      const scatter = scatterDirection.multiplyScalar(6.2 + (index % 5) * 0.38);
      scatter.z += depthBias;
      const scaleVariation = outer
        ? 0.78 + ((index * 11) % 5) * 0.04
        : 0.96 + ((index * 7) % 5) * 0.055;
      const baseScale = (compact ? 0.88 : 1) * scaleVariation;
      return { target, scatter, baseScale };
    });
  }, [books, radius, source]);

  useFrame((_, delta) => {
    if (!root.current || !sphere.current || document.hidden) return;
    const maxTilt = THREE.MathUtils.degToRad(5);
    const targetX = reducedMotion || compact ? 0 : -pointer.y * maxTilt;
    const targetY = reducedMotion || compact ? 0 : pointer.x * maxTilt;
    root.current.rotation.x = THREE.MathUtils.damp(
      root.current.rotation.x,
      targetX,
      3.2,
      delta,
    );
    root.current.rotation.y = THREE.MathUtils.damp(
      root.current.rotation.y,
      targetY,
      3.2,
      delta,
    );
    const autoSpeed = reducedMotion ? 0 : phase === "idle" ? 0.138 : 0.042;
    sphere.current.rotation.y += (autoSpeed + wheelVelocity.current) * delta;
    wheelVelocity.current = THREE.MathUtils.damp(
      wheelVelocity.current,
      0,
      2.7,
      delta,
    );
  });

  const interactive = phase === "idle";
  return (
    <group ref={root} position={[compact ? 0 : 1.55, compact ? 0.92 : 0, 0]}>
      <group ref={sphere}>
        {books.map((book, index) => (
          <BookMesh
            key={`${source}:${book.id}`}
            book={book}
            index={index}
            spherePosition={layout[index].target}
            scatterPosition={layout[index].scatter}
            baseScale={layout[index].baseScale}
            phase={phase}
            interactive={interactive}
            onSelect={() =>
              onBookSelect(
                book,
                source === "personal" && book.id.startsWith("curated-fill:")
                  ? "featured"
                  : source,
              )
            }
            onHover={onHover}
          />
        ))}
      </group>
    </group>
  );
}

function Scene({
  books,
  phase,
  source,
  compact,
  reducedMotion,
  wheelVelocity,
  onBookSelect,
  onHover,
}: {
  books: ShelfBook[];
  phase: UniversePhase;
  source: "featured" | "personal";
  compact: boolean;
  reducedMotion: boolean;
  wheelVelocity: MutableRefObject<number>;
  onBookSelect: Props["onBookSelect"];
  onHover: Props["onHover"];
}) {
  return (
    <>
      <color attach="background" args={["#0b1210"]} />
      <fog attach="fog" args={["#0b1210", 8, 15]} />
      <AmbientField compact={compact} reducedMotion={reducedMotion} />
      <BookSphere
        books={books}
        phase={phase}
        source={source}
        compact={compact}
        reducedMotion={reducedMotion}
        wheelVelocity={wheelVelocity}
        onBookSelect={onBookSelect}
        onHover={onHover}
      />
    </>
  );
}

let webglSupport: boolean | undefined;
function supportsWebGL() {
  if (webglSupport !== undefined) return webglSupport;
  try {
    const canvas = document.createElement("canvas");
    webglSupport = Boolean(
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ||
        canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }),
    );
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

function StaticUniverse({
  books,
  onBookSelect,
}: {
  books: ShelfBook[];
  onBookSelect: (book: ShelfBook) => void;
}) {
  return (
    <div className="universe-static" aria-label="精选书籍">
      {books.slice(0, 12).map((book, index) => (
        <button
          key={book.id}
          style={{ "--book-index": index } as React.CSSProperties}
          onClick={() => onBookSelect(book)}
          title={`${book.title} · ${book.author}`}
        >
          <span>{book.title}</span>
          <small>{book.author}</small>
        </button>
      ))}
    </div>
  );
}

const dayMs = 24 * 60 * 60 * 1000;

/**
 * 首页选书优先级：近期在读、近期读完、其他已读完、久未阅读或未开始。
 * 上游没有完成时间，因此“近期读完”使用最后阅读时间作为近似。
 */
function sortHomepageBooks(books: ShelfBook[]) {
  const now = Date.now();
  const tier = (book: ShelfBook) => {
    const age = book.lastRead > 0 ? Math.max(0, now - book.lastRead) : Number.POSITIVE_INFINITY;
    if (!book.finished && book.lastRead > 0 && age <= 120 * dayMs) return 0;
    if (book.finished && book.lastRead > 0 && age <= 180 * dayMs) return 1;
    if (book.finished) return 2;
    return 3;
  };
  return [...books].sort((left, right) => {
    const tierDifference = tier(left) - tier(right);
    if (tierDifference) return tierDifference;
    const timeDifference = (right.lastRead || 0) - (left.lastRead || 0);
    if (timeDifference) return timeDifference;
    const progressDifference = (right.progress || 0) - (left.progress || 0);
    if (progressDifference) return progressDifference;
    return left.title.localeCompare(right.title, "zh-CN");
  });
}

export default function BookUniverseCanvas({
  featuredBooks,
  personalBooks,
  personalReady,
  playIntro,
  personalTransitionToken,
  reducedMotion,
  onBookSelect,
  onHover,
  onPhaseChange,
}: Props) {
  const [compact, setCompact] = useState(() => window.innerWidth < 720);
  // 纹理数量直接影响首屏 CPU、显存和远程封面请求数。
  const limit = compact ? 18 : 32;
  const featured = useMemo(() => featuredBooks.slice(0, limit), [featuredBooks, limit]);
  const personal = useMemo(() => {
    const owned = sortHomepageBooks(personalBooks).slice(0, limit);
    if (!personalReady || owned.length >= limit) return owned;
    const identity = (book: ShelfBook) =>
      `${book.title.trim().toLocaleLowerCase()}|${book.author.trim().toLocaleLowerCase()}`;
    const seen = new Set(owned.map(identity));
    const fillers = featuredBooks
      .filter((book) => !seen.has(identity(book)))
      .slice(0, limit - owned.length)
      .map((book) => ({
        ...book,
        id: `curated-fill:${book.id}`,
        finished: false,
        lastRead: 0,
        progress: undefined,
      }));
    return [...owned, ...fillers];
  }, [featuredBooks, limit, personalBooks, personalReady]);
  const featuredKey = useMemo(() => featured.map((book) => book.id).join("|"), [featured]);
  const personalKey = useMemo(() => personal.map((book) => book.id).join("|"), [personal]);
  const desiredSource = personalReady && personal.length ? "personal" : "featured";
  const desiredBooks = desiredSource === "personal" ? personal : featured;
  const desiredKey = `${desiredSource}:${desiredSource === "personal" ? personalKey : featuredKey}`;
  const [scene, setScene] = useState<{
    source: "featured" | "personal";
    books: ShelfBook[];
  }>(() => ({ source: desiredSource, books: desiredBooks }));
  const skipIntro = reducedMotion || !playIntro;
  const [phase, setPhase] = useState<UniversePhase>(skipIntro ? "idle" : "intro");
  const [introComplete, setIntroComplete] = useState(skipIntro);
  const wheelVelocity = useRef(0);
  const appliedKey = useRef(desiredKey);
  const appliedSource = useRef<"featured" | "personal">(desiredSource);
  const consumedTransitionToken = useRef(personalTransitionToken);
  const latestDesiredBooks = useRef(desiredBooks);
  const latestTransitionToken = useRef(personalTransitionToken);
  const transitionActive = useRef(false);
  latestDesiredBooks.current = desiredBooks;
  latestTransitionToken.current = personalTransitionToken;

  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 720);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (skipIntro) {
      setPhase("idle");
      setIntroComplete(true);
      return;
    }
    const assemble = window.setTimeout(() => setPhase("assembling"), 500);
    const settle = window.setTimeout(() => {
      setPhase("idle");
      setIntroComplete(true);
    }, 2850);
    return () => {
      window.clearTimeout(assemble);
      window.clearTimeout(settle);
    };
  }, [skipIntro]);

  useEffect(() => onPhaseChange?.(phase), [phase, onPhaseChange]);

  useEffect(() => {
    if (!introComplete || appliedKey.current === desiredKey) return;
    const previousSource = appliedSource.current;
    const shouldAnimateReplacement =
      previousSource === "featured" &&
      desiredSource === "personal" &&
      consumedTransitionToken.current !== latestTransitionToken.current;
    appliedKey.current = desiredKey;
    appliedSource.current = desiredSource;
    onHover(null);
    if (reducedMotion || !shouldAnimateReplacement) {
      transitionActive.current = false;
      consumedTransitionToken.current = latestTransitionToken.current;
      setScene({ source: desiredSource, books: latestDesiredBooks.current });
      setPhase("idle");
      return;
    }
    transitionActive.current = true;
    consumedTransitionToken.current = latestTransitionToken.current;
    setPhase("dispersing");
    const swap = window.setTimeout(() => {
      setScene({ source: desiredSource, books: latestDesiredBooks.current });
      setPhase("assembling");
    }, 820);
    const settle = window.setTimeout(() => {
      transitionActive.current = false;
      setPhase("idle");
    }, 2920);
    return () => {
      window.clearTimeout(swap);
      window.clearTimeout(settle);
      transitionActive.current = false;
    };
  }, [
    desiredKey,
    desiredSource,
    introComplete,
    onHover,
    reducedMotion,
  ]);

  // 封面补全或阅读进度更新只替换当前书籍数据，不得取消正在进行的切换计时器。
  useEffect(() => {
    if (
      transitionActive.current ||
      !introComplete ||
      phase !== "idle" ||
      appliedKey.current !== desiredKey
    ) {
      return;
    }
    setScene((current) =>
      current.source === desiredSource && current.books === desiredBooks
        ? current
        : { source: desiredSource, books: desiredBooks },
    );
  }, [desiredBooks, desiredKey, desiredSource, introComplete, phase]);

  if (!supportsWebGL()) {
    const books = personalReady && personal.length ? personal : featured;
    return (
      <StaticUniverse
        books={books}
        onBookSelect={(book) =>
          onBookSelect(
            book,
            personalReady && !book.id.startsWith("curated-fill:")
              ? "personal"
              : "featured",
          )
        }
      />
    );
  }

  return (
    <div
      className="universe-canvas"
      aria-label="由书籍组成的阅读宇宙，可使用鼠标探索"
      onWheel={(event) => {
        if (reducedMotion) return;
        wheelVelocity.current = THREE.MathUtils.clamp(
          wheelVelocity.current + event.deltaY * 0.000065,
          -0.72,
          0.72,
        );
      }}
    >
      <Canvas
        dpr={compact ? [1, 1.15] : [1, 1.5]}
        camera={{ position: [0, 0, compact ? 7.7 : 7.25], fov: compact ? 45 : 43 }}
        gl={{
          alpha: false,
          antialias: !compact,
          powerPreference: "high-performance",
        }}
      >
        <Scene
          books={scene.books}
          phase={phase}
          source={scene.source}
          compact={compact}
          reducedMotion={reducedMotion}
          wheelVelocity={wheelVelocity}
          onBookSelect={onBookSelect}
          onHover={onHover}
        />
      </Canvas>
    </div>
  );
}
