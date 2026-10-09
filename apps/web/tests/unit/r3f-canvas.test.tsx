// Kiểm tra Three.js + React Three Fiber + drei chạy được: <Canvas> tối giản dựng scene graph.
// Component chỉ dùng trong test, KHÔNG đưa vào trang thật.
import { Canvas, useThree } from '@react-three/fiber';
import { Center } from '@react-three/drei';
import { render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Scene } from 'three';
import { installWebGLStub } from './webgl-stub';

beforeAll(() => installWebGLStub());

function Capture({ onScene }: { onScene: (s: Scene) => void }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    onScene(scene);
  }, [scene, onScene]);
  return null;
}

describe('React Three Fiber', () => {
  it('<Canvas> dựng mesh (R3F) bọc trong <Center> (drei) vào scene Three.js', async () => {
    let scene: Scene | undefined;
    render(
      <Canvas frameloop="never">
        <Capture onScene={(s) => (scene = s)} />
        <Center>
          <mesh name="hop">
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#8B5E3C" />
          </mesh>
        </Center>
      </Canvas>,
    );
    await waitFor(() => expect(scene).toBeDefined());
    await waitFor(() => expect(scene!.getObjectByName('hop')).toBeDefined());
    const mesh = scene!.getObjectByName('hop')!;
    expect(mesh.type).toBe('Mesh');
  });
});
