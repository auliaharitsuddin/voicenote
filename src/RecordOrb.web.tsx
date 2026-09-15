import React, { memo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Renderer, Program, Mesh, Triangle, Vec3 } from 'ogl';
import { radius, Theme } from './theme';

/**
 * Web record button: real-time WebGL shader orb (adapted from a supplied
 * "voice-powered-orb" component). `ogl` needs a browser <canvas>/DOM node,
 * which only exists on the web target — hence this is a `.web.tsx` file so
 * Metro never bundles `ogl` into the iOS/Android build (see RecordOrb.native.tsx
 * for that platform's equivalent). Colors are driven from the theme's accent
 * (not hardcoded) so it matches the app's single-accent identity in both
 * light and dark mode. Mic level comes from the `level` prop (expo-audio
 * metering, computed once in Notes.tsx) instead of the original's own
 * getUserMedia capture — recording is already owned by expo-audio, no need
 * for a second mic stream.
 */

const vert = /* glsl */ `
  precision highp float;
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const frag = /* glsl */ `
  precision highp float;
  uniform float iTime;
  uniform vec3 iResolution;
  uniform vec3 uColor;
  uniform float hover;
  uniform float rot;
  uniform float hoverIntensity;
  varying vec2 vUv;

  vec3 hash33(vec3 p3) {
    p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
    p3 += dot(p3, p3.yxz + 19.19);
    return -1.0 + 2.0 * fract(vec3(p3.x + p3.y, p3.x + p3.z, p3.y + p3.z) * p3.zyx);
  }

  float snoise3(vec3 p) {
    const float K1 = 0.333333333;
    const float K2 = 0.166666667;
    vec3 i = floor(p + (p.x + p.y + p.z) * K1);
    vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
    vec3 e = step(vec3(0.0), d0 - d0.yzx);
    vec3 i1 = e * (1.0 - e.zxy);
    vec3 i2 = 1.0 - e.zxy * (1.0 - e);
    vec3 d1 = d0 - (i1 - K2);
    vec3 d2 = d0 - (i2 - K1);
    vec3 d3 = d0 - 0.5;
    vec4 h = max(0.6 - vec4(dot(d0, d0), dot(d1, d1), dot(d2, d2), dot(d3, d3)), 0.0);
    vec4 n = h * h * h * h * vec4(
      dot(d0, hash33(i)), dot(d1, hash33(i + i1)), dot(d2, hash33(i + i2)), dot(d3, hash33(i + 1.0))
    );
    return dot(vec4(31.316), n);
  }

  vec4 extractAlpha(vec3 colorIn) {
    float a = max(max(colorIn.r, colorIn.g), colorIn.b);
    return vec4(colorIn.rgb / (a + 1e-5), a);
  }

  const float innerRadius = 0.55;
  const float noiseScale = 0.65;

  float light1(float intensity, float attenuation, float dist) { return intensity / (1.0 + dist * attenuation); }
  float light2(float intensity, float attenuation, float dist) { return intensity / (1.0 + dist * dist * attenuation); }

  vec4 draw(vec2 uv) {
    vec3 color1 = uColor;
    vec3 color2 = mix(uColor, vec3(1.0), 0.4);
    vec3 color3 = uColor * 0.25;

    float ang = atan(uv.y, uv.x);
    float len = length(uv);
    float invLen = len > 0.0 ? 1.0 / len : 0.0;

    float n0 = snoise3(vec3(uv * noiseScale, iTime * 0.5)) * 0.5 + 0.5;
    float r0 = mix(mix(innerRadius, 1.0, 0.4), mix(innerRadius, 1.0, 0.6), n0);
    float d0 = distance(uv, (r0 * invLen) * uv);
    float v0 = light1(1.0, 10.0, d0);
    v0 *= smoothstep(r0 * 1.05, r0, len);
    float cl = cos(ang + iTime * 2.0) * 0.5 + 0.5;

    float a = iTime * -1.0;
    vec2 pos = vec2(cos(a), sin(a)) * r0;
    float d = distance(uv, pos);
    float v1 = light2(1.5, 5.0, d);
    v1 *= light1(1.0, 50.0, d0);

    float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
    float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);

    vec3 col = mix(color1, color2, cl);
    col = mix(color3, col, v0);
    col = (col + v1) * v2 * v3;
    col = clamp(col, 0.0, 1.0);
    return extractAlpha(col);
  }

  vec4 mainImage(vec2 fragCoord) {
    vec2 center = iResolution.xy * 0.5;
    float size = min(iResolution.x, iResolution.y);
    vec2 uv = (fragCoord - center) / size * 2.0;

    float s = sin(rot), c = cos(rot);
    uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
    uv.x += hover * hoverIntensity * 0.1 * sin(uv.y * 10.0 + iTime);
    uv.y += hover * hoverIntensity * 0.1 * sin(uv.x * 10.0 + iTime);

    return draw(uv);
  }

  void main() {
    vec4 col = mainImage(vUv * iResolution.xy);
    gl_FragColor = vec4(col.rgb * col.a, col.a);
  }
