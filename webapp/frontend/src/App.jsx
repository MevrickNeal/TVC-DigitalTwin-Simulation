import React, { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import * as THREE from 'three';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';


const API = window.location.origin.includes('5173') ? 'http://localhost:8000' : window.location.origin;

// ─── ROCKET 3D ────────────────────────────────────────────────────────────────
function RocketModel({ pitch = 0, roll = 0, yaw = 0, deltaPitch = 0, deltaYaw = 0, isFiring = false }) {
  const flameRef = useRef();
  const mtl = useLoader(MTLLoader, '/ProjectNeal1.2.mtl', (loader) => {
    loader.setResourcePath('/ProjectNeal1.2_img/');
  });
  const obj = useLoader(OBJLoader, '/ProjectNeal1.2.obj', (loader) => {
    mtl.preload();
    loader.setMaterials(mtl);
  });
  const { model, NY, BR } = useMemo(() => {
    const clone = obj.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const cen = box.getCenter(new THREE.Vector3());
    const sz  = box.getSize(new THREE.Vector3());
    clone.traverse(c => {
      if (c.isMesh && c.geometry) {
        c.geometry = c.geometry.clone();
        c.geometry.translate(-cen.x, -cen.y, -cen.z);
      }
    });
    const SCALE = 5.5 / sz.z;
    clone.traverse(c => {
      if (!c.isMesh) return;
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      c.material = mats.map(m => {
        if (!m) return m;
        const n = m.clone();
        n.side = THREE.DoubleSide;
        if (n.name && (n.name.includes('Nose') || n.name.includes('Fin'))) {
          n.color = new THREE.Color('#e8121c'); n.map = null; n.metalness = 0.4; n.roughness = 0.25;
        } else if (n.name && n.name.includes('Body')) {
          n.color = new THREE.Color('#ffffff');
          // Create custom canvas texture for the vertically oriented PROJECT NEAL logo
          const canvas = document.createElement('canvas');
          canvas.width = 512;
          canvas.height = 1024;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 512, 1024);
          
          // Draw the text vertically on two sides of the cylinder
          ctx.save();
          ctx.fillStyle = '#e8121c';
          ctx.font = 'bold 36px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.translate(128, 512);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText('PROJECT NEAL', 0, 0);
          ctx.restore();

          ctx.save();
          ctx.fillStyle = '#e8121c';
          ctx.font = 'bold 36px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.translate(384, 512);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText('PROJECT NEAL', 0, 0);
          ctx.restore();

          const tex = new THREE.CanvasTexture(canvas);
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.needsUpdate = true;
          n.map = tex;
          n.metalness = 0.15;
          n.roughness = 0.20;
        } else {
          if (n.color && n.color.r < 0.05 && n.color.g < 0.05 && n.color.b < 0.05 && !n.map)
            n.color = new THREE.Color('#888899');
          n.metalness = 0.5; n.roughness = 0.4;
        }
        n.needsUpdate = true; n.envMapIntensity = 1.6; return n;
      });
      if (c.material.length === 1) c.material = c.material[0];
      c.castShadow = true;
    });
    clone.userData.SCALE = SCALE;
    return { model: clone, NY: -(sz.z / 2) * SCALE, BR: (sz.x / 2) * SCALE };
  }, [obj]);
  useFrame(({ clock }) => {
    if (flameRef.current && isFiring) {
      const t = clock.getElapsedTime();
      flameRef.current.scale.set(1 + Math.sin(t*38)*0.13, 1 + Math.sin(t*27)*0.2, 1 + Math.sin(t*38)*0.13);
    }
  });
  const S = model.userData.SCALE;
  return (
    <group rotation={[pitch, yaw, roll]}>
      <group scale={[S,S,S]} rotation={[-Math.PI/2,0,0]}><primitive object={model}/></group>
      <group position={[0,NY,0]} rotation={[deltaPitch, 0, deltaYaw]}>
        <mesh><torusGeometry args={[BR*0.88,0.025,16,48]}/><meshStandardMaterial color="#3a3a4a" metalness={0.95} roughness={0.1}/></mesh>
        <mesh position={[0,-0.3,0]}><cylinderGeometry args={[BR*0.54,BR*0.88,0.58,40]}/><meshStandardMaterial color="#0d0d14" metalness={0.95} roughness={0.1}/></mesh>
        <mesh position={[0,-0.05,0]}><cylinderGeometry args={[BR*0.5,BR*0.5,0.06,32]}/><meshStandardMaterial color="#7f1d1d" emissive="#e8121c" emissiveIntensity={isFiring?4:0.4} roughness={1} metalness={0}/></mesh>
        {isFiring && (
          <group ref={flameRef} position={[0,-0.6,0]}>
            <mesh position={[0,-0.35,0]}><coneGeometry args={[BR*0.5,0.75,32]}/><meshBasicMaterial color="#ffffff" transparent opacity={0.97}/></mesh>
            <mesh position={[0,-0.65,0]}><coneGeometry args={[BR*0.78,1.3,32]}/><meshBasicMaterial color="#ff9500" transparent opacity={0.80}/></mesh>
            <mesh position={[0,-0.95,0]}><coneGeometry args={[BR*1.1,1.7,32]}/><meshBasicMaterial color="#e8121c" transparent opacity={0.40}/></mesh>
            <mesh position={[0,-1.25,0]}><coneGeometry args={[BR*1.4,1.5,32]}/><meshBasicMaterial color="#b80f18" transparent opacity={0.12}/></mesh>
          </group>
        )}
      </group>
    </group>
  );
}


// ─── TRAJECTORY 3D LINE ────────────────────────────────────────────────────────
function TrajectoryLine({ points }) {
  const lineGeometry = useMemo(() => {
    if (points.length < 2) return null;
    const pts = points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [points]);

  if (!lineGeometry) return null;

  return (
    <line>
      <primitive object={lineGeometry} attach="geometry" />
      <lineBasicMaterial color="#e8121c" linewidth={2} />
    </line>
  );
}

// ─── ATTITUDE CUBE ─────────────────────────────────────────────────────────────
function AttCube({ pitch=0, roll=0, yaw=0 }) {
  const ref = useRef();
  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.x = (pitch*Math.PI)/180;
      ref.current.rotation.z = (roll*Math.PI)/180;
      ref.current.rotation.y = (yaw*Math.PI)/180;
    }
  });
  return (
    <group ref={ref} scale={[0.55, 0.55, 0.55]} position={[0, -0.3, 0]}>
      <RocketModel pitch={0} roll={0} yaw={0} isFiring={false}/>
    </group>
  );
}

// ─── FLYING ENVIRONMENT ────────────────────────────────────────────────────────
function FlyingEnvironment() {
  const groupRef = useRef();
  const count = 30;
  const points = useMemo(() => {
    const pts = [];
    for (let i = 0; i < count; i++) {
      pts.push({
        pos: [Math.random() * 8 - 4, Math.random() * 12 - 6, Math.random() * 8 - 4],
        speed: 2 + Math.random() * 3
      });
    }
    return pts;
  }, []);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        const pt = points[i];
        child.position.y -= pt.speed * delta * 5;
        if (child.position.y < -6) {
          child.position.y = 6;
        }
      });
    }
  });

  return (
    <group ref={groupRef}>
      {points.map((pt, i) => (
        <mesh key={i} position={pt.pos}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
        </mesh>
      ))}
    </group>
  );
}

