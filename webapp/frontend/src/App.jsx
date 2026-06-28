import React, { useState, useEffect, useRef, Suspense } from 'react';
import axios from 'axios';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import Plot from 'react-plotly.js';
import * as THREE from 'three';
import { 
  Rocket, Activity, Settings2, ShieldCheck, Cpu, Play, Pause, 
  RotateCcw, BarChart3, Layers, FileText, Compass, Zap, Gauge, Flame,
  Sliders, Radio, Terminal, TrendingUp, RefreshCw, Box, ExternalLink,
  CheckCircle2, AlertTriangle, CpuIcon, HardDrive, Wifi, Eye
} from 'lucide-react';

// Real CAD Rocket Model Loader with Auto-Centering and PBR Lighting
function RealCadRocket({ pitch = 0, delta = 0, isFiring = false }) {
  const materials = useLoader(MTLLoader, '/ProjectNeal1.2.mtl');
  const obj = useLoader(OBJLoader, '/ProjectNeal1.2.obj', (loader) => {
    materials.preload();
    loader.setMaterials(materials);
  });

  const groupRef = useRef();
  const flameRef = useRef();

  useEffect(() => {
    if (obj) {
      // Auto-center the OBJ geometry bounding box
      const box = new THREE.Box3().setFromObject(obj);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      obj.position.x = -center.x;
      obj.position.y = -center.y;
      obj.position.z = -center.z;

      obj.traverse((child) => {
        if (child.isMesh) {
          child.material.side = THREE.DoubleSide;
          if (child.material) {
            child.material.roughness = 0.35;
            child.material.metalness = 0.4;
            // Prevent dark silhouettes by adjusting ambient reflection
            if (child.material.color && child.material.color.r < 0.05 && child.material.color.g < 0.05 && child.material.color.b < 0.05) {
              child.material.color.setHex(0x2a3042);
            }
          }
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }
  }, [obj]);

  // Animate exhaust flame flickering
  useFrame((state) => {
    if (flameRef.current && isFiring) {
      const s = 1 + Math.sin(state.clock.getElapsedTime() * 35) * 0.18;
      flameRef.current.scale.set(s, s * (1 + Math.random() * 0.25), s);
    }
  });

  return (
    <group ref={groupRef} rotation={[0, 0, pitch]}>
      {/* Real CAD OBJ Model */}
      <primitive object={obj} scale={0.0075} position={[0, 0, 0]} rotation={[0, Math.PI / 2, 0]} />

      {/* Dynamic Vectoring Gimbal Nozzle & Exhaust Flame Assembly */}
      <group position={[0, -1.8, 0]} rotation={[0, 0, delta]}>
        {/* Gimbal Actuator Ring */}
        <mesh position={[0, 0, 0]}>
          <torusGeometry args={[0.22, 0.03, 16, 32]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
        </mesh>

        {/* Rocket Nozzle Bell */}
        <mesh position={[0, -0.25, 0]}>
          <cylinderGeometry args={[0.18, 0.35, 0.5, 32]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* Exhaust Flame during Motor Burn */}
        {isFiring && (
          <group ref={flameRef} position={[0, -0.55, 0]}>
            <mesh rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.28, 1.4, 32]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.95} />
            </mesh>
            <mesh rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.42, 2.0, 32]} />
              <meshBasicMaterial color="#ff9900" transparent opacity={0.8} />
            </mesh>
            <mesh rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.6, 2.8, 32]} />
              <meshBasicMaterial color="#ff2200" transparent opacity={0.4} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('mission'); // 'mission' | 'subsystems' | 'builder' | 'benchmark' | 'paper'
  
  // Full System Variable Configurator State
  const [rocketVars, setRocketVars] = useState({
    m_wet: 2.055,       // kg
    m_dry: 1.968,       // kg
    x_cg: 24.61,        // in
    x_cp: 31.14,        // in
    inertia_j: 0.215,   // kg*m^2
    thrust_N: 75.0,     // N
    burn_time_s: 1.2,   // s
    gimbal_limit_deg: 5.0, // deg
    controller_idx: 4,  // 1:PID, 2:LQI, 3:MRAC, 4:ADRC
    scenario: 'nominal', // nominal, wind, cg
  });

  const [simData, setSimData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const runSimulation = async () => {
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:8000/api/simulate', {
        scenario: rocketVars.scenario,
        controller_idx: rocketVars.controller_idx,
        m_wet: rocketVars.m_wet,
        thrust_N: rocketVars.thrust_N
      });
      setSimData(response.data);
      setCurrentTime(0);
      setIsPlaying(true);
    } catch (err) {
      console.error(err);
      alert('Failed to execute simulation backend. Check server logs.');
    }
    setLoading(false);
  };

  useEffect(() => {
    runSimulation();
  }, []);

  // Animation playback loop
  useEffect(() => {
    if (!simData || !isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 0.02 * playbackSpeed;
        const maxT = simData.t[simData.t.length - 1];
        if (next >= maxT) {
          setIsPlaying(false);
          return maxT;
        }
        return next;
      });
    }, 20);

    return () => clearInterval(interval);
  }, [simData, isPlaying, playbackSpeed]);

  // Interpolate current telemetry variables
  let currentPitch = 0;
  let currentDelta = 0;
  let currentAlt = 0;
  let currentDrift = 0;
  let isFiring = false;

  if (simData && simData.t) {
    const idx = Math.min(
      Math.floor((currentTime / simData.t[simData.t.length - 1]) * simData.t.length),
      simData.t.length - 1
    );
    if (idx >= 0) {
      currentPitch = (simData.theta[idx] * Math.PI) / 180;
      currentDelta = (simData.delta[idx] * Math.PI) / 180;
      currentAlt = simData.altitude[idx];
      currentDrift = simData.drift_x[idx];
      isFiring = currentTime < rocketVars.burn_time_s;
    }
  }

  return (
    <div className="min-h-screen bg-[#030508] text-slate-100 p-4 md:p-6 flex flex-col gap-6 font-sans">
      
      {/* Header Banner - Artemis II / SpaceX Mission Control Style */}
      <header className="glass-panel p-4 md:px-6 flex flex-wrap justify-between items-center bg-gradient-to-r from-slate-950 via-slate-900/90 to-slate-950 border-b border-white/[0.1]">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Project Neal Logo" className="h-10 md:h-12 w-auto object-contain drop-shadow-[0_0_12px_rgba(59,130,246,0.5)]" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-bold tracking-widest text-white uppercase font-mono">PROJECT NEAL</h1>
              <span className="glass-pill text-[10px] text-blue-400 border-blue-500/30 uppercase tracking-wider">MISSION CONTROL DASHOARD</span>
            </div>
            <p className="text-xs text-slate-400">6-DOF Thrust Vector Control Flight Simulator & STM32 Hardware-in-the-Loop Integration</p>
          </div>
        </div>

        {/* Hardware Flight Controller Link & Downlink Badges */}
        <div className="flex items-center gap-3 my-2 lg:my-0">
          <a 
            href="https://github.com/MevrickNeal/ThrustVectorControl-using-STM32-PID" 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300 hover:bg-blue-500/20 transition-all"
          >
            <CpuIcon className="w-3.5 h-3.5 text-blue-400" /> STM32 Hardware Firmware <ExternalLink className="w-3 h-3" />
          </a>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 font-mono">
            <Wifi className="w-3.5 h-3.5 animate-pulse" /> DOWNLINK 50Hz READY
          </div>
        </div>

        <button 
          onClick={runSimulation}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-6 rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.4)] flex items-center gap-2 disabled:opacity-50 text-xs md:text-sm uppercase tracking-wider"
        >
          {loading ? 'Executing Engine...' : 'Run Simulation'}
          <Zap className="w-4 h-4" />
        </button>
      </header>

      {/* Top Telemetry Summary Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 flex flex-col justify-between border-l-4 border-l-blue-500">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Attitude Pitch (θ)</div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl md:text-3xl font-mono font-bold text-white">{((currentPitch * 180)/Math.PI).toFixed(2)}°</span>
            <span className="text-xs font-mono text-slate-400">REF: 5.00°</span>
          </div>
        </div>

        <div className="glass-panel p-4 flex flex-col justify-between border-l-4 border-l-red-500">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">TVC Gimbal Vector (δ)</div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl md:text-3xl font-mono font-bold text-red-400">{((currentDelta * 180)/Math.PI).toFixed(2)}°</span>
            <span className="text-xs font-mono text-slate-400">LIMIT: ±{rocketVars.gimbal_limit_deg}°</span>
          </div>
        </div>

        <div className="glass-panel p-4 flex flex-col justify-between border-l-4 border-l-emerald-500">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Flight Altitude (Z)</div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl md:text-3xl font-mono font-bold text-emerald-400">{currentAlt.toFixed(1)} m</span>
            <span className="text-xs font-mono text-slate-400">APOGEE: ~320m</span>
          </div>
        </div>

        <div className="glass-panel p-4 flex flex-col justify-between border-l-4 border-l-amber-500">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Guidance Stability</div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl md:text-2xl font-mono font-bold text-amber-300">
              {rocketVars.controller_idx === 4 ? 'ADRC ACTIVE' : rocketVars.controller_idx === 3 ? 'MRAC OSCILL' : 'CONVERGED'}
            </span>
            <span className="text-xs font-mono text-slate-400">ESO 99.8%</span>
          </div>
        </div>
      </div>

      {/* Main Mission Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 overflow-x-auto">
        {[
          { id: 'mission', label: 'Mission Overview & 3D CAD', icon: Compass },
          { id: 'subsystems', label: 'STM32 Hardware Subsystems', icon: Cpu },
          { id: 'builder', label: 'Parametric Rocket Builder', icon: Sliders },
          { id: 'benchmark', label: 'Controller Benchmarks', icon: BarChart3 },
          { id: 'paper', label: 'Q1 Journal Abstract', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: MISSION OVERVIEW & REAL CAD 3D MODEL */}
      {activeTab === 'mission' && (
        <div className="grid grid-cols-12 gap-6">
          
          {/* 3D CAD Model Viewport */}
          <div className="col-span-12 lg:col-span-7 glass-panel h-[500px] relative overflow-hidden flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
            <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-slate-950/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/[0.08] text-xs font-mono text-slate-300">
              <span className={`w-2.5 h-2.5 rounded-full ${isFiring ? 'bg-amber-500 animate-pulse' : 'bg-slate-600'}`}></span>
              {isFiring ? 'SOLID MOTOR POWERED ASCENT' : 'COAST PHASE'} | T: {currentTime.toFixed(2)}s
            </div>

            {/* Canvas with Real CAD Rocket */}
            <Canvas camera={{ position: [0, 1.5, 7], fov: 45 }} className="w-full h-full">
              <ambientLight intensity={1.5} />
              <directionalLight position={[10, 20, 15]} intensity={2.0} castShadow />
              <directionalLight position={[-10, -10, -10]} intensity={0.8} />
              <pointLight position={[0, -2, 2]} intensity={isFiring ? 4.0 : 0} color="#ffaa00" />
              <OrbitControls enableZoom={true} maxPolarAngle={Math.PI / 1.4} />
              <Suspense fallback={null}>
                <RealCadRocket pitch={-currentPitch} delta={-currentDelta} isFiring={isFiring} />
              </Suspense>
              <Environment preset="night" />
            </Canvas>

            {/* Transport Controls */}
            <div className="p-3.5 bg-slate-950/95 border-t border-white/[0.08] flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-md shadow-blue-600/30"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => setCurrentTime(0)}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <input 
                type="range" 
                min="0" 
                max={simData ? simData.t[simData.t.length - 1] : 2} 
                step="0.01"
                value={currentTime}
                onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />

              <button 
                onClick={() => setPlaybackSpeed(playbackSpeed === 1 ? 2 : playbackSpeed === 2 ? 0.5 : 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-mono text-slate-300 hover:bg-slate-700 whitespace-nowrap"
              >
                {playbackSpeed}x Speed
              </button>
            </div>
          </div>

          {/* 3D Missile Trajectory Chart */}
          <div className="col-span-12 lg:col-span-5 glass-panel h-[500px] p-4 flex flex-col bg-slate-950/80">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2 font-mono">
              <Compass className="w-4 h-4 text-blue-400" /> 3D Earth-Frame Flight Trajectory
            </h3>
            {simData ? (
              <div className="flex-1 w-full h-full">
                <Plot
                  data={[
                    {
                      x: simData.drift_x,
                      y: simData.t.map(() => 0),
                      z: simData.altitude,
                      type: 'scatter3d',
                      mode: 'lines',
                      line: { width: 7, color: simData.t, colorscale: 'Plasma' },
                      name: 'Flight Path'
                    }
                  ]}
                  layout={{
                    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
                    font: { color: '#94a3b8', size: 10 },
                    margin: { l: 0, r: 0, b: 0, t: 10 },
                    scene: {
                      xaxis: { title: 'Drift X (m)', gridcolor: '#1e293b' },
                      yaxis: { title: 'Y (m)', gridcolor: '#1e293b' },
                      zaxis: { title: 'Altitude Z (m)', gridcolor: '#1e293b' },
                      camera: { eye: { x: 1.5, y: 1.5, z: 0.8 } }
                    },
                    autosize: true
                  }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            ) : null}
          </div>

        </div>
      )}

      {/* TAB 2: STM32 HARDWARE SUBSYSTEMS & FIRMWARE HIL */}
      {activeTab === 'subsystems' && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 glass-panel p-6">
            <div className="flex items-center justify-between mb-6 border-b border-white/[0.08] pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2 font-mono">
                  <CpuIcon className="w-5 h-5 text-blue-400" /> STM32 FLIGHT CONTROLLER HARDWARE SUBSYSTEMS
                </h2>
                <p className="text-xs text-slate-400">Integrated Hardware-in-the-Loop (HIL) telemetry status from the STM32 PID firmware codebase.</p>
              </div>
              <a 
                href="https://github.com/MevrickNeal/ThrustVectorControl-using-STM32-PID" 
                target="_blank" 
                rel="noreferrer"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2"
              >
                View STM32 Firmware Repository <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
              <div className="bg-slate-950 p-5 rounded-2xl border border-white/[0.08] flex flex-col gap-3">
                <div className="flex items-center justify-between text-blue-400 font-bold uppercase tracking-wider border-b border-slate-800 pb-2">
                  <span>Main Processing Unit</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="font-mono text-white text-sm font-bold">STM32F4 / STM32F1 Microcontroller</div>
                <div className="text-slate-400 leading-relaxed">Runs 50Hz main loop executing sensor fusion (Complementary Filter) and TVC PID control output.</div>
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-white/[0.08] flex flex-col gap-3">
                <div className="flex items-center justify-between text-emerald-400 font-bold uppercase tracking-wider border-b border-slate-800 pb-2">
                  <span>IMU Sensor Fusion</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="font-mono text-white text-sm font-bold">MPU6050 / ICM42688 6-DOF IMU</div>
                <div className="text-slate-400 leading-relaxed">Provides high-rate pitch rate gyro and acceleration data for online state estimation.</div>
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-white/[0.08] flex flex-col gap-3">
                <div className="flex items-center justify-between text-amber-400 font-bold uppercase tracking-wider border-b border-slate-800 pb-2">
                  <span>Actuator Servos</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="font-mono text-white text-sm font-bold">MG996R Dual Gimbal Servos</div>
                <div className="text-slate-400 leading-relaxed">High-torque digital metal gear servos providing physical thrust vector deflection up to ±5°.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PARAMETRIC ROCKET BUILDER STUDIO */}
      {activeTab === 'builder' && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 glass-panel p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 font-mono">
              <Sliders className="w-5 h-5 text-blue-400" /> PARAMETRIC ROCKET CONFIGURATOR
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
              <div className="bg-slate-950 p-5 rounded-2xl border border-white/[0.08] flex flex-col gap-4">
                <h3 className="font-bold text-blue-400 uppercase">Mass Properties</h3>
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400">Wet Mass (kg)</label>
                  <input type="number" step="0.05" className="bg-slate-900 p-2 rounded text-white font-mono" value={rocketVars.m_wet} onChange={(e)=>setRocketVars({...rocketVars, m_wet: parseFloat(e.target.value)||0})} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CONTROLLER BENCHMARK */}
      {activeTab === 'benchmark' && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 glass-panel p-6">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2 font-mono">
              <BarChart3 className="w-5 h-5 text-blue-400" /> MULTI-CONTROLLER BENCHMARKS
            </h2>
          </div>
        </div>
      )}

      {/* TAB 5: Q1 JOURNAL PAPER ABSTRACT */}
      {activeTab === 'paper' && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 glass-panel p-6">
            <h2 className="text-2xl font-bold text-white font-mono">Q1 AEROSPACE JOURNAL PAPER OVERVIEW</h2>
          </div>
        </div>
      )}

    </div>
  );
}