`;

const hexToVec3 = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return new Vec3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

export const RecordOrb = memo(function RecordOrb({
  recording, busy, onPress, t, level = 0,
}: { recording: boolean; busy: boolean; onPress: () => void; t: Theme; level?: number }) {
  const containerRef = useRef<View>(null);
  const recordingRef = useRef(recording);
  const levelRef = useRef(level);
  recordingRef.current = recording;
  levelRef.current = level;

  useEffect(() => {
    // react-native-web renders a View as a <div>; ogl mounts its own canvas into it.
    const container = containerRef.current as unknown as HTMLDivElement | null;
    if (!container) return;

    let raf = 0;
    const renderer = new Renderer({ alpha: true, premultipliedAlpha: false, antialias: true, dpr: window.devicePixelRatio || 1 });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    container.appendChild(gl.canvas);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: vert,
      fragment: frag,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Vec3(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height) },
        uColor: { value: hexToVec3(t.primary) },
        hover: { value: 0 },
        rot: { value: 0 },
        hoverIntensity: { value: 0 },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w * dpr, h * dpr);
      gl.canvas.style.width = `${w}px`;
      gl.canvas.style.height = `${h}px`;
      program.uniforms.iResolution.value.set(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height);
    };
    window.addEventListener('resize', resize);
    resize();

    let lastTime = 0, currentRot = 0;
    const update = (time: number) => {
      raf = requestAnimationFrame(update);
      const dt = (time - lastTime) * 0.001;
      lastTime = time;
      program.uniforms.iTime.value = time * 0.001;

      const lvl = recordingRef.current ? levelRef.current : 0;
      const rotSpeed = 0.25 + lvl * 2.2; // idle drift + voice-driven spin
      if (recordingRef.current) currentRot += dt * rotSpeed;
      else currentRot += dt * 0.1; // slow ambient drift while idle

      program.uniforms.rot.value = currentRot;
      program.uniforms.hover.value = Math.min(0.08 + lvl * 1.6, 1);
      program.uniforms.hoverIntensity.value = Math.min(0.15 + lvl * 0.7, 0.85);

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      renderer.render({ scene: mesh });
    };
    raf = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      try { if (container.contains(gl.canvas)) container.removeChild(gl.canvas); } catch { /* already gone */ }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [t.primary]);

  return (
    <View ref={containerRef} style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Berhenti merekam' : 'Mulai merekam'}
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        onPress={onPress}
        style={[styles.tap, { opacity: busy ? 0.5 : 1 }]}
      >
        <Ionicons name={recording ? 'stop' : 'mic'} size={28} color="#FFFFFF" />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { width: 64, height: 64, borderRadius: radius.full, overflow: 'hidden', position: 'relative' },
  tap: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' as never },
});