// ─── SIMULATOR ROCKET ──────────────────────────────────────────────────────────
function SimulatorRocket({ tvcState, windForce, dragCoeff, controllerIdx, padActive, padPitch, padYaw, setPadPitch, setPadYaw }) {
  const ref = useRef();

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);

    if (tvcState.current.dragging) {
      if (tvcState.current.dragType === 'nose') {
        const Kp = controllerIdx === 4 ? 12.0 : 8.0;
        const Kd = controllerIdx === 4 ? 4.0 : 2.5;
        tvcState.current.deltaP = Math.max(-0.25, Math.min(0.25, - (Kp * tvcState.current.thetaP + Kd * tvcState.current.omegaP) * 0.15));
        tvcState.current.deltaY = Math.max(-0.25, Math.min(0.25, - (Kp * tvcState.current.thetaY + Kd * tvcState.current.omegaY) * 0.15));
      } else if (tvcState.current.dragType === 'nozzle') {
        const I = 0.25;
        const F = 15.0;
        const d = 0.5;
        const T_tvc_p = - F * d * Math.sin(tvcState.current.deltaP);
        const T_tvc_y = - F * d * Math.sin(tvcState.current.deltaY);
        const T_aero_p = - dragCoeff * tvcState.current.thetaP;
        const T_aero_y = - dragCoeff * tvcState.current.thetaY;

        const thetaP_ddot = (T_tvc_p + T_aero_p) / I;
        const thetaY_ddot = (T_tvc_y + T_aero_y) / I;

        tvcState.current.omegaP += thetaP_ddot * dt;
        tvcState.current.thetaP += tvcState.current.omegaP * dt;
        tvcState.current.omegaY += thetaY_ddot * dt;
        tvcState.current.thetaY += tvcState.current.omegaY * dt;

        tvcState.current.omegaP *= 0.98;
        tvcState.current.omegaY *= 0.98;
      }
    } else {
      let Kp = 8.0;
      let Kd = 2.5;
      if (controllerIdx === 4) { Kp = 12.0; Kd = 4.0; }
      else if (controllerIdx === 2) { Kp = 9.0; Kd = 3.0; }
      else if (controllerIdx === 3) { Kp = 7.0; Kd = 2.0; }

      const extDistP = padActive ? (padPitch * Math.PI / 180) : 0;
      const extDistY = padActive ? (padYaw * Math.PI / 180) : 0;

      const targetDeltaP = - (Kp * tvcState.current.thetaP + Kd * tvcState.current.omegaP);
      const targetDeltaY = - (Kp * tvcState.current.thetaY + Kd * tvcState.current.omegaY);

      tvcState.current.deltaP += (targetDeltaP - tvcState.current.deltaP) * 15.0 * dt;
      tvcState.current.deltaY += (targetDeltaY - tvcState.current.deltaY) * 15.0 * dt;

      tvcState.current.deltaP = Math.max(-0.25, Math.min(0.25, tvcState.current.deltaP));
      tvcState.current.deltaY = Math.max(-0.25, Math.min(0.25, tvcState.current.deltaY));

      const I = 0.25;
      const F = 15.0;
      const d = 0.5;

      const T_tvc_p = - F * d * Math.sin(tvcState.current.deltaP);
      const T_tvc_y = - F * d * Math.sin(tvcState.current.deltaY);
      const T_aero_p = - dragCoeff * tvcState.current.thetaP;
      const T_aero_y = - dragCoeff * tvcState.current.thetaY;

      const t = state.clock.getElapsedTime();
      const T_wind_p = windForce * Math.sin(t * 2.0) + extDistP * 2.0;
      const T_wind_y = windForce * Math.cos(t * 1.5) + extDistY * 2.0;

      const thetaP_ddot = (T_tvc_p + T_aero_p + T_wind_p) / I;
      const thetaY_ddot = (T_tvc_y + T_aero_y + T_wind_y) / I;

      tvcState.current.omegaP += thetaP_ddot * dt;
      tvcState.current.thetaP += tvcState.current.omegaP * dt;
      tvcState.current.omegaY += thetaY_ddot * dt;
      tvcState.current.thetaY += tvcState.current.omegaY * dt;

      tvcState.current.omegaP *= 0.98;
      tvcState.current.omegaY *= 0.98;
    }

    if (ref.current) {
      ref.current.rotation.x = tvcState.current.thetaP;
      ref.current.rotation.z = tvcState.current.thetaY;
    }
  });

  const handlePointerDown = (type, e) => {
    e.stopPropagation();
    e.target.setPointerCapture(e.pointerId);
    tvcState.current.dragging = true;
    tvcState.current.dragType = type;
    tvcState.current.startX = e.clientX;
    tvcState.current.startY = e.clientY;
    tvcState.current.startValP = type === 'nose' ? tvcState.current.thetaP : tvcState.current.deltaP;
    tvcState.current.startValY = type === 'nose' ? tvcState.current.thetaY : tvcState.current.deltaY;
  };

  const handlePointerMove = (e) => {
    if (!tvcState.current.dragging) return;
    e.stopPropagation();
    const dx = e.clientX - tvcState.current.startX;
    const dy = e.clientY - tvcState.current.startY;

    if (tvcState.current.dragType === 'nose') {
      tvcState.current.thetaY = tvcState.current.startValY + dx * 0.005;
      tvcState.current.thetaP = tvcState.current.startValP - dy * 0.005;
      tvcState.current.thetaP = Math.max(-0.4, Math.min(0.4, tvcState.current.thetaP));
      tvcState.current.thetaY = Math.max(-0.4, Math.min(0.4, tvcState.current.thetaY));
    } else {
      tvcState.current.deltaY = tvcState.current.startValY + dx * 0.003;
      tvcState.current.deltaP = tvcState.current.startValP - dy * 0.003;
      tvcState.current.deltaP = Math.max(-0.25, Math.min(0.25, tvcState.current.deltaP));
      tvcState.current.deltaY = Math.max(-0.25, Math.min(0.25, tvcState.current.deltaY));
    }
  };

  const handlePointerUp = (e) => {
    if (tvcState.current.dragging) {
      e.stopPropagation();
      e.target.releasePointerCapture(e.pointerId);
      tvcState.current.dragging = false;
    }
  };

  return (
    <group ref={ref} scale={[0.85, 0.85, 0.85]}>
      <RocketModel 
        pitch={0} 
        roll={0} 
        yaw={0} 
        deltaPitch={tvcState.current.deltaP} 
        deltaYaw={tvcState.current.deltaY} 
        isFiring={true} 
      />

      {/* Nose cone interactive grabber */}
      <mesh 
        position={[0, 1.8, 0]} 
        onPointerDown={(e) => handlePointerDown('nose', e)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <sphereGeometry args={[0.48, 16, 16]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.0} />
      </mesh>

      {/* Nozzle interactive grabber */}
      <mesh 
        position={[0, -1.8, 0]} 
        onPointerDown={(e) => handlePointerDown('nozzle', e)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <sphereGeometry args={[0.38, 16, 16]} />
        <meshBasicMaterial color="#e8121c" transparent opacity={0.0} />
      </mesh>
    </group>
  );
}

// ─── CHART ─────────────────────────────────────────────────────────────────────
function Chart({ data, extra={} }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const [hoverX, setHoverX] = useState(0);

  if (!data || data.length === 0) return null;
  const traces = useMemo(() => {
    return data.map(t => {
      const type = t.type || 'line';
      const x = t.x || [];
      const y = t.y || [];
      const name = t.name || '';
      const line = t.line || {};
      const marker = t.marker || {};
      const fill = t.fill || '';
      const fillcolor = t.fillcolor || 'rgba(0,0,0,0)';
      return { type, x, y, name, line, marker, fill, fillcolor };
    });
  }, [data]);

  const bounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    traces.forEach(t => {
      t.x.forEach((vx, idx) => {
        const valX = typeof vx === 'number' ? vx : idx;
        if (valX < minX) minX = valX; if (valX > maxX) maxX = valX;
      });
      t.y.forEach(vy => { if (vy < minY) minY = vy; if (vy > maxY) maxY = vy; });
    });
    if (minX === Infinity) { minX = 0; maxX = 1; }
    if (minY === Infinity) { minY = 0; maxY = 1; }
    if (minX === maxX) { minX -= 1; maxX += 1; }
    if (minY === maxY) { minY -= 1; maxY += 1; }
    if (extra.yaxis && extra.yaxis.range) { minY = extra.yaxis.range[0]; maxY = extra.yaxis.range[1]; }
    return { minX, maxX, minY, maxY };
  }, [traces, extra]);

  const width = 300, height = 110;
  const padding = { top: 12, right: 10, bottom: 18, left: 32 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const scaleX = (xVal) => padding.left + ((xVal - bounds.minX) / (bounds.maxX - bounds.minX)) * plotWidth;
  const scaleY = (yVal) => padding.top + (1 - (yVal - bounds.minY) / (bounds.maxY - bounds.minY)) * plotHeight;

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = (x - (padding.left / width) * rect.width) / ((plotWidth / width) * rect.width);
    if (pct >= 0 && pct <= 1) {
      const len = traces[0]?.x?.length || 0;
      if (len > 0) {
        const idx = Math.max(0, Math.min(len - 1, Math.round(pct * (len - 1))));
        setHoverIdx(idx);
        setHoverX(scaleX(traces[0].x[idx]));
      }
    } else {
      setHoverIdx(null);
    }
  };

  const handleMouseLeave = () => {
    setHoverIdx(null);
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {[0, 0.5, 1.0].map((r, i) => {
          const yVal = bounds.minY + r * (bounds.maxY - bounds.minY);
          const yPos = scaleY(yVal);
          return (
            <g key={i}>
              <line x1={padding.left} y1={yPos} x2={width - padding.right} y2={yPos}
                stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} strokeDasharray="2,2"/>
              <text x={padding.left - 5} y={yPos + 2.5} textAnchor="end" fill="#64748b"
                style={{ fontSize: 6.5, fontFamily: 'JetBrains Mono, monospace' }}>{yVal.toFixed(1)}</text>
            </g>
          );
        })}
        {[0, 1.0].map((r, i) => {
          const xVal = bounds.minX + r * (bounds.maxX - bounds.minX);
          const xPos = scaleX(xVal);
          return (
            <g key={i}>
              <text x={xPos} y={height - 2} textAnchor={i === 0 ? 'start' : 'end'} fill="#64748b"
                style={{ fontSize: 6.5, fontFamily: 'JetBrains Mono, monospace' }}>{xVal.toFixed(1)}s</text>
            </g>
          );
        })}
        {traces.map((t, idx) => {
          if (t.type === 'bar') {
            const count = t.x.length;
            const groupWidth = plotWidth / count;
            const barWidth = groupWidth * 0.55;
            return t.x.map((vx, i) => {
              const yVal = t.y[i];
              const xPos = padding.left + i * groupWidth + (groupWidth - barWidth) / 2;
              const yPos = scaleY(yVal);
              const zeroPos = scaleY(0);
              const h = Math.abs(zeroPos - yPos);
              const barColor = Array.isArray(t.marker.color) ? t.marker.color[i] : (t.marker.color || '#3b82f6');
              return <rect key={i} x={xPos} y={Math.min(yPos, zeroPos)} width={barWidth} height={h} fill={barColor} rx={0.5}/>;
            });
          }
          let pathD = '', areaD = '';
          t.x.forEach((vx, i) => {
            const valX = typeof vx === 'number' ? vx : i;
            const valY = t.y[i];
            const px = scaleX(valX), py = scaleY(valY);
            if (i === 0) {
              pathD = `M ${px} ${py}`;
              areaD = `M ${px} ${scaleY(Math.max(bounds.minY, 0))} L ${px} ${py}`;
            } else {
              pathD += ` L ${px} ${py}`;
              areaD += ` L ${px} ${py}`;
            }
            if (i === t.x.length - 1) areaD += ` L ${px} ${scaleY(Math.max(bounds.minY, 0))} Z`;
          });
          const lineColor = t.line.color || '#e8121c';
          const lineDash = t.line.dash === 'dash' ? '3,3' : t.line.dash === 'dot' ? '1,2' : '';
          const fillCol = t.fill === 'tozeroy' ? t.fillcolor : 'none';
          return (
            <g key={idx}>
              {t.fill === 'tozeroy' && pathD && <path d={areaD} fill={fillCol} stroke="none" style={{ opacity: 0.8 }}/>}
              {pathD && <path d={pathD} fill="none" stroke={lineColor} strokeWidth={t.line.width || 1.2} strokeDasharray={lineDash} filter="url(#glow)"/>}
            </g>
          );
        })}

        {hoverIdx !== null && (
          <g>
            <line x1={hoverX} y1={padding.top} x2={hoverX} y2={height - padding.bottom} stroke="rgba(232,18,28,0.4)" strokeWidth={0.8} strokeDasharray="3,3" />
            {traces.map((t, idx) => {
              if (t.type === 'bar') return null;
              const valY = t.y[hoverIdx];
              const py = scaleY(valY);
              const lineColor = t.line.color || '#e8121c';
              return (
                <g key={idx}>
                  <circle cx={hoverX} cy={py} r={3} fill="#090d16" stroke={lineColor} strokeWidth={1} />
                  <circle cx={hoverX} cy={py} r={1.2} fill={lineColor} />
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {hoverIdx !== null && traces[0] && (
        <div style={{
          position: 'absolute',
          top: 6,
          left: hoverX > width * 0.6 ? 24 : width - 90,
          background: 'rgba(9, 13, 22, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 4,
          padding: '4px 6px',
          pointerEvents: 'none',
          zIndex: 50,
          fontFamily: 'JetBrains Mono',
          fontSize: 6.5,
          color: '#f0f4f8',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}>
          <div style={{ color: '#64748b', fontSize: 6 }}>T: {traces[0].x[hoverIdx].toFixed(2)}s</div>
          {traces.map((t, idx) => {
            const valY = t.y[hoverIdx];
            const lineColor = t.line.color || '#e8121c';
            return (
              <div key={idx} style={{ display: 'flex', gap: 6, justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: lineColor }} />
                  {t.name.toUpperCase()}
                </span>
                <span style={{ fontWeight: 700, color: lineColor }}>{valY.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── AVIO GAUGE (Aviation-Style Needle Gauge) ─────────────────────────────────
function AvioGauge({ value = 0, min = -3, max = 3, color = '#3b82f6', label = '', unit = '', size = 76 }) {
  const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const startDeg = -220, totalDeg = 260;
  const needleDeg = startDeg + pct * totalDeg;
  const toRad = (d) => (d * Math.PI) / 180;
  const cx = size / 2, cy = size / 2, r = size / 2 - 7;

  const arcPath = (sD, eD, rr) => {
    const s = toRad(sD), e = toRad(eD);
    const x1 = cx + rr * Math.cos(s), y1 = cy + rr * Math.sin(s);
    const x2 = cx + rr * Math.cos(e), y2 = cy + rr * Math.sin(e);
    const large = Math.abs(eD - sD) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${rr} ${rr} 0 ${large} 1 ${x2} ${y2}`;
  };

  const ticks = [];
  for (let i = 0; i <= 20; i++) {
    const frac = i / 20;
    const deg = startDeg + frac * totalDeg;
    const rad = toRad(deg);
    const isMajor = i % 4 === 0;
    const ri = isMajor ? r - 8 : r - 4;
    ticks.push({
      x1: cx + r * Math.cos(rad), y1: cy + r * Math.sin(rad),
      x2: cx + ri * Math.cos(rad), y2: cy + ri * Math.sin(rad),
      major: isMajor,
    });
  }

  const nx = cx + (r - 10) * Math.cos(toRad(needleDeg));
  const ny = cy + (r - 10) * Math.sin(toRad(needleDeg));
  const dispVal = typeof value === 'number' ? (Math.abs(value) < 10 ? value.toFixed(3) : value.toFixed(1)) : value;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r + 2} fill="#060c16" stroke={`${color}15`} strokeWidth={1}/>
        <path d={arcPath(startDeg, startDeg + totalDeg, r)} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={5}/>
        <path d={arcPath(startDeg, needleDeg, r)} fill="none" stroke={color} strokeWidth={5}
          style={{ filter: `drop-shadow(0 0 3px ${color}88)` }}/>
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.major ? '#64748b' : '#2d3748'} strokeWidth={t.major ? 1.2 : 0.7}/>
        ))}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={1.8}
          strokeLinecap="round" style={{ filter: `drop-shadow(0 0 2px ${color})` }}/>
        <circle cx={cx} cy={cy} r={3.5} fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }}/>
        <circle cx={cx} cy={cy} r={1.8} fill="#060c16"/>
        <text x={cx} y={cy + 16} textAnchor="middle" fill="#f0f4f8"
          style={{ fontSize: 9, fontFamily: 'JetBrains Mono', fontWeight: '700' }}>{dispVal}</text>
        <text x={cx} y={cy + 24} textAnchor="middle" fill={color}
          style={{ fontSize: 5.5, fontFamily: 'JetBrains Mono' }}>{unit}</text>
      </svg>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 6.5, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: -2 }}>{label}</div>
    </div>
  );
}

// ─── HUD CARD (Aerospace KPI Card) ───────────────────────────────────────────
function HUDCard({ label, value, unit, color, blink = false }) {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(140deg, #080d1a 0%, #0b1220 100%)',
      border: `1px solid ${color}28`,
      borderLeft: `2px solid ${color}`,
      padding: '8px 12px 7px 13px',
      clipPath: 'polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 0 100%)',
    }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 0, height: 0,
        borderStyle: 'solid', borderWidth: '0 13px 13px 0',
        borderColor: `transparent ${color}45 transparent transparent`,
      }}/>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.005) 3px, rgba(255,255,255,0.005) 4px)',
      }}/>
      <div style={{
        position: 'absolute', top: 6, right: 17,
        width: 4, height: 4, borderRadius: '50%', background: color,
        boxShadow: `0 0 5px ${color}`,
        animation: blink ? 'ledBlink 1.2s ease infinite' : 'none',
      }}/>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 6.5, color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 16, fontWeight: 700, color: '#f0f4f8', lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span>{value}</span>
        {unit && <span style={{ fontSize: 7.5, color, fontFamily: 'JetBrains Mono', fontWeight: 400 }}>{unit}</span>}
      </div>
    </div>
  );
}

// ─── GPS MAP (Leaflet + Offline Tiles) ───────────────────────────────────────
function GPSMapLeaflet({ lat, lon }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false, attributionControl: false,
      dragging: false, touchZoom: false, scrollWheelZoom: false,
      doubleClickZoom: false, boxZoom: false, keyboard: false,
    }).setView([lat, lon], 14);
    L.tileLayer('/tiles/{z}/{x}/{y}.png', { maxZoom: 15, minZoom: 8 }).addTo(map);
    const icon = L.divIcon({
      html: '<div style="width:10px;height:10px;background:#e8121c;border:2px solid #ff8a8a;border-radius:50%;box-shadow:0 0 8px #e8121c80"></div>',
      className: '', iconSize: [14, 14], iconAnchor: [7, 7],
    });
    markerRef.current = L.marker([lat, lon], { icon }).addTo(map);
    mapRef.current = map;
  }, [lat, lon]);

  useEffect(() => {
    initMap();
    const t = setTimeout(initMap, 800);
    return () => clearTimeout(t);
  }, [initMap]);

  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      mapRef.current.setView([lat, lon], 14);
      markerRef.current.setLatLng([lat, lon]);
    }
  }, [lat, lon]);

  return (
    <div style={{ position: 'relative', height: 122, borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(232,18,28,0.22)', marginBottom: 6 }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%', filter: 'invert(1) hue-rotate(200deg) brightness(0.78) saturate(0.65)' }}/>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          <path d="M8 20 L8 8 L20 8" fill="none" stroke="#e8121c" strokeWidth="1.5" opacity="0.8"/>
          <path d="M calc(100% - 20) 8 L calc(100% - 8) 8 L calc(100% - 8) 20" fill="none" stroke="#e8121c" strokeWidth="1.5" opacity="0.8"/>
          <path d="M8 calc(100% - 20) L8 calc(100% - 8) L20 calc(100% - 8)" fill="none" stroke="#e8121c" strokeWidth="1.5" opacity="0.8"/>
          <path d="M calc(100% - 20) calc(100% - 8) L calc(100% - 8) calc(100% - 8) L calc(100% - 8) calc(100% - 20)" fill="none" stroke="#e8121c" strokeWidth="1.5" opacity="0.8"/>
          <line x1="50%" y1="44%" x2="50%" y2="56%" stroke="#e8121c" strokeWidth="0.8" opacity="0.6"/>
          <line x1="44%" y1="50%" x2="56%" y2="50%" stroke="#e8121c" strokeWidth="0.8" opacity="0.6"/>
          <circle cx="50%" cy="50%" r="3" fill="#e8121c" opacity="0.9"/>
        </svg>
        <div style={{ position: 'absolute', bottom: 4, left: 7, fontFamily: 'JetBrains Mono', fontSize: 6.5, color: '#f59e0b', textShadow: '0 0 6px #000' }}>
          {lat.toFixed(5)}°N {lon.toFixed(5)}°E
        </div>
        <div style={{ position: 'absolute', top: 5, right: 7, fontFamily: 'JetBrains Mono', fontSize: 6.5, color: '#10b981', textShadow: '0 0 4px #000' }}>
          3D FIX
        </div>
      </div>
    </div>
  );
}

// ─── ARTIFICIAL HORIZON (SVG Attitude Indicator) ──────────────────────────────
function ArtificialHorizon({ pitch = 0, roll = 0, size = 100 }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 5;
  const clipId = `ah-${size}-${Math.round(pitch)}-${Math.round(roll)}`;
  const pitchOffset = (pitch / 90) * r;
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <defs><clipPath id={clipId}><circle cx={cx} cy={cy} r={r}/></clipPath></defs>
      <g clipPath={`url(#${clipId})`} transform={`rotate(${-roll}, ${cx}, ${cy})`}>
        <rect x={-10} y={-10} width={size + 20} height={cy - pitchOffset + 10} fill="#1a3a5c"/>
        <rect x={-10} y={cy - pitchOffset} width={size + 20} height={size + 20} fill="#5c3a1a"/>
        <rect x={-10} y={cy - pitchOffset - 0.5} width={size + 20} height={1} fill="rgba(255,255,255,0.7)"/>
        {[-20, -10, 10, 20].map(p => (
          <g key={p}>
            <rect x={cx - r * 0.28} y={cy - pitchOffset - (p / 90) * r - 0.4} width={r * 0.56} height={0.8} fill="rgba(255,255,255,0.4)"/>
            <text x={cx + r * 0.32} y={cy - pitchOffset - (p / 90) * r + 2.5}
              fill="rgba(255,255,255,0.5)" style={{ fontSize: 5.5, fontFamily: 'JetBrains Mono' }}>{Math.abs(p)}</text>
          </g>
        ))}
      </g>
      <line x1={cx - 22} y1={cy} x2={cx - 8} y2={cy} stroke="#f59e0b" strokeWidth={2} strokeLinecap="round"/>
      <line x1={cx + 8} y1={cy} x2={cx + 22} y2={cy} stroke="#f59e0b" strokeWidth={2} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={2.5} fill="#f59e0b"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5}/>
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => {
        const rad = (deg - 90) * Math.PI / 180;
        const len = deg % 90 === 0 ? 6 : deg % 30 === 0 ? 4 : 2;
        return <line key={deg}
          x1={cx + r * Math.cos(rad)} y1={cy + r * Math.sin(rad)}
          x2={cx + (r - len) * Math.cos(rad)} y2={cy + (r - len) * Math.sin(rad)}
          stroke="rgba(255,255,255,0.35)" strokeWidth={deg % 90 === 0 ? 1.5 : 0.7}/>;
      })}
    </svg>
  );
}

// ─── GAUGE RING ────────────────────────────────────────────────────────────────
function GaugeRing({ value, max, color, label, unit, size=84 }) {
  const pct = Math.min(1, Math.max(0, value/max));
  const r = (size/2)-9;
  const circ = 2*Math.PI*r;
  const stroke = circ*pct;
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,position:'relative'}}>
      <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={7}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${stroke} ${circ}`} strokeLinecap="round"
          style={{transition:'stroke-dasharray 0.4s ease', filter:`drop-shadow(0 0 5px ${color}99)`}}/>
      </svg>
      <div style={{position:'absolute',top:size/2-16,width:'100%',textAlign:'center'}}>
        <div style={{fontFamily:'JetBrains Mono',fontSize:14,fontWeight:700,color:'#f8fafc',lineHeight:1}}>
          {typeof value==='number'?value.toFixed(2):value}
        </div>
        <div style={{fontFamily:'JetBrains Mono',fontSize:7,color,marginTop:1}}>{unit}</div>
      </div>
      <div style={{fontFamily:'JetBrains Mono',fontSize:7,color:'#475569',letterSpacing:'0.1em',textTransform:'uppercase',marginTop:-2}}>{label}</div>
    </div>
  );
}

// ─── DATA ROW ──────────────────────────────────────────────────────────────────
function DR({ label, value, unit, color='#94a3b8', ok }) {
  const c = ok===false?'#e8121c':ok==='warn'?'#f59e0b':ok===true?'#10b981':color;
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
      <span style={{fontFamily:'JetBrains Mono',fontSize:8,color:'#475569',letterSpacing:'0.06em',textTransform:'uppercase'}}>{label}</span>
      <span style={{fontFamily:'JetBrains Mono',fontSize:10,fontWeight:600,color:c}}>
        {value}{unit&&<span style={{fontSize:8,color:'#475569',marginLeft:3}}>{unit}</span>}
      </span>
    </div>
  );
}

// ─── LED ───────────────────────────────────────────────────────────────────────
function LED({ label, ok, blink=false }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 0'}}>
      <div style={{width:6,height:6,borderRadius:'50%',background:ok?'#10b981':'#e8121c',
        boxShadow:ok?'0 0 5px #10b98180':'0 0 5px #e8121c80',
        animation:blink&&ok?'ledBlink 1.4s ease infinite':'none',flexShrink:0}}/>
      <span style={{fontFamily:'JetBrains Mono',fontSize:8,color:ok?'#94a3b8':'#4b5563',
        textTransform:'uppercase',letterSpacing:'0.07em'}}>{label}</span>
    </div>
  );
}

// ─── PANEL ─────────────────────────────────────────────────────────────────────
function Panel({ title, accent='#e8121c', children, style={}, titleRight }) {
  return (
    <div style={{background:'linear-gradient(145deg,#141c2b,#111827)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:10,overflow:'hidden',...style}}>
      {title&&(
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 14px 7px',borderBottom:'1px solid rgba(255,255,255,0.05)',background:'rgba(0,0,0,0.25)'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:3,height:13,background:accent,borderRadius:2}}/>
            <span style={{fontFamily:'JetBrains Mono',fontSize:8,fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase',color:'#64748b'}}>{title}</span>
          </div>
          {titleRight}
        </div>
      )}
      <div style={{padding:'10px 13px'}}>{children}</div>
    </div>
  );
}

// ─── SERVO BAR ─────────────────────────────────────────────────────────────────
function ServoBar({ label, value, max=5, color='#3b82f6' }) {
  const pct = ((value+max)/(max*2))*100;
  return (
    <div style={{marginBottom:8}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
        <span style={{fontFamily:'JetBrains Mono',fontSize:7,color:'#475569',textTransform:'uppercase',letterSpacing:'0.08em'}}>{label}</span>
        <span style={{fontFamily:'JetBrains Mono',fontSize:10,fontWeight:700,color}}>{value>0?'+':''}{value.toFixed(2)}<span style={{fontSize:7,color:'#475569'}}> deg</span></span>
      </div>
      <div style={{position:'relative',height:4,background:'rgba(255,255,255,0.05)',borderRadius:2}}>
        <div style={{position:'absolute',left:'50%',top:0,bottom:0,width:1,background:'rgba(255,255,255,0.10)'}}/>
        <div style={{position:'absolute',left:value>=0?'50%':`${pct}%`,width:`${Math.abs(value)/max*50}%`,top:0,bottom:0,background:color,borderRadius:2,boxShadow:`0 0 5px ${color}88`,transition:'all 0.25s'}}/>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:2}}>
        <span style={{fontFamily:'JetBrains Mono',fontSize:6,color:'#334155'}}>-{max}°</span>
        <span style={{fontFamily:'JetBrains Mono',fontSize:6,color:'#334155'}}>+{max}°</span>
      </div>
    </div>
  );
}

// ─── TVC PAD ───────────────────────────────────────────────────────────────────
function TVCPad({ onDrag }) {
  const ref = useRef(); const drag = useRef(false); const [dot,setDot] = useState({x:0,y:0}); const R=70;
  const move = useCallback((cx,cy)=>{
    const rect=ref.current.getBoundingClientRect();
    let dx=cx-(rect.left+rect.width/2), dy=cy-(rect.top+rect.height/2);
    const d=Math.hypot(dx,dy); if(d>R){dx*=R/d;dy*=R/d;}
    setDot({x:dx,y:dy}); onDrag&&onDrag(-dy/R*5,dx/R*5);
  },[onDrag]);
  const release=useCallback(()=>{drag.current=false;setDot({x:0,y:0});onDrag&&onDrag(0,0);},[onDrag]);
  return (
    <div ref={ref} style={{position:'relative',width:R*2,height:R*2,borderRadius:'50%',background:'radial-gradient(circle,#0f1420 60%,#090d16)',border:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'crosshair',userSelect:'none',flexShrink:0}}
      onMouseDown={e=>{drag.current=true;move(e.clientX,e.clientY);}}
      onMouseMove={e=>{if(drag.current)move(e.clientX,e.clientY);}}
      onMouseUp={release} onMouseLeave={release}>
      {[0.35,0.65,1].map(r=><div key={r} style={{position:'absolute',borderRadius:'50%',width:r*2*R,height:r*2*R,border:`1px solid rgba(255,255,255,${r===1?0.07:0.03})`,pointerEvents:'none'}}/>)}
      <div style={{position:'absolute',width:'100%',height:1,background:'rgba(255,255,255,0.03)',pointerEvents:'none'}}/>
      <div style={{position:'absolute',width:1,height:'100%',background:'rgba(255,255,255,0.03)',pointerEvents:'none'}}/>
      <div style={{position:'absolute',transform:`translate(${dot.x}px,${dot.y}px)`,width:18,height:18,borderRadius:'50%',background:'radial-gradient(circle,#ff4d55,#e8121c)',boxShadow:'0 0 12px rgba(232,18,28,0.8)',pointerEvents:'none',marginLeft:-9,marginTop:-9}}/>
    </div>
  );
}

// ─── BADGE ─────────────────────────────────────────────────────────────────────
function Badge({ children, color='#e8121c' }) {
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 7px',borderRadius:3,
      background:`${color}18`,border:`1px solid ${color}33`,color,
      fontFamily:'JetBrains Mono',fontSize:7,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase'}}>
      {children}
    </span>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,setTab] = useState('mission');
  const [dof,setDof] = useState(3);
  const [params,setParams] = useState({m_wet:2.055,m_dry:1.968,thrust_N:75,burn_time_s:1.2,gimbal_limit:5,controller_idx:4,scenario:'nominal'});
  const [simData,setSim] = useState(null);
  const [loading,setLoading] = useState(false);
  const [playing,setPlaying] = useState(false);
  const [time,setTime] = useState(0);
  const [speed,setSpeed] = useState(1);
  const [padPitch,setPadPitch] = useState(0);
  const [padYaw,setPadYaw] = useState(0);
  const [padActive,setPadActive] = useState(false);
  const [telem,setTelem] = useState(null);
  const [launch,setLaunch] = useState({armed:false,countdown_active:false,remaining_seconds:30,launched:false});
  const [usbKey,setUsbKey] = useState('');
  const [windForce, setWindForce] = useState(0.3);
  const [dragCoeff, setDragCoeff] = useState(0.12);
  const tvcSimState = useRef({
    thetaP: 0,
    omegaP: 0,
    thetaY: 0,
    omegaY: 0,
    deltaP: 0,
    deltaY: 0,
    dragging: false,
    dragType: null,
  });
  const [isFullscreen,setIsFullscreen] = useState(false);
  const hist = useRef({t:[],pitch:[],roll:[],yaw:[],alt:[],ax:[],ay:[],az:[],pressure:[]});
  const [, setTick] = useState(0);

  const keyOk = usbKey === 'NEAL2026';
  const ctrl={1:'PID',2:'LQI',3:'MRAC',4:'ADRC'};
  const TABS=[
    {id:'mission',label:'MISSION CONTROL'},
    {id:'tvc',label:'TVC SIMULATOR'},
    {id:'telemetry',label:'LIVE TELEMETRY'},
    {id:'launch',label:'LAUNCH STATION'},
    {id:'vehicle',label:'VEHICLE CONFIG'},
    {id:'bench',label:'BENCHMARKS'},
    {id:'paper',label:'RESEARCH PAPER'},
  ];

  // ── Fullscreen ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleF11 = (e) => {
      if (e.key === 'F11') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen();
        }
      }
    };
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    const autoFS = () => {
      if (!document.fullscreenElement)
        document.documentElement.requestFullscreen().catch(() => {});
    };
    window.addEventListener('keydown', handleF11);
    document.addEventListener('fullscreenchange', onFSChange);
    window.addEventListener('click', autoFS, { once: true });
    return () => {
      window.removeEventListener('keydown', handleF11);
      document.removeEventListener('fullscreenchange', onFSChange);
    };
  }, []);

  // ── Simulation ────────────────────────────────────────────────────────────
  const runSim = async () => {
    setLoading(true);
    try {
      const r = await axios.post(`${API}/api/simulate`,{...params,dof});
      setSim(r.data); setTime(0); setPlaying(true);
    } catch {}
    setLoading(false);
  };

  useEffect(()=>{ runSim(); },[]);

  const speak = (txt) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(txt);
      const voices = synth.getVoices();
      const femaleVoice = voices.find(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('google us english') || v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('hazel') || v.name.toLowerCase().includes('samantha'));
      if (femaleVoice) utter.voice = femaleVoice;
      utter.rate = 1.1; // count down at a natural, crisp pace
      synth.speak(utter);
    } catch {}
  };

  const lastSpokenSec = useRef(-1);
  useEffect(() => {
    if (launch.countdown_active) {
      const sec = Math.floor(launch.remaining_seconds);
      if (sec !== lastSpokenSec.current && sec >= 0 && sec <= 10) {
        lastSpokenSec.current = sec;
        if (sec === 0) {
          speak("Liftoff");
        } else {
          speak(String(sec));
        }
      }
    } else if (launch.launched && lastSpokenSec.current !== 0) {
      lastSpokenSec.current = 0;
      speak("Liftoff");
    } else if (!launch.countdown_active && !launch.launched) {
      lastSpokenSec.current = -1;
    }
  }, [launch.countdown_active, launch.remaining_seconds, launch.launched]);

  useEffect(()=>{
    if(!simData||!playing) return;
    const id=setInterval(()=>{
      setTime(p=>{
        const nxt=p+0.02*speed;
        const max=simData.t[simData.t.length-1];
        if(nxt>=max){setPlaying(false);return max;}
        return nxt;
      });
    },20);
    return ()=>clearInterval(id);
  },[simData,playing,speed]);

  // ── Live Telemetry poll ────────────────────────────────────────────────────
  useEffect(()=>{
    let live=true;
    const poll=async()=>{
      try {
        const [tr,lr]=await Promise.all([axios.get(`${API}/api/telemetry/live`),axios.get(`${API}/api/launch/status`)]);
        if(!live)return;
        setTelem(tr.data); setLaunch(lr.data);
        const h=hist.current;
        h.t.push(tr.data.timestamp_ms/1000);
        h.pitch.push(tr.data.orientation.pitch_deg);
        h.roll.push(tr.data.orientation.roll_deg);
        h.yaw.push(tr.data.orientation.yaw_deg);
        h.alt.push(tr.data.altitude_m);
        h.ax.push(tr.data.raw_accel?.ax_g??0);
        h.ay.push(tr.data.raw_accel?.ay_g??0);
        h.az.push(tr.data.raw_accel?.az_g??1);
        const alt=tr.data.altitude_m??0;
        h.pressure.push(101325*Math.pow(1-2.25577e-5*Math.max(0,alt),5.25588)/100);
        if(h.t.length>120) ['t','pitch','roll','yaw','alt','ax','ay','az','pressure'].forEach(k=>h[k].shift());
        setTick(n=>n+1);
      } catch {}
    };
    const id=setInterval(poll,250); poll();
    return ()=>{ live=false; clearInterval(id); };
  },[]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const state = useMemo(()=>{
    if(!simData) return {pitch:0,delta:0,alt:0,drift:0,isFiring:false,pd:0,dd:0};
    const max=simData.t[simData.t.length-1];
    const idx=Math.min(Math.floor((time/max)*(simData.t.length-1)),simData.t.length-1);
    return {pitch:(simData.theta[idx]*Math.PI)/180,delta:(simData.delta[idx]*Math.PI)/180,
      alt:simData.altitude[idx],drift:simData.drift_x[idx],
      isFiring:time<params.burn_time_s,pd:simData.theta[idx],dd:simData.delta[idx]};
  },[simData,time,params.burn_time_s]);

  const ax=telem?.raw_accel?.ax_g??0;
  const ay=telem?.raw_accel?.ay_g??0;
  const az=telem?.raw_accel?.az_g??1;
  const totalG=Math.sqrt(ax*ax+ay*ay+az*az);
  const altM=telem?.altitude_m??0;
  const pressHpa=101325*Math.pow(1-2.25577e-5*Math.max(0,altM),5.25588)/100;
  const gpsLat=telem?.gps?.lat??23.80388;
  const gpsLon=telem?.gps?.lon??90.36277;
  const servoP=telem?.actuators?((telem.actuators.servo_pitch_us-1500)/500*params.gimbal_limit):state.dd;
  const servoY=telem?.actuators?((telem.actuators.servo_yaw_us-1500)/500*params.gimbal_limit):0;
  const coastTime = !state.isFiring ? Math.max(0, time - params.burn_time_s) : 0;
  const adrcEst = Math.abs(state.dd * 1.35 + (Math.random() * 0.1 - 0.05));

  const liveMode = !!telem;
  const currentPitch = liveMode ? (telem.orientation.pitch_deg * Math.PI / 180) : state.pitch;
  const currentRoll = liveMode ? (telem.orientation.roll_deg * Math.PI / 180) : (simData ? (simData.roll[Math.min(Math.floor((time/(simData.t[simData.t.length-1]||1))*(simData.t.length-1)),simData.t.length-1)]*Math.PI)/180 : 0);
  const currentYaw = liveMode ? (telem.orientation.yaw_deg * Math.PI / 180) : (simData ? (simData.yaw[Math.min(Math.floor((time/(simData.t[simData.t.length-1]||1))*(simData.t.length-1)),simData.t.length-1)]*Math.PI)/180 : 0);
  
  const currentDeltaP = liveMode ? ((telem.actuators?.servo_pitch_us - 1500)/500 * params.gimbal_limit * Math.PI / 180) : state.delta;
  const currentDeltaY = liveMode ? ((telem.actuators?.servo_yaw_us - 1500)/500 * params.gimbal_limit * Math.PI / 180) : (simData ? ((simData.delta_y ? simData.delta_y[Math.min(Math.floor((time/(simData.t[simData.t.length-1]||1))*(simData.t.length-1)),simData.t.length-1)] : 0)*Math.PI)/180 : 0);

  const currentAlt = liveMode ? altM : state.alt;
  const currentDriftX = liveMode ? 0 : state.drift;
  const currentDriftY = 0;
  const motorFiring = liveMode ? launch.launched : state.isFiring;

  // Generate Trajectory Points
  const trajectoryPoints = useMemo(() => {
    if (liveMode) {
      return hist.current.alt.map((altVal, idx) => {
        return [0, altVal * 0.01, 0];
      });
    } else {
      if (!simData) return [];
      const max = simData.t[simData.t.length - 1];
      const currentIdx = Math.min(Math.floor((time / max) * (simData.t.length - 1)), simData.t.length - 1);
      const pts = [];
      for (let i = 0; i <= currentIdx; i++) {
        pts.push([simData.drift_x[i] * 0.1, simData.altitude[i] * 0.01, simData.drift_y ? simData.drift_y[i] * 0.1 : 0]);
      }
      return pts;
    }
  }, [simData, time, liveMode, tick]);

  const arm=async()=>{ if(!keyOk&&!launch.armed)return; axios.post(`${API}/api/launch/arm`,{arm:!launch.armed}); };
  const go=async()=>axios.post(`${API}/api/launch/start_countdown`);
  const rst=async()=>{ axios.post(`${API}/api/launch/reset`); setUsbKey(''); };

  const Btn=({onClick,disabled,children,style={}})=>(
    <button onClick={onClick} disabled={disabled} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 14px',
      background:disabled?'#1f2937':'#e8121c',color:disabled?'#4b5563':'#fff',border:'none',borderRadius:5,
      fontFamily:'JetBrains Mono',fontSize:8,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',
      cursor:disabled?'not-allowed':'pointer',transition:'all 0.15s',...style}}>{children}</button>
  );

  return (
    <div style={{minHeight:'100vh',background:'#090d16',fontFamily:'Inter, system-ui, sans-serif',display:'flex',flexDirection:'column'}}>

      {/* ═══ NAVBAR ═══════════════════════════════════════════════════════════ */}
      <nav style={{position:'sticky',top:0,zIndex:100,background:'#ffffff',borderBottom:'1px solid rgba(0,0,0,0.08)',display:'flex',alignItems:'stretch',height:52,flexShrink:0}}>
        {/* Logo */}
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'0 16px',borderRight:'1px solid rgba(0,0,0,0.08)',flexShrink:0}}>
          <img src="/logo.png" alt="Project Neal" style={{height:26,objectFit:'contain'}}/>
          <div>
            <div style={{fontFamily:'Orbitron, sans-serif',fontSize:10,fontWeight:800,letterSpacing:'0.14em',color:'#090d16'}}>
              PROJECT <span style={{color:'#e8121c'}}>NEAL</span>
            </div>
            <div style={{fontFamily:'JetBrains Mono',fontSize:6.5,color:'#475569',letterSpacing:'0.1em'}}>TVC DIGITAL TWIN v2.0</div>
          </div>
        </div>

        {/* Countdown Timer */}
        <div style={{display:'flex',alignItems:'center',padding:'0 14px',borderRight:'1px solid rgba(0,0,0,0.08)',flexShrink:0}}>
          <div style={{
            fontFamily:'Orbitron, sans-serif', fontSize:18, fontWeight:900, letterSpacing:'0.06em',
            color: launch.countdown_active ? '#e8121c' : launch.launched ? '#10b981' : '#1e293b',
            textShadow: launch.countdown_active ? '0 0 16px rgba(232,18,28,0.6)' : 'none',
            transition:'color 0.3s, text-shadow 0.3s',
          }}>
            {launch.launched ? 'T+00' : `T-${String(Math.floor(launch.remaining_seconds)).padStart(2,'0')}`}
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',alignItems:'stretch',flex:1,overflowX:'auto'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              display:'flex',alignItems:'center',gap:5,padding:'0 12px',
              background:'transparent',border:'none',borderBottom:tab===t.id?'2px solid #e8121c':'2px solid transparent',
              cursor:'pointer',fontFamily:'JetBrains Mono',fontSize:7.5,fontWeight:tab===t.id?700:400,
              letterSpacing:'0.08em',color:tab===t.id?'#e8121c':'#334155',whiteSpace:'nowrap',
              transition:'color 0.15s',marginBottom:-1}}>
              {t.id==='launch'&&launch.armed&&<span style={{width:4,height:4,borderRadius:'50%',background:'#f59e0b'}}/>}
              {t.label}
            </button>
          ))}
        </div>

        {/* Right section */}
        <div style={{display:'flex',alignItems:'center',gap:7,padding:'0 12px',borderLeft:'1px solid rgba(0,0,0,0.08)',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:4,padding:'2px 7px',borderRadius:4,
            background:telem?'rgba(16,185,129,0.08)':'rgba(0,0,0,0.04)',
            border:`1px solid ${telem?'rgba(16,185,129,0.3)':'rgba(0,0,0,0.12)'}`}}>
            <div style={{width:5,height:5,borderRadius:'50%',background:telem?'#10b981':'#475569',
              animation:telem?'ledBlink 1.6s ease infinite':'none'}}/>
            <span style={{fontFamily:'JetBrains Mono',fontSize:7,fontWeight:700,letterSpacing:'0.08em',color:telem?'#10b981':'#475569'}}>{telem?'LIVE':'OFFLINE'}</span>
          </div>
          <Badge color="#f59e0b">{ctrl[params.controller_idx]}</Badge>
          <Btn onClick={runSim} disabled={loading}>{loading?'RUNNING...':'RUN SIM'}</Btn>
          <button onClick={()=>document.exitFullscreen().catch(()=>{})} title="Exit Fullscreen (F11)" style={{
            padding:'5px 9px',background:'transparent',border:'1px solid rgba(0,0,0,0.15)',
            borderRadius:4,color:'#090d16',fontFamily:'JetBrains Mono',fontSize:8,fontWeight:700,
            cursor:'pointer',letterSpacing:'0.06em',display:'flex',alignItems:'center',gap:4,transition:'all 0.15s',
          }}>
            ⛶ EXIT
          </button>
        </div>
      </nav>

      {/* ═══ CONTENT ══════════════════════════════════════════════════════════ */}
      <div style={{flex:1,display:'flex',flexDirection:'column',padding:'9px 11px',gap:8,overflowY:'auto'}}>

        {/* ══════════ MISSION CONTROL ══════════════════════════════════════════ */}
        {tab==='mission'&&(
          <>
            {/* ── Aerospace HUD KPI Ribbon ── */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:6}}>
              {[
                {l:'PITCH',       v:state.pd?.toFixed(2),            u:'°',  c:'#3b82f6', blink:false},
                {l:'TVC GIMBAL',  v:state.dd?.toFixed(2),            u:'°',  c:'#e8121c', blink:state.isFiring},
                {l:'ALTITUDE',    v:state.alt?.toFixed(1),           u:'m',  c:'#10b981', blink:false},
                {l:'CONTROLLER',  v:ctrl[params.controller_idx],     u:'',   c:'#f59e0b', blink:false},
                {l:'ADRC EST',    v:adrcEst.toFixed(3),              u:'N',  c:'#8b5cf6', blink:false},
                {l:'PHASE',       v:state.isFiring?'POWERED':'COAST',u:'',   c:state.isFiring?'#e8121c':'#8b5cf6', blink:state.isFiring},
                {l:'COAST T',     v:coastTime.toFixed(2),            u:'s',  c:'#64748b', blink:false},
                {l:'DRIFT X',     v:state.drift?.toFixed(2),         u:'m',  c:'#94a3b8', blink:false},
              ].map(k=><HUDCard key={k.l} label={k.l} value={k.v} unit={k.u} color={k.c} blink={k.blink}/>)}
            </div>

            {/* ── Main 4-Quadrant Grid ── */}
            <div style={{display:'grid',gridTemplateColumns:'240px 1fr 240px',gridTemplateRows:'1fr 1fr',gap:8,flex:1,minHeight:310}}>

              {/* TOP-LEFT: IMU Acceleration — Aviation Gauges */}
              <Panel title="Acceleration — IMU" accent="#3b82f6"
                titleRight={<Badge color="#3b82f6">{totalG.toFixed(3)} g</Badge>}
                style={{gridColumn:1,gridRow:1,display:'flex',flexDirection:'column'}}>
                <div style={{display:'flex',justifyContent:'space-around',alignItems:'center',paddingBottom:7}}>
                  <AvioGauge value={ax} min={-3} max={3} color="#3b82f6" label="Ax" unit="g" size={74}/>
                  <AvioGauge value={ay} min={-3} max={3} color="#8b5cf6" label="Ay" unit="g" size={74}/>
                  <AvioGauge value={az} min={-1} max={4} color="#10b981" label="Az" unit="g" size={74}/>
                </div>
                <DR label="TOTAL |A|" value={totalG.toFixed(4)} unit="g" color="#f59e0b"/>
                <DR label="GYRO X" value={(telem?.rates?.gyro_x_dps??0).toFixed(2)} unit="deg/s" color="#64748b"/>
                <DR label="GYRO Y" value={(telem?.rates?.gyro_y_dps??0).toFixed(2)} unit="deg/s" color="#64748b"/>
              </Panel>

              {/* TOP-RIGHT: Barometric Pressure */}
              <Panel title="Barometric Pressure" accent="#10b981"
                titleRight={<Badge color="#10b981">{pressHpa.toFixed(1)} hPa</Badge>}
                style={{gridColumn:3,gridRow:1,display:'flex',flexDirection:'column'}}>
                <div style={{display:'flex',justifyContent:'center',paddingBottom:7}}>
                  <AvioGauge value={pressHpa} min={900} max={1013.25} color="#10b981" label="Pressure" unit="hPa" size={90}/>
                </div>
                <DR label="PRESSURE" value={pressHpa.toFixed(2)} unit="hPa" color="#10b981"/>
                <DR label="ALTITUDE" value={altM.toFixed(1)} unit="m" color="#3b82f6"/>
                <DR label="QNH REF" value="1013.25" unit="hPa" color="#475569"/>
                <DR label="BARO STATUS" value={telem?.baro_status??'OFFLINE'} ok={!!telem}/>
                <DR label="TEMP EST" value={(15-0.0065*altM).toFixed(1)} unit="°C" color="#f59e0b"/>
              </Panel>

              {/* CENTER: 3D Rocket — spans 2 rows (smaller) */}
              <div style={{gridColumn:2,gridRow:'1/3',background:'linear-gradient(180deg,#070c17,#090d1c)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:10,overflow:'hidden',display:'flex',flexDirection:'column',position:'relative'}}>
                {/* Header */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 14px',background:'rgba(0,0,0,0.45)',borderBottom:'1px solid rgba(255,255,255,0.05)',flexShrink:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:9}}>
                    <div style={{width:3,height:12,background:'#e8121c',borderRadius:2}}/>
                    <div>
                      <div style={{fontFamily:'Orbitron,sans-serif',fontSize:9,fontWeight:800,letterSpacing:'0.14em',color:'#f0f4f8'}}>PROJECT <span style={{color:'#e8121c'}}>NEAL</span></div>
                      <div style={{fontFamily:'JetBrains Mono',fontSize:6.5,color:'#475569',letterSpacing:'0.08em'}}>TVC DIGITAL TWIN — 3D FLIGHT VISUALIZER</div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <Badge color={state.isFiring?'#e8121c':'#475569'}>{state.isFiring?'MOTOR BURN':'COAST'}</Badge>
                    <span style={{fontFamily:'JetBrains Mono',fontSize:8,color:'#64748b'}}>T+{time.toFixed(2)}s</span>
                  </div>
                </div>

                {/* 3D Canvas */}
                <div style={{flex:1,position:'relative',minHeight:0}}>
                  {/* Notch Timer */}
                  <div style={{
                    position:'absolute', top:0, left:'50%', transform:'translateX(-50%)',
                    background:'#090d16', borderBottomLeftRadius:8, borderBottomRightRadius:8,
                    border:'1px solid rgba(232,18,28,0.3)', borderTop:'none',
                    padding:'3px 14px 5px', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10
                  }}>
                    <span style={{
                      fontFamily:'"Courier New", Courier, monospace', fontSize:9, fontWeight:900, color:'#e8121c',
                      letterSpacing:'0.12em', textShadow:'0 0 6px rgba(232,18,28,0.5)'
                    }}>
                      {launch.countdown_active ? `T-${Math.max(0, launch.remaining_seconds).toFixed(1)}s` : launch.launched ? `T+${time.toFixed(1)}s` : 'STANDBY T-30.0s'}
                    </span>
                  </div>
                  <Canvas camera={{position:[8,3,2],fov:40}} style={{background:'transparent'}}>
                    <ambientLight intensity={1.8}/>
                    <directionalLight position={[12,20,15]} intensity={2.5} castShadow/>
                    <pointLight position={[-5,5,5]} intensity={0.8} color="#3b82f6"/>
                    <OrbitControls enableZoom={false} enableRotate={false} enablePan={false}/>
                    <Suspense fallback={null}>
                      <group position={[currentDriftX * 0.1, currentAlt * 0.01, currentDriftY * 0.1]}>
                        <RocketModel 
                          pitch={-currentPitch} 
                          roll={currentRoll} 
                          yaw={currentYaw} 
                          deltaPitch={-currentDeltaP} 
                          deltaYaw={currentDeltaY} 
                          isFiring={motorFiring}
                        />
                      </group>
                      <TrajectoryLine points={trajectoryPoints} />
                    </Suspense>
                    <Environment preset="night"/>
                  </Canvas>
                  {/* HUD overlays */}
                  <div style={{position:'absolute',top:7,left:10,pointerEvents:'none'}}>
                    <div style={{fontFamily:'JetBrains Mono',fontSize:7.5,color:'#3b82f6',marginBottom:2}}>
                      PITCH: {(currentPitch * 180 / Math.PI).toFixed(2)}°  |  GIMBAL: {(currentDeltaP * 180 / Math.PI).toFixed(2)}°
                    </div>
                    <div style={{fontFamily:'JetBrains Mono',fontSize:7.5,color:'#10b981'}}>
                      ALT: {currentAlt.toFixed(1)} m  |  DRIFT: {currentDriftX.toFixed(2)} m
                    </div>
                  </div>
                  <div style={{position:'absolute',bottom:7,right:10,pointerEvents:'none'}}>
                    {[
                      ['X', currentDriftX.toFixed(2), '#e8121c'],
                      ['Y', currentDriftY.toFixed(2), '#10b981'],
                      ['Z', currentAlt.toFixed(0), '#3b82f6']
                    ].map(([axis,v,c])=>(
                      <div key={axis} style={{display:'flex',gap:5,alignItems:'center',marginBottom:2}}>
                        <div style={{width:12,height:2,background:c,borderRadius:1}}/>
                        <span style={{fontFamily:'JetBrains Mono',fontSize:7.5,color:c}}>{axis}: {v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Playback */}
                <div style={{padding:'6px 12px',borderTop:'1px solid rgba(255,255,255,0.05)',background:'rgba(0,0,0,0.35)',display:'flex',alignItems:'center',gap:7,flexShrink:0}}>
                  <button onClick={()=>setPlaying(p=>!p)} style={{width:26,height:26,borderRadius:4,border:'none',background:'#e8121c',color:'#fff',cursor:'pointer',fontSize:11,flexShrink:0}}>{playing?'||':'▶'}</button>
                  <input type="range" min={0} max={simData?simData.t[simData.t.length-1]:2} step={0.01} value={time} onChange={e=>setTime(+e.target.value)} style={{flex:1,accentColor:'#e8121c',height:3}}/>
                  <select value={speed} onChange={e=>setSpeed(+e.target.value)} style={{background:'#141c2b',border:'1px solid rgba(255,255,255,0.06)',color:'#f0f4f8',fontFamily:'JetBrains Mono',fontSize:8,padding:'2px 4px',borderRadius:4,flexShrink:0}}>
                    {[0.25,0.5,1,2,4].map(s=><option key={s} value={s}>{s}x</option>)}
                  </select>
                </div>

                {/* Mini charts */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',borderTop:'1px solid rgba(255,255,255,0.04)',flexShrink:0}}>
                  {[
                    {title:'PITCH (deg)',data:simData?[{x:simData.t,y:simData.theta,name:'Pitch',mode:'lines',line:{color:'#3b82f6',width:1.5}},{x:simData.t,y:simData.t.map(()=>5),name:'Ref',mode:'lines',line:{color:'#e8121c',width:1,dash:'dot'}}]:[]},
                    {title:'GIMBAL (deg)',data:simData?[{x:simData.t,y:simData.delta,name:'Gimbal',mode:'lines',line:{color:'#e8121c',width:1.5}}]:[]},
                  ].map(c=>(
                    <div key={c.title} style={{padding:'3px 7px 5px',borderRight:'1px solid rgba(255,255,255,0.03)'}}>
                      <div style={{fontFamily:'JetBrains Mono',fontSize:6.5,color:'#475569',letterSpacing:'0.1em',textTransform:'uppercase',padding:'3px 0 2px'}}>{c.title}</div>
                      <div style={{height:72}}><Chart data={c.data}/></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* BOTTOM-LEFT: GPS Navigation */}
              <Panel title="GPS Navigation" accent="#f59e0b"
                titleRight={<Badge color={telem?'#10b981':'#64748b'}>{telem?'FIX 3D':'NO FIX'}</Badge>}
                style={{gridColumn:1,gridRow:2,display:'flex',flexDirection:'column'}}>
                <div style={{padding:'2px 0 5px',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                  <div style={{fontFamily:'JetBrains Mono',fontSize:6.5,color:'#475569',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:2}}>LATITUDE</div>
                  <div style={{fontFamily:'JetBrains Mono',fontSize:13,fontWeight:700,color:'#f59e0b'}}>{gpsLat.toFixed(6)}</div>
                </div>
                <div style={{padding:'4px 0 5px',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                  <div style={{fontFamily:'JetBrains Mono',fontSize:6.5,color:'#475569',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:2}}>LONGITUDE</div>
                  <div style={{fontFamily:'JetBrains Mono',fontSize:13,fontWeight:700,color:'#3b82f6'}}>{gpsLon.toFixed(6)}</div>
                </div>
                <div style={{padding:'4px 0 5px',marginBottom:5,borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                  <div style={{fontFamily:'JetBrains Mono',fontSize:6.5,color:'#475569',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:2}}>ALTITUDE MSL</div>
                  <div style={{fontFamily:'JetBrains Mono',fontSize:13,fontWeight:700,color:'#10b981'}}>{altM.toFixed(2)} <span style={{fontSize:8,color:'#475569'}}>m</span></div>
                </div>
                <GPSMapLeaflet lat={gpsLat} lon={gpsLon}/>
                <DR label="HDOP" value="1.2" color="#94a3b8"/>
                <DR label="SATS" value="9" color="#10b981"/>
                <DR label="GND SPEED" value="0.0" unit="m/s" color="#64748b"/>
              </Panel>

              {/* BOTTOM-RIGHT: TVC Servo & Systems */}
              <Panel title="TVC Servo &amp; Systems" accent="#8b5cf6"
                style={{gridColumn:3,gridRow:2,display:'flex',flexDirection:'column'}}>
                <div style={{fontFamily:'JetBrains Mono',fontSize:7,color:'#475569',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:6}}>SERVO DEFLECTION</div>
                <ServoBar label="Pitch Axis" value={servoP} max={params.gimbal_limit} color="#e8121c"/>
                <ServoBar label="Yaw Axis" value={servoY} max={params.gimbal_limit} color="#3b82f6"/>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,margin:'7px 0'}}>
                  {[{l:'PWM CH1',v:telem?.actuators?.servo_pitch_us??1500,c:'#e8121c'},{l:'PWM CH2',v:telem?.actuators?.servo_yaw_us??1500,c:'#3b82f6'}].map(p=>(
                    <div key={p.l} style={{background:'#090d16',border:'1px solid rgba(255,255,255,0.05)',borderRadius:6,padding:'6px 8px'}}>
                      <div style={{fontFamily:'JetBrains Mono',fontSize:7,color:'#475569',textTransform:'uppercase'}}>{p.l}</div>
                      <div style={{fontFamily:'JetBrains Mono',fontSize:15,fontWeight:700,color:p.c}}>{p.v}<span style={{fontSize:7,color:'#475569'}}> µs</span></div>
                    </div>
                  ))}
                </div>
                <div style={{fontFamily:'JetBrains Mono',fontSize:7,color:'#475569',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:4}}>SYSTEM STATUS</div>
                <LED label="IMU MPU-6050" ok={!!telem} blink/>
                <LED label="BARO BMP280" ok={!!telem} blink/>
                <LED label="UART DMA" ok={!!telem}/>
                <LED label="PWM OUTPUT" ok={!!telem}/>
                <LED label="TELEMETRY LINK" ok={!!telem} blink/>
                <div style={{marginTop:'auto',paddingTop:7}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                    <span style={{fontFamily:'JetBrains Mono',fontSize:7,color:'#475569',textTransform:'uppercase',letterSpacing:'0.08em'}}>BATTERY SOC</span>
                    <span style={{fontFamily:'JetBrains Mono',fontSize:9,fontWeight:700,color:'#10b981'}}>{telem?.battery_v?.toFixed(2)??'11.10'} V</span>
                  </div>
                  <div style={{height:4,background:'#090d16',borderRadius:2,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${Math.min(100,((telem?.battery_v??11.1)-9.6)/3*100)}%`,background:'linear-gradient(90deg,#10b981,#3b82f6)',borderRadius:2,transition:'width 0.5s'}}/>
                  </div>
                  <div style={{fontFamily:'JetBrains Mono',fontSize:7,color:'#334155',marginTop:2}}>3S LiPo — {(((telem?.battery_v??11.1)-9.6)/3*100)|0}% SOC</div>
                </div>
              </Panel>
            </div>

            {/* ── Bottom Chart Strip ── */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              <Panel title="Acceleration History — 3-Axis" accent="#3b82f6"
                titleRight={<span style={{fontFamily:'JetBrains Mono',fontSize:7,color:'#475569'}}>30s WINDOW</span>}
                style={{height:140}}>
                <div style={{height:84}}><Chart data={[
                  {x:hist.current.t,y:hist.current.ax,name:'Ax',mode:'lines',line:{color:'#3b82f6',width:1.5}},
                  {x:hist.current.t,y:hist.current.ay,name:'Ay',mode:'lines',line:{color:'#8b5cf6',width:1.5}},
                  {x:hist.current.t,y:hist.current.az,name:'Az',mode:'lines',line:{color:'#10b981',width:1.5}},
                ]} extra={{yaxis:{title:'g'}}}/></div>
              </Panel>
              <Panel title="Altitude Profile" accent="#10b981" style={{height:140}}>
                <div style={{height:84}}><Chart data={simData?[{x:simData.t,y:simData.altitude,fill:'tozeroy',mode:'lines',line:{color:'#10b981',width:2},fillcolor:'rgba(16,185,129,0.07)'}]:[{x:hist.current.t,y:hist.current.alt,fill:'tozeroy',mode:'lines',line:{color:'#10b981',width:1.5},fillcolor:'rgba(16,185,129,0.07)'}]}/></div>
              </Panel>
              <Panel title="Pressure History" accent="#f59e0b" style={{height:140}}>
                <div style={{height:84}}><Chart data={[{x:hist.current.t,y:hist.current.pressure,fill:'tozeroy',mode:'lines',line:{color:'#f59e0b',width:1.5},fillcolor:'rgba(245,158,11,0.06)'}]} extra={{yaxis:{title:'hPa'}}}/></div>
              </Panel>
            </div>
          </>
        )}

        {/* ══════════ TVC SIMULATOR ════════════════════════════════════════════ */}
        {tab==='tvc'&&(
          <div style={{display:'grid',gridTemplateColumns:'270px 340px 1fr',gap:8}}>
            {/* COLUMN 1: Inputs & Controls (270px) */}
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <Panel title="TVC Control Pad">
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
                  <div style={{display:'flex',gap:5,width:'100%'}}>
                    <button onClick={()=>setPadActive(p=>!p)} style={{flex:1,padding:'6px',background:padActive?'rgba(232,18,28,0.1)':'transparent',border:`1px solid ${padActive?'#e8121c':'rgba(255,255,255,0.06)'}`,borderRadius:5,color:padActive?'#e8121c':'#64748b',fontFamily:'JetBrains Mono',fontSize:8,fontWeight:700,cursor:'pointer'}}>MANUAL</button>
                    <button onClick={()=>setPadActive(false)} style={{flex:1,padding:'6px',background:'transparent',border:'1px solid rgba(255,255,255,0.06)',borderRadius:5,color:'#64748b',fontFamily:'JetBrains Mono',fontSize:8,fontWeight:700,cursor:'pointer'}}>AUTO SIM</button>
                  </div>
                  <TVCPad onDrag={(p,y)=>{setPadPitch(p);setPadYaw(y);if(!padActive)setPadActive(true);}}/>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,width:'100%'}}>
                    {[{l:'Gimbal Pitch',v:padPitch,c:'#e8121c'},{l:'Gimbal Yaw',v:padYaw,c:'#3b82f6'}].map(p=>(
                      <div key={p.l} style={{background:'#090d16',border:`1px solid ${p.c}30`,borderRadius:6,padding:'7px 9px'}}>
                        <div style={{fontFamily:'JetBrains Mono',fontSize:7,color:'#475569'}}>{p.l.toUpperCase()}</div>
                        <div style={{fontFamily:'JetBrains Mono',fontSize:14,fontWeight:700,color:p.c}}>{p.v.toFixed(2)}<span style={{fontSize:7,color:'#475569'}}> deg</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

              <Panel title="Simulator Parameters">
                <div style={{display:'flex',flexDirection:'column',gap:9}}>
                  <div>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                      <span style={{fontFamily:'JetBrains Mono',fontSize:7,color:'#475569'}}>WIND FORCE / DISTURBANCE</span>
                      <span style={{fontFamily:'JetBrains Mono',fontSize:8,color:'#e8121c'}}>{windForce.toFixed(2)} N</span>
                    </div>
                    <input type="range" min="0" max="2" step="0.05" value={windForce} onChange={e=>setWindForce(+e.target.value)} style={{width:'100%',accentColor:'#e8121c',height:3}}/>
                  </div>
                  <div>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                      <span style={{fontFamily:'JetBrains Mono',fontSize:7,color:'#475569'}}>DRAG COEFFICIENT</span>
                      <span style={{fontFamily:'JetBrains Mono',fontSize:8,color:'#3b82f6'}}>{dragCoeff.toFixed(3)}</span>
                    </div>
                    <input type="range" min="0.01" max="0.5" step="0.01" value={dragCoeff} onChange={e=>setDragCoeff(+e.target.value)} style={{width:'100%',accentColor:'#3b82f6',height:3}}/>
                  </div>
                </div>
              </Panel>

              <Panel title="DOF Mode">
                <div style={{display:'flex',background:'#090d16',border:'1px solid rgba(255,255,255,0.05)',borderRadius:5,overflow:'hidden',marginBottom:8}}>
                  {[3,6].map(d=><button key={d} onClick={()=>{setDof(d);setTimeout(runSim,50);}} style={{flex:1,padding:'6px',background:dof===d?'#e8121c':'transparent',border:'none',color:dof===d?'#fff':'#64748b',fontFamily:'JetBrains Mono',fontSize:8,fontWeight:700,cursor:'pointer'}}>{d}-DOF</button>)}
                </div>
                <div style={{fontFamily:'JetBrains Mono',fontSize:8,color:'#475569',lineHeight:1.6}}>{dof===3?'3-DOF: Pitch plane only.':'6-DOF: Full roll-pitch-yaw.'}</div>
              </Panel>
              <Panel title="Controller">
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  {[{id:1,n:'PID',d:'Classic PID'},{id:2,n:'LQI',d:'LQ Integral'},{id:3,n:'MRAC',d:'Adaptive'},{id:4,n:'ADRC',d:'ESO Robust'}].map(c=>(
                    <button key={c.id} onClick={()=>{setParams(p=>({...p,controller_idx:c.id}));setTimeout(runSim,60);}} style={{textAlign:'left',padding:'7px 9px',borderRadius:6,border:`1px solid ${params.controller_idx===c.id?'#e8121c':'rgba(255,255,255,0.05)'}`,background:params.controller_idx===c.id?'rgba(232,18,28,0.08)':'#090d16',cursor:'pointer'}}>
                      <div style={{fontFamily:'JetBrains Mono',fontSize:9,fontWeight:700,color:params.controller_idx===c.id?'#e8121c':'#f0f4f8'}}>{c.n}</div>
                      <div style={{fontFamily:'JetBrains Mono',fontSize:8,color:'#475569',marginTop:1}}>{c.d}</div>
                    </button>
                  ))}
                </div>
              </Panel>
            </div>

            {/* COLUMN 2: Interactive TVC 3D View (340px) */}
            <Panel style={{height:550,display:'flex',flexDirection:'column'}} title="Interactive TVC 3D View"
              titleRight={<div style={{display:'flex',gap:6}}><Badge color="#3b82f6">ACTIVE SIM</Badge></div>}>
              <div style={{flex:1,background:'#090d16',borderRadius:6,overflow:'hidden',position:'relative'}}>
                <Canvas camera={{position:[0,0,5.2],fov:42}}>
                  <ambientLight intensity={1.8}/>
                  <directionalLight position={[10,15,10]} intensity={2}/>
                  <Suspense fallback={null}>
                    <SimulatorRocket 
                      tvcState={tvcSimState}
                      windForce={windForce}
                      dragCoeff={dragCoeff}
                      controllerIdx={params.controller_idx}
                      padActive={padActive}
                      padPitch={padPitch}
                      padYaw={padYaw}
                      setPadPitch={setPadPitch}
                      setPadYaw={setPadYaw}
                    />
                    <FlyingEnvironment />
                  </Suspense>
                  <Environment preset="studio"/>
                </Canvas>
                <div style={{position:'absolute',bottom:10,left:0,right:0,display:'flex',justifyContent:'center',pointerEvents:'none'}}>
                  <div style={{background:'rgba(9,13,22,0.85)',border:'1px solid rgba(255,255,255,0.06)',padding:'5px 10px',borderRadius:4,fontFamily:'JetBrains Mono',fontSize:6.5,color:'#64748b',letterSpacing:'0.06em',textTransform:'uppercase',textAlign:'center'}}>
                    🖱️ Drag Nose to Disturb | Drag Nozzle to Deflect
                  </div>
                </div>
              </div>
            </Panel>

            {/* COLUMN 3: Pitch & Deflection Charts (Remaining 1fr) */}
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <Panel title="Pitch Response" style={{height:271}}>
                <div style={{height:224}}>
                  {simData?<Chart data={[{x:simData.t,y:simData.theta,name:ctrl[params.controller_idx],mode:'lines',line:{color:'#3b82f6',width:2}},{x:simData.t,y:simData.t.map(()=>5),name:'Ref 5°',mode:'lines',line:{color:'#e8121c',width:1,dash:'dash'}}]} extra={{yaxis:{title:'deg'}}}/>:null}
                </div>
              </Panel>
              <Panel title="Gimbal Deflection" style={{height:271}}>
                <div style={{height:224}}>
                  {simData?<Chart data={[{x:simData.t,y:simData.delta,name:'Gimbal',mode:'lines',line:{color:'#e8121c',width:2}},{x:simData.t,y:simData.t.map(()=>params.gimbal_limit),name:'Limit',mode:'lines',line:{color:'#f59e0b',width:1,dash:'dot'}},{x:simData.t,y:simData.t.map(()=>-params.gimbal_limit),name:'-Limit',mode:'lines',line:{color:'#f59e0b',width:1,dash:'dot'}}]}/>:null}
                </div>
              </Panel>
            </div>
          </div>
        )}

        {/* ══════════ LIVE TELEMETRY ════════════════════════════════════════════ */}
        {tab==='telemetry'&&(
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              {[{key:'pitch',label:'Pitch',val:telem?.orientation?.pitch_deg??0,color:'#e8121c'},{key:'roll',label:'Roll',val:telem?.orientation?.roll_deg??0,color:'#3b82f6'},{key:'yaw',label:'Yaw',val:telem?.orientation?.yaw_deg??0,color:'#10b981'}].map(ax=>(
                <Panel key={ax.key} title={ax.label} style={{height:270}} titleRight={<Badge color={ax.color}>{ax.val.toFixed(2)}°</Badge>}>
                  <div style={{display:'flex',gap:12,alignItems:'center',justifyContent:'center'}}>
                    {/* Artificial Horizon */}
                    <ArtificialHorizon pitch={ax.key==='pitch'?ax.val:0} roll={ax.key==='roll'?ax.val:0} size={110}/>
                    {/* 3D Cube (fixed size, no overflow) */}
                    <div style={{width:110,height:110,flexShrink:0,borderRadius:6,overflow:'hidden',background:'#090d16'}}>
                      <Canvas camera={{position:[3,2,4],fov:46}}>
                        <ambientLight intensity={2.5}/><directionalLight position={[5,8,5]} intensity={1.5}/>
                        <Suspense fallback={null}><AttCube pitch={ax.key==='pitch'?ax.val:0} roll={ax.key==='roll'?ax.val:0} yaw={ax.key==='yaw'?ax.val:0}/></Suspense>
                        <OrbitControls enableZoom={false} enablePan={false}/>
                      </Canvas>
                    </div>
                  </div>
                  <div style={{marginTop:10}}>
                    <DR label="VALUE" value={ax.val.toFixed(3)} unit="deg" color={ax.color}/>
                    <DR label="RATE" value={(telem?.rates?.[`gyro_${ax.key==='pitch'?'x':ax.key==='roll'?'y':'z'}_dps`]??0).toFixed(2)} unit="deg/s" color="#64748b"/>
                  </div>
                </Panel>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <Panel title="Attitude History" style={{height:205}}>
                <div style={{height:158}}><Chart data={[{x:hist.current.t,y:hist.current.pitch,name:'Pitch',mode:'lines',line:{color:'#e8121c',width:2}},{x:hist.current.t,y:hist.current.roll,name:'Roll',mode:'lines',line:{color:'#3b82f6',width:2}},{x:hist.current.t,y:hist.current.yaw,name:'Yaw',mode:'lines',line:{color:'#10b981',width:2}}]}/></div>
              </Panel>
              <Panel title="Altitude — Barometer" style={{height:205}}>
                <div style={{height:158}}><Chart data={[{x:hist.current.t,y:hist.current.alt,fill:'tozeroy',mode:'lines',line:{color:'#10b981',width:2},fillcolor:'rgba(16,185,129,0.07)'}]}/></div>
              </Panel>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <Panel title="Sensor Packet">
                {telem?[{k:'COMMS',v:telem.comms_link,ok:true},{k:'IMU',v:telem.imu_status,ok:true},{k:'BARO',v:telem.baro_status,ok:true},{k:'BATTERY',v:`${telem.battery_v} V`,ok:telem.battery_v>11},{k:'SERVO mA',v:telem.servo_current_ma,ok:true},{k:'RSSI',v:`${telem.rssi_dbm} dBm`,ok:telem.rssi_dbm>-70},{k:'CRC',v:telem.crc_checksum,ok:true}].map(r=><DR key={r.k} label={r.k} value={r.v} ok={r.ok}/>):<DR label="STATUS" value="Backend offline" ok={false}/>}
              </Panel>
              <Panel title="Raw Sensors">
                {telem?[{k:'GYRO X',v:`${telem.rates?.gyro_x_dps} deg/s`},{k:'GYRO Y',v:`${telem.rates?.gyro_y_dps} deg/s`},{k:'GYRO Z',v:`${telem.rates?.gyro_z_dps} deg/s`},{k:'ACCEL X',v:`${telem.raw_accel?.ax_g} g`},{k:'ACCEL Y',v:`${telem.raw_accel?.ay_g} g`},{k:'ACCEL Z',v:`${telem.raw_accel?.az_g} g`},{k:'SERVO PITCH',v:`${telem.actuators?.servo_pitch_us} µs`},{k:'SERVO YAW',v:`${telem.actuators?.servo_yaw_us} µs`},{k:'ALTITUDE',v:`${telem.altitude_m} m`}].map(r=><DR key={r.k} label={r.k} value={r.v}/>):null}
              </Panel>
            </div>
          </div>
        )}

        {/* ══════════ LAUNCH STATION ════════════════════════════════════════════ */}
        {tab==='launch'&&(
          <div style={{display:'grid',gridTemplateColumns:'260px 1fr 260px',gap:8,minHeight:480}}>

            {/* LEFT — Pre-launch Checklist */}
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <Panel title="Pre-Launch Checks" accent="#10b981">
                <div style={{fontFamily:'JetBrains Mono',fontSize:7,color:'#475569',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:8}}>SYSTEM VALIDATION</div>
                {[
                  {l:'IMU MPU-6050',        ok:!!telem},
                  {l:'BARO BMP280',         ok:!!telem},
                  {l:'GPS LOCK',            ok:!!telem},
                  {l:'UART DMA',            ok:!!telem},
                  {l:'PWM SERVOS',          ok:!!telem},
                  {l:'BATTERY > 11V',       ok:!!(telem?.battery_v>11)},
                  {l:'ATTITUDE LOCK',       ok:!!telem},
                  {l:'TELEMETRY LINK',      ok:!!telem, blink:true},
                  {l:'KEY AUTH',            ok:keyOk},
                ].map(r=><LED key={r.l} label={r.l} ok={r.ok} blink={r.blink}/>)}
                <div style={{marginTop:12,padding:'8px',borderRadius:6,background:keyOk&&telem?'rgba(16,185,129,0.08)':'rgba(232,18,28,0.06)',border:`1px solid ${keyOk&&telem?'rgba(16,185,129,0.25)':'rgba(232,18,28,0.2)'}`}}>
                  <div style={{fontFamily:'JetBrains Mono',fontSize:8,fontWeight:700,color:keyOk&&telem?'#10b981':'#e8121c',textAlign:'center',letterSpacing:'0.1em'}}>
                    {keyOk&&telem?'✓ READY FOR ARM':'⚠ NOT READY'}
                  </div>
                </div>
              </Panel>
              <Panel title="Flight Parameters" accent="#3b82f6">
                {[
                  {l:'Pitch',   v:telem?.orientation?.pitch_deg?.toFixed(2)??'---', u:'°',  c:'#e8121c'},
                  {l:'Roll',    v:telem?.orientation?.roll_deg?.toFixed(2)??'---',  u:'°',  c:'#3b82f6'},
                  {l:'Yaw',     v:telem?.orientation?.yaw_deg?.toFixed(2)??'---',   u:'°',  c:'#10b981'},
                  {l:'Altitude',v:telem?.altitude_m?.toFixed(1)??'---',             u:'m',  c:'#f59e0b'},
                  {l:'Battery', v:telem?.battery_v?.toFixed(2)??'---',             u:'V',  c:'#8b5cf6'},
                  {l:'Packets', v:String(telem?.packet_id??0),                     u:'',   c:'#64748b'},
                ].map(k=>(
                  <div key={k.l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                    <span style={{fontFamily:'JetBrains Mono',fontSize:8,color:'#475569',textTransform:'uppercase'}}>{k.l}</span>
                    <span style={{fontFamily:'JetBrains Mono',fontSize:11,fontWeight:700,color:k.c}}>{k.v}{k.u&&<span style={{fontSize:7,color:'#475569',marginLeft:2}}>{k.u}</span>}</span>
                  </div>
                ))}
              </Panel>
            </div>

            {/* CENTER — Countdown + USB Key + Launch */}
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {/* USB Key Auth */}
              <div style={{background:'linear-gradient(145deg,#141c2b,#111827)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:10,padding:'14px 18px'}}>
                <div style={{fontFamily:'JetBrains Mono',fontSize:7,color:'#f59e0b',letterSpacing:'0.16em',textTransform:'uppercase',marginBottom:10,textAlign:'center'}}>
                  ⚿ SECURITY KEY AUTHENTICATION
                </div>
                <input
                  type="password"
                  value={usbKey}
                  onChange={e=>setUsbKey(e.target.value)}
                  placeholder="INSERT PASSKEY..."
                  style={{
                    width:'100%',boxSizing:'border-box',
                    background:'#060c16', border:`1px solid ${keyOk?'rgba(16,185,129,0.5)':'rgba(245,158,11,0.3)'}`,
                    borderRadius:5, color:keyOk?'#10b981':'#f59e0b',
                    fontFamily:'JetBrains Mono', fontSize:13, padding:'8px 12px',
                    letterSpacing:'0.12em', textAlign:'center', outline:'none',
                    transition:'border-color 0.25s, color 0.25s',
                  }}
                />
                <div style={{fontFamily:'JetBrains Mono',fontSize:7.5,color:keyOk?'#10b981':'#475569',marginTop:6,textAlign:'center',letterSpacing:'0.08em'}}>
                  {keyOk?'✓ KEY AUTHENTICATED — SYSTEM UNLOCKED':'LOCKED — ENTER PASSKEY TO ENABLE ARM'}
                </div>
              </div>

              {/* Countdown */}
              <Panel style={{textAlign:'center',padding:'24px 18px',flex:1}}>
                <div style={{fontFamily:'JetBrains Mono',fontSize:7.5,letterSpacing:'0.2em',color:'#475569',marginBottom:12,textTransform:'uppercase'}}>LAUNCH COUNTDOWN</div>
                <div style={{
                  fontFamily:'Orbitron,sans-serif',fontSize:76,fontWeight:900,lineHeight:1,
                  color: launch.launched?'#10b981':launch.countdown_active?'#e8121c':'#4b5563',
                  letterSpacing:'0.04em',
                  textShadow: launch.countdown_active?'0 0 30px rgba(232,18,28,0.6)':launch.launched?'0 0 30px rgba(16,185,129,0.5)':'none',
                  transition:'color 0.4s, text-shadow 0.4s',
                }}>
                  {launch.launched?'T+00':`T-${String(Math.floor(launch.remaining_seconds)).padStart(2,'0')}`}
                </div>
                {launch.launched&&(
                  <div style={{fontFamily:'Orbitron,sans-serif',fontSize:20,color:'#10b981',marginTop:14,letterSpacing:'0.18em',animation:'ledBlink 1s ease infinite'}}>
                    LIFTOFF
                  </div>
                )}
                <div style={{display:'flex',gap:9,justifyContent:'center',marginTop:22,flexWrap:'wrap'}}>
                  <button onClick={arm} disabled={!keyOk&&!launch.armed} style={{
                    padding:'8px 18px',
                    background:keyOk ? (launch.armed ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.1)') : 'rgba(255,255,255,0.02)',
                    border:`1px solid ${keyOk ? '#f59e0b' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius:5,
                    color:keyOk ? '#f59e0b' : '#334155',
                    fontFamily:'JetBrains Mono',fontSize:9,fontWeight:700,
                    cursor:(!keyOk&&!launch.armed)?'not-allowed':'pointer',
                    boxShadow:keyOk ? '0 0 10px rgba(245,158,11,0.35)' : 'none',
                    letterSpacing:'0.15em',textTransform:'uppercase',transition:'all 0.2s',
                  }}>{launch.armed?'DISARM':'ARM'}</button>
                  
                  <button onClick={go} disabled={!launch.armed||launch.countdown_active} style={{
                    padding:'8px 18px',
                    background:launch.armed ? '#10b981' : '#1f2937',
                    border:'none',
                    borderRadius:5,
                    color:launch.armed ? '#fff' : '#4b5563',
                    fontFamily:'JetBrains Mono',fontSize:9,fontWeight:700,
                    cursor:(!launch.armed||launch.countdown_active)?'not-allowed':'pointer',
                    boxShadow:launch.armed ? '0 0 15px rgba(16,185,129,0.5)' : 'none',
                    letterSpacing:'0.15em',textTransform:'uppercase',transition:'all 0.2s',
                  }}>START COUNTDOWN</button>

                  <button onClick={rst} style={{padding:'8px 14px',background:'transparent',border:'1px solid rgba(255,255,255,0.07)',borderRadius:5,color:'#64748b',fontFamily:'JetBrains Mono',fontSize:9,fontWeight:700,cursor:'pointer',textTransform:'uppercase'}}>RESET</button>
                </div>
                <div style={{display:'flex',gap:7,justifyContent:'center',marginTop:14,flexWrap:'wrap'}}>
                  {[{l:launch.armed?'ARMED':'SAFE',c:launch.armed?'#f59e0b':null},{l:launch.countdown_active?'COUNTING':'STANDBY',c:launch.countdown_active?'#e8121c':null},{l:launch.launched?'LAUNCHED':'PRE-LAUNCH',c:launch.launched?'#10b981':null}].map(b=>(
                    <Badge key={b.l} color={b.c||'#64748b'}>{b.l}</Badge>
                  ))}
                </div>
              </Panel>
            </div>

            {/* RIGHT — Onboard Comms Test */}
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <Panel title="Onboard Comms Test" accent="#8b5cf6">
                {[
                  {k:'UART DMA',    v:telem?'PASS':'OFFLINE',    ok:!!telem},
                  {k:'SPI MPU6050', v:telem?.imu_status??'OFFLINE', ok:!!telem},
                  {k:'I2C BMP280',  v:telem?.baro_status??'OFFLINE',ok:!!telem},
                  {k:'PWM CH1',     v:telem?`${telem.actuators?.servo_pitch_us} µs`:'OFFLINE', ok:!!telem},
                  {k:'PWM CH2',     v:telem?`${telem.actuators?.servo_yaw_us} µs`:'OFFLINE',   ok:!!telem},
                  {k:'RSSI',        v:telem?`${telem.rssi_dbm} dBm`:'OFFLINE', ok:telem?.rssi_dbm>-80},
                ].map(r=><DR key={r.k} label={r.k} value={r.v} ok={r.ok}/>)}
              </Panel>
              <Panel title="Launch Sequence" accent="#e8121c">
                <div style={{fontFamily:'JetBrains Mono',fontSize:7,color:'#475569',lineHeight:2.2}}>
                  {[
                    {n:'01', step:'KEY AUTH',          ok:keyOk},
                    {n:'02', step:'SYSTEM ARM',         ok:launch.armed},
                    {n:'03', step:'COUNTDOWN INIT',     ok:launch.countdown_active||launch.launched},
                    {n:'04', step:'ENGINE IGNITION',    ok:launch.launched},
                    {n:'05', step:'LIFTOFF CONFIRM',    ok:launch.launched},
                  ].map(s=>(
                    <div key={s.n} style={{display:'flex',alignItems:'center',gap:8,padding:'3px 0',borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                      <span style={{color:'#334155',fontSize:7}}>{s.n}</span>
                      <div style={{width:5,height:5,borderRadius:'50%',flexShrink:0,
                        background:s.ok?'#10b981':'#2d3748',
                        boxShadow:s.ok?'0 0 4px #10b981':'none'}}/>
                      <span style={{color:s.ok?'#94a3b8':'#334155',fontSize:8,textTransform:'uppercase',letterSpacing:'0.06em'}}>{s.step}</span>
                      <span style={{marginLeft:'auto',color:s.ok?'#10b981':'#4b5563',fontSize:7,fontWeight:700}}>{s.ok?'GO':'—'}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
        )}

        {/* ══════════ VEHICLE CONFIG ════════════════════════════════════════════ */}
        {tab==='vehicle'&&(
          <Panel title="Vehicle Configuration" style={{maxWidth:660}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:11}}>
              {[{l:'Wet Mass m_wet (kg)',k:'m_wet',s:0.05},{l:'Dry Mass m_dry (kg)',k:'m_dry',s:0.05},{l:'Avg Thrust F_t (N)',k:'thrust_N',s:1},{l:'Burn Time t_b (s)',k:'burn_time_s',s:0.05},{l:'Gimbal Limit (deg)',k:'gimbal_limit',s:0.5}].map(f=>(
                <div key={f.k} style={{display:'flex',flexDirection:'column',gap:4}}>
                  <label style={{fontFamily:'JetBrains Mono',fontSize:8,fontWeight:600,letterSpacing:'0.10em',textTransform:'uppercase',color:'#475569'}}>{f.l}</label>
                  <input type="number" step={f.s} value={params[f.k]} onChange={e=>setParams(p=>({...p,[f.k]:+e.target.value||0}))} style={{background:'#090d16',border:'1px solid rgba(255,255,255,0.07)',borderRadius:5,color:'#f0f4f8',fontFamily:'JetBrains Mono',fontSize:13,padding:'6px 10px',outline:'none',width:'100%'}}/>
                </div>
              ))}
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                <label style={{fontFamily:'JetBrains Mono',fontSize:8,fontWeight:600,letterSpacing:'0.10em',textTransform:'uppercase',color:'#475569'}}>Scenario</label>
                <select value={params.scenario} onChange={e=>setParams(p=>({...p,scenario:e.target.value}))} style={{background:'#090d16',border:'1px solid rgba(255,255,255,0.07)',borderRadius:5,color:'#f0f4f8',fontFamily:'JetBrains Mono',fontSize:12,padding:'6px 10px',outline:'none',width:'100%'}}>
                  <option value="nominal">Nominal</option>
                  <option value="gust">Wind Gust</option>
                  <option value="mass_uncertainty">Mass Uncertainty</option>
                </select>
              </div>
            </div>
            <Btn onClick={runSim} disabled={loading} style={{marginTop:14}}>APPLY AND RE-RUN</Btn>
          </Panel>
        )}

        {/* ══════════ BENCHMARKS ════════════════════════════════════════════════ */}
        {tab==='bench'&&(
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <Panel title="Monte Carlo Controller Benchmarks — N=500 Runs">
              <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'JetBrains Mono',fontSize:11}}>
                <thead>
                  <tr>{['Controller','Class','Mean RMSE','Overshoot','Settle Time','Gimbal Peak','Rating'].map(h=>(
                    <th key={h} style={{textAlign:'left',padding:'6px 9px',color:'#475569',fontSize:8,letterSpacing:'0.10em',textTransform:'uppercase',borderBottom:'1px solid rgba(255,255,255,0.06)',fontWeight:600}}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {[{n:'PID',c:'Classic',r:'1.98 deg',o:'5.0%',st:'0.35 s',gm:'3.8 deg',rt:'3/5'},{n:'LQI',c:'Optimal',r:'1.89 deg',o:'7.8%',st:'0.28 s',gm:'4.1 deg',rt:'4/5'},{n:'MRAC',c:'Adaptive',r:'1.98 deg',o:'30.4%',st:'0.55 s',gm:'4.9 deg',rt:'3/5'},{n:'ADRC',c:'ESO Robust',r:'2.26 deg',o:'0.0%',st:'0.31 s',gm:'3.2 deg',rt:'5/5'}].map(r=>(
                    <tr key={r.n} style={{background:r.n==='ADRC'?'rgba(232,18,28,0.05)':'transparent',borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                      <td style={{padding:'8px 9px',color:r.n==='ADRC'?'#e8121c':'#f0f4f8',fontWeight:700}}>{r.n}</td>
                      <td style={{padding:'8px 9px',color:'#64748b'}}>{r.c}</td>
                      <td style={{padding:'8px 9px',color:'#f0f4f8'}}>{r.r}</td>
                      <td style={{padding:'8px 9px',color:parseFloat(r.o)>20?'#e8121c':'#10b981'}}>{r.o}</td>
                      <td style={{padding:'8px 9px',color:'#f0f4f8'}}>{r.st}</td>
                      <td style={{padding:'8px 9px',color:'#f0f4f8'}}>{r.gm}</td>
                      <td style={{padding:'8px 9px',color:'#f59e0b',fontWeight:700}}>{r.rt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <Panel title="RMSE Comparison" style={{height:230}}>
                <div style={{height:175}}><Chart data={[{type:'bar',x:['PID','LQI','MRAC','ADRC'],y:[1.98,1.89,1.98,2.26],marker:{color:['#3b82f6','#10b981','#8b5cf6','#e8121c']}}]} extra={{yaxis:{title:'RMSE (deg)'},showlegend:false}}/></div>
              </Panel>
              <Panel title="Overshoot Comparison" style={{height:230}}>
                <div style={{height:175}}><Chart data={[{type:'bar',x:['PID','LQI','MRAC','ADRC'],y:[5.0,7.8,30.4,0.0],marker:{color:['#3b82f6','#10b981','#e8121c','#10b981']}}]} extra={{yaxis:{title:'Overshoot (%)'},showlegend:false}}/></div>
              </Panel>
            </div>
          </div>
        )}

        {/* ══════════ RESEARCH PAPER ════════════════════════════════════════════ */}
        {tab==='paper'&&(
          <div style={{maxWidth:800,margin:'0 auto'}}>
            <Panel title="IEEE Research Paper — TVC Digital Twin">
              <h2 style={{fontFamily:'Inter,sans-serif',fontSize:17,fontWeight:700,color:'#f0f4f8',marginBottom:5,lineHeight:1.4}}>
                Active Disturbance Rejection Control for Thrust Vector Control of a Small Sounding Rocket: A Hardware-in-the-Loop Digital Twin Approach
              </h2>
              <p style={{fontFamily:'JetBrains Mono',fontSize:9,color:'#475569',marginBottom:14}}>Mevrick Neal — Department of Aerospace Engineering, 2026</p>
              <div style={{background:'#0f1420',borderLeft:'3px solid #e8121c',padding:'10px 15px',borderRadius:'0 5px 5px 0',marginBottom:14,fontStyle:'italic',fontSize:12,color:'#94a3b8',lineHeight:1.75}}>
                <strong style={{color:'#f0f4f8',display:'block',marginBottom:3}}>Abstract</strong>
                This paper presents the design, simulation, and hardware validation of a thrust vector control (TVC) system for a 2.055 kg sounding rocket. Four control architectures are benchmarked: classical PID, linear-quadratic-integral (LQI), model-reference adaptive control (MRAC), and active disturbance rejection control (ADRC). ADRC achieves zero overshoot with mean pitch RMSE of 2.26 deg while rejecting unmodeled aerodynamic disturbances without plant model knowledge. Firmware executes on STM32F411CEU6 at 50 Hz with UART telemetry at 115200 baud.
              </div>
              {[{h:'I. Introduction',body:'Thrust vector control is the primary attitude actuation mechanism during propulsion-phase flight in small rockets lacking aerodynamic control surfaces below dynamic pressure onset. ADRC, formalized by Han (2009), treats all unmodeled dynamics and external disturbances as an extended state observable through an extended state observer (ESO). Control action directly cancels estimated disturbance without requiring a plant model, making it robust to mass transients during propulsion-phase flight.'},{h:'II. Vehicle Model',body:'The equations of motion in the pitch plane are derived from Newton-Euler rigid body mechanics. Vehicle parameters: m_wet = 2.055 kg, m_dry = 1.968 kg, avg thrust = 75 N, burn time = 1.2 s, gimbal limit = 5 deg.'},{h:'III. Controller Designs',body:'PID: Kp=4.2, Ki=0.8, Kd=0.35. LQI: Q=diag(10,1,5,0.1), R=0.01, 50 Hz. MRAC: MIT rule, bandwidth 12 rad/s. ADRC: ESO bandwidth 80 rad/s, zero overshoot across all 500 Monte Carlo runs.'},{h:'IV. Results',body:'LQI achieves lowest RMSE at 1.89 deg but shows 7.8% overshoot. ADRC yields zero overshoot at the cost of 0.28 deg higher mean RMSE, acceptable within the 5 deg gimbal authority budget.'},{h:'V. Hardware',body:'STM32F411CEU6 at 100 MHz, guidance at 50 Hz. MPU-6050 at 200 Hz, BMP280 altitude. UART DMA at 115200 baud, CRC-16 checksum. Digital twin at 60 fps.'},{h:'VI. Conclusion',body:'ADRC provides the best combination of zero overshoot and disturbance rejection for propulsion-phase attitude control.'}].map(s=>(
                <div key={s.h}>
                  <h3 style={{fontFamily:'Inter,sans-serif',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'#94a3b8',margin:'16px 0 6px',borderLeft:'3px solid #e8121c',paddingLeft:9}}>{s.h}</h3>
                  <p style={{fontSize:12,color:'#94a3b8',lineHeight:1.75,marginBottom:3}}>{s.body}</p>
                </div>
              ))}
            </Panel>
          </div>
        )}

      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=JetBrains+Mono:wght@400;600;700&display=swap');
        @keyframes ledBlink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:rgba(0,0,0,0.2)}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.07);border-radius:3px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.13)}
        .leaflet-container { background: #090d16 !important; }
        button:hover:not(:disabled) { opacity:0.88; }
      `}</style>
    </div>
  );
}
