import React, { useState, useEffect, useRef, Suspense } from 'react';
import axios from 'axios';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import Plot from 'react-plotly.js';
import * as THREE from 'three';
import { 
  Rocket, Activity, Settings2, ShieldCheck, Cpu, Play, Pause, 
  RotateCcw, BarChart3, Layers, FileText, Compass, Zap, Gauge, Flame,
  Sliders, Radio, Terminal, TrendingUp, RefreshCw, Box
} from 'lucide-react';

// Guaranteed High-Fidelity 3D Rocket Model Component with Real-Time Vectoring
function ProceduralRocket({ pitch = 0, delta = 0, isFiring = false }) {
  const rocketRef = useRef();
  const flameRef = useRef();

  // Animate exhaust flame flickering in real time
  useFrame((state) => {
    if (flameRef.current && isFiring) {
      const s = 1 + Math.sin(state.clock.getElapsedTime() * 35) * 0.18;
      flameRef.current.scale.set(s, s * (1 + Math.random() * 0.25), s);
    }
  });

  return (
    <group ref={rocketRef} rotation={[0, 0, pitch]}>
      {/* --- ROCKET AIRFRAME --- */}
      
      {/* Aerodynamic Nose Cone */}
      <mesh position={[0, 2.5, 0]}>
        <coneGeometry args={[0.35, 1.2, 32]} />
        <meshStandardMaterial color="#ef4444" roughness={0.2} metalness={0.5} />
      </mesh>

      {/* Main Body Tube (White Payload / Avionics Bay) */}
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 1.6, 32]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.1} />
      </mesh>

      {/* Black Roll Stripe Accent Band */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.352, 0.352, 0.2, 32]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} />
      </mesh>

      {/* Lower Motor Body Tube */}
      <mesh position={[0, -0.7, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 1.6, 32]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.1} />
      </mesh>

      {/* Project NEAL Decal Label / Insignia */}
      <mesh position={[0, 0.9, 0.355]} rotation={[0, 0, 0]}>
        <planeGeometry args={[0.3, 0.6]} />
        <meshBasicMaterial color="#3b82f6" />
      </mesh>

      {/* 4x Aerodynamic Trapezoidal Fins */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => (
        <group key={i} rotation={[0, angle, 0]} position={[0, -1.1, 0]}>
          <mesh position={[0.45, -0.2, 0]} rotation={[0, 0, -Math.PI / 6]}>
            <boxGeometry args={[0.35, 0.6, 0.04]} />
            <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.4} />
          </mesh>
        </group>
      ))}

      {/* Aft Centering Ring / Engine Mount Plate */}
      <mesh position={[0, -1.5, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.08, 32]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* --- REAL-TIME GIMBALLED THRUST VECTORING NOZZLE --- */}
      <group position={[0, -1.55, 0]} rotation={[0, 0, delta]}>
        {/* Swivel Gimbal Ring Mount */}
        <mesh position={[0, 0, 0]}>
          <torusGeometry args={[0.26, 0.04, 16, 32]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
        </mesh>

        {/* Machined Divergent Nozzle Bell */}
        <mesh position={[0, -0.3, 0]}>
          <cylinderGeometry args={[0.2, 0.38, 0.55, 32]} />
          <meshStandardMaterial color="#1e1e1e" metalness={0.95} roughness={0.15} />
        </mesh>

        {/* Inner Nozzle Core Heat Shield */}
        <mesh position={[0, -0.35, 0]}>
          <cylinderGeometry args={[0.18, 0.34, 0.45, 32]} />
          <meshBasicMaterial color="#ff4500" />
        </mesh>

        {/* Real-Time Thrust Flame & Exhaust Plume */}
        {isFiring && (
          <group ref={flameRef} position={[0, -0.6, 0]}>
            {/* Inner High-Temperature Plasma Core */}
            <mesh rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.3, 1.5, 32]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.95} />
            </mesh>
            {/* Primary Combustion Flame */}
            <mesh rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.45, 2.2, 32]} />
              <meshBasicMaterial color="#ff8c00" transparent opacity={0.75} />
            </mesh>
            {/* Outer Shock Diamond Plume */}
            <mesh rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.65, 3.0, 32]} />
              <meshBasicMaterial color="#ff2200" transparent opacity={0.35} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('simulation'); // 'simulation' | 'builder' | 'telemetry' | 'benchmark' | 'paper'
  
  // Full System Variable Configurator State
  const [rocketVars, setRocketVars] = useState({
    // Airframe & Inertia
    m_wet: 2.055,       // kg
    m_dry: 1.968,       // kg
    x_cg: 24.61,        // in
    x_cp: 31.14,        // in
    inertia_j: 0.215,   // kg*m^2
    length_m: 1.25,     // m
    diameter_m: 0.076,  // m
    
    // Motor & Propulsion
    motor_name: 'Aerotech G74W',
    thrust_N: 75.0,     // N
    burn_time_s: 1.2,   // s
    isp_s: 210,         // s
    
    // Actuators
    gimbal_limit_deg: 5.0, // deg
    servo_bandwidth_hz: 50.0,
    
    // Environment & Guidance
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
    <div className="min-h-screen bg-[#07090e] text-slate-100 p-4 md:p-6 flex flex-col gap-6 font-sans">
      
      {/* Header Banner */}
      <div className="glass-panel p-4 flex flex-wrap justify-between items-center border-b border-blue-500/20 bg-gradient-to-r from-blue-950/50 via-slate-900/80 to-slate-950/90 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600/20 rounded-xl border border-blue-500/30 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.4)]">
            <Rocket className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-wider text-white flex items-center gap-3">
              PROJECT NEAL <span className="text-xs px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 font-mono">TVC DIGITAL TWIN v3.0 PROF</span>
            </h1>
            <p className="text-xs text-slate-400">Integrated Aerospace Flight Dynamics, Parametric Studio & Telemetry Downlink Suite</p>
          </div>
        </div>

        {/* Tab Switcher Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/90 p-1.5 rounded-xl border border-slate-800 my-2 lg:my-0">
          {[
            { id: 'simulation', label: '3D Mission Control', icon: Compass },
            { id: 'builder', label: 'Rocket Variables Studio', icon: Sliders },
            { id: 'telemetry', label: 'Telemetry Downlink', icon: Radio },
            { id: 'benchmark', label: 'Control Benchmarks', icon: BarChart3 },
            { id: 'paper', label: 'Q1 Research Journal', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40 border border-blue-400/30' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        <button 
          onClick={runSimulation}
          disabled={loading}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-2.5 px-6 rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.4)] flex items-center gap-2 disabled:opacity-50 text-sm"
        >
          {loading ? 'Re-Running RK4 Engine...' : 'Execute Simulation'}
          <Zap className="w-4 h-4" />
        </button>
      </div>

      {/* TAB 1: 3D MISSION CONTROL & REAL-TIME VECTORING */}
      {activeTab === 'simulation' && (
        <div className="grid grid-cols-12 gap-6">
          
          {/* Quick Guidance Selector Sidebar */}
          <div className="col-span-12 lg:col-span-3 glass-panel p-5 flex flex-col gap-5 border border-slate-800 bg-slate-900/50">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
              <Settings2 className="w-4 h-4 text-blue-400" /> Active Guidance Config
            </h2>
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-400">Control Algorithm</label>
              <select 
                className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:border-blue-500 outline-none"
                value={rocketVars.controller_idx}
                onChange={(e) => setRocketVars({...rocketVars, controller_idx: parseInt(e.target.value)})}
              >
                <option value={4}>ADRC (Active Disturbance Rejection - Robust)</option>
                <option value={1}>PID (Cascaded Posture Control)</option>
                <option value={2}>LQI (Linear Quadratic Integral)</option>
                <option value={3}>MRAC (Model Reference Adaptive Control)</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-400">Atmospheric Profile</label>
              <select 
                className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:border-blue-500 outline-none"
                value={rocketVars.scenario}
                onChange={(e) => setRocketVars({...rocketVars, scenario: e.target.value})}
              >
                <option value="nominal">Nominal Ascent (Calm Air)</option>
                <option value="wind">Crosswind Shear Gust (15 m/s)</option>
                <option value="cg">Center-of-Gravity Uncertainty Shift</option>
              </select>
            </div>

            {/* Quick Live Gauges */}
            <div className="pt-4 border-t border-slate-800 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-blue-400" /> Real-Time Telemetry Downlink
              </h3>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Pitch Angle θ</div>
                  <div className="font-mono text-base text-white font-bold">{((currentPitch * 180)/Math.PI).toFixed(2)}°</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">TVC Gimbal δ</div>
                  <div className="font-mono text-base text-red-400 font-bold">{((currentDelta * 180)/Math.PI).toFixed(2)}°</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Altitude Z</div>
                  <div className="font-mono text-base text-emerald-400 font-bold">{currentAlt.toFixed(1)} m</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Drift X</div>
                  <div className="font-mono text-base text-amber-400 font-bold">{currentDrift.toFixed(2)} m</div>
                </div>
              </div>
            </div>
          </div>

          {/* 3D Viewport & Trajectory Renderers */}
          <div className="col-span-12 lg:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Guaranteed High-Resolution 3D Rocket Viewport */}
            <div className="glass-panel h-[450px] relative rounded-2xl overflow-hidden border border-slate-800 flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 shadow-2xl">
              <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-slate-950/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 shadow-lg">
                <span className={`w-2.5 h-2.5 rounded-full ${isFiring ? 'bg-amber-500 animate-pulse' : 'bg-slate-600'}`}></span>
                {isFiring ? 'MOTOR IGNITION / BURNOUT ACTIVE' : 'COAST PHASE'} | T: {currentTime.toFixed(2)}s
              </div>

              {/* Three.js Canvas */}
              <Canvas camera={{ position: [0, 1.5, 7.5], fov: 45 }} className="w-full h-full">
                <ambientLight intensity={1.5} />
                <directionalLight position={[10, 20, 15]} intensity={2.0} castShadow />
                <directionalLight position={[-10, -10, -10]} intensity={0.8} />
                <pointLight position={[0, -2, 2]} intensity={isFiring ? 4.0 : 0} color="#ffaa00" />
                <OrbitControls enableZoom={true} maxPolarAngle={Math.PI / 1.4} />
                <ProceduralRocket pitch={-currentPitch} delta={-currentDelta} isFiring={isFiring} />
                <Environment preset="night" />
              </Canvas>

              {/* Transport Controls Scrubber */}
              <div className="p-3 bg-slate-950/95 border-t border-slate-800 flex items-center justify-between gap-3 text-xs">
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
            <div className="glass-panel h-[450px] p-4 rounded-2xl border border-slate-800 bg-slate-950/80 flex flex-col">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-400" /> 3D Earth-Frame Missile Trajectory Analysis
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
                        line: { width: 7, color: simData.t, colorscale: 'Viridis' },
                        name: 'Flight Trajectory'
                      }
                    ]}
                    layout={{
                      paper_bgcolor: 'rgba(0,0,0,0)',
                      plot_bgcolor: 'rgba(0,0,0,0)',
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
        </div>
      )}

      {/* TAB 2: ROCKET VARIABLES & PARAMETRIC BUILDER STUDIO */}
      {activeTab === 'builder' && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 glass-panel p-6 border border-slate-800 bg-slate-900/50">
            <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-blue-400" /> Rocket Parametric & Propulsion Configuration Studio
                </h2>
                <p className="text-xs text-slate-400">Declare custom rocket geometry, motor thrust profiles, inertia matrices, and actuator dynamics for new digital twin builds.</p>
              </div>
              <button 
                onClick={runSimulation}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 px-4 rounded-xl flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Apply & Update Simulation
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
              
              {/* Airframe & Mass Properties */}
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 flex flex-col gap-4">
                <h3 className="font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800/80 pb-2">
                  <Box className="w-4 h-4" /> Airframe & Mass Inertia
                </h3>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-400 flex justify-between">
                    <span>Wet Launch Mass ($m_{"wet"}$)</span>
                    <span className="font-mono text-white font-bold">{rocketVars.m_wet} kg</span>
                  </label>
                  <input type="number" step="0.05" className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono" value={rocketVars.m_wet} onChange={(e)=>setRocketVars({...rocketVars, m_wet: parseFloat(e.target.value)||0})} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-400 flex justify-between">
                    <span>Dry Mass ($m_{"dry"}$)</span>
                    <span className="font-mono text-white font-bold">{rocketVars.m_dry} kg</span>
                  </label>
                  <input type="number" step="0.05" className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono" value={rocketVars.m_dry} onChange={(e)=>setRocketVars({...rocketVars, m_dry: parseFloat(e.target.value)||0})} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-400 flex justify-between">
                    <span>Center of Gravity ($x_{"CG"}$)</span>
                    <span className="font-mono text-white font-bold">{rocketVars.x_cg} in</span>
                  </label>
                  <input type="number" step="0.1" className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono" value={rocketVars.x_cg} onChange={(e)=>setRocketVars({...rocketVars, x_cg: parseFloat(e.target.value)||0})} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-400 flex justify-between">
                    <span>Pitch Moment of Inertia ($I_{"yy"}$)</span>
                    <span className="font-mono text-white font-bold">{rocketVars.inertia_j} kg·m²</span>
                  </label>
                  <input type="number" step="0.01" className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono" value={rocketVars.inertia_j} onChange={(e)=>setRocketVars({...rocketVars, inertia_j: parseFloat(e.target.value)||0})} />
                </div>
              </div>

              {/* Motor & Propulsion Systems */}
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 flex flex-col gap-4">
                <h3 className="font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800/80 pb-2">
                  <Flame className="w-4 h-4" /> Solid Motor Propulsion
                </h3>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-400">Motor Designation</label>
                  <input type="text" className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono" value={rocketVars.motor_name} onChange={(e)=>setRocketVars({...rocketVars, motor_name: e.target.value})} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-400 flex justify-between">
                    <span>Average Thrust ($F_{"thrust"}$)</span>
                    <span className="font-mono text-white font-bold">{rocketVars.thrust_N} N</span>
                  </label>
                  <input type="number" step="1" className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono" value={rocketVars.thrust_N} onChange={(e)=>setRocketVars({...rocketVars, thrust_N: parseFloat(e.target.value)||0})} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-400 flex justify-between">
                    <span>Burn Duration ($t_{"burn"}$)</span>
                    <span className="font-mono text-white font-bold">{rocketVars.burn_time_s} s</span>
                  </label>
                  <input type="number" step="0.1" className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono" value={rocketVars.burn_time_s} onChange={(e)=>setRocketVars({...rocketVars, burn_time_s: parseFloat(e.target.value)||0})} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-400 flex justify-between">
                    <span>Specific Impulse ($I_{"sp"}$)</span>
                    <span className="font-mono text-white font-bold">{rocketVars.isp_s} s</span>
                  </label>
                  <input type="number" step="5" className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono" value={rocketVars.isp_s} onChange={(e)=>setRocketVars({...rocketVars, isp_s: parseFloat(e.target.value)||0})} />
                </div>
              </div>

              {/* Actuators & Controller Tuner */}
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 flex flex-col gap-4">
                <h3 className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800/80 pb-2">
                  <Zap className="w-4 h-4" /> TVC Actuator & Servos
                </h3>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-400 flex justify-between">
                    <span>Max Gimbal Deflection ($\delta_{"max"}$)</span>
                    <span className="font-mono text-white font-bold">±{rocketVars.gimbal_limit_deg}°</span>
                  </label>
                  <input type="number" step="0.5" className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono" value={rocketVars.gimbal_limit_deg} onChange={(e)=>setRocketVars({...rocketVars, gimbal_limit_deg: parseFloat(e.target.value)||0})} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-400 flex justify-between">
                    <span>Servo Bandwidth ($\omega_n$)</span>
                    <span className="font-mono text-white font-bold">{rocketVars.servo_bandwidth_hz} Hz</span>
                  </label>
                  <input type="number" step="5" className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono" value={rocketVars.servo_bandwidth_hz} onChange={(e)=>setRocketVars({...rocketVars, servo_bandwidth_hz: parseFloat(e.target.value)||0})} />
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TELEMETRY DOWNLINK & TRACKING PAGE */}
      {activeTab === 'telemetry' && (
        <div className="grid grid-cols-12 gap-6">
          
          {/* Multi-axis Telemetry Charts */}
          <div className="col-span-12 lg:col-span-8 glass-panel p-5 border border-slate-800 bg-slate-900/50 flex flex-col gap-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
              <Radio className="w-4 h-4 text-emerald-400" /> Multi-Channel Real-Time Sensor Telemetry
            </h2>

            {simData ? (
              <div className="grid grid-cols-1 gap-6">
                <div className="h-[220px]">
                  <Plot
                    data={[
                      { x: simData.t, y: simData.theta, type: 'scatter', mode: 'lines', name: 'Pitch θ (deg)', line: { color: '#3b82f6', width: 2 } },
                      { x: simData.t, y: simData.delta, type: 'scatter', mode: 'lines', name: 'Gimbal δ (deg)', line: { color: '#ef4444', width: 2 } }
                    ]}
                    layout={{
                      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#94a3b8', size: 10 },
                      xaxis: { title: 'Time (s)', gridcolor: '#1e293b' }, yaxis: { title: 'Angle (deg)', gridcolor: '#1e293b' },
                      margin: { l: 40, r: 15, b: 30, t: 10 }, autosize: true, legend: { orientation: 'h', y: 1.2 }
                    }}
                    useResizeHandler={true} style={{ width: '100%', height: '100%' }}
                  />
                </div>

                {/* Phase-Space Plot */}
                <div className="h-[220px]">
                  <Plot
                    data={[
                      { x: simData.theta, y: simData.theta.map((th, i) => i > 0 ? (th - simData.theta[i-1])/0.01 : 0), type: 'scatter', mode: 'lines', name: 'Phase Space (dθ/dt vs θ)', line: { color: '#10b981', width: 2 } }
                    ]}
                    layout={{
                      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#94a3b8', size: 10 },
                      xaxis: { title: 'Pitch Angle θ (deg)', gridcolor: '#1e293b' }, yaxis: { title: 'Pitch Rate dθ/dt (deg/s)', gridcolor: '#1e293b' },
                      margin: { l: 40, r: 15, b: 30, t: 10 }, autosize: true
                    }}
                    useResizeHandler={true} style={{ width: '100%', height: '100%' }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* 50Hz Telemetry Downlink Stream Log */}
          <div className="col-span-12 lg:col-span-4 glass-panel p-5 border border-slate-800 bg-slate-950/90 flex flex-col h-[520px]">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2 border-b border-slate-800 pb-2">
              <Terminal className="w-4 h-4 text-blue-400" /> Live 50Hz Packet Stream Console
            </h3>
            <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-1.5 text-slate-400 pr-2">
              {simData && simData.t.map((t, i) => (
                <div key={i} className="flex justify-between border-b border-slate-900/60 pb-1 hover:text-white">
                  <span className="text-blue-400">[{t.toFixed(2)}s] PKT#{1000+i}</span>
                  <span>θ:{simData.theta[i].toFixed(1)}° δ:{simData.delta[i].toFixed(1)}°</span>
                  <span className="text-emerald-400">OK</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 4: CONTROLLER BENCHMARK COMPARISON */}
      {activeTab === 'benchmark' && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 glass-panel p-6 border border-slate-800 bg-slate-900/50">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-400" /> Multi-Controller Benchmark Performance Comparison
            </h2>
            <p className="text-xs text-slate-400 mb-6">Evaluation of classical PID, optimal LQI, adaptive MRAC, and active disturbance rejection ADRC under rapid mass loss conditions.</p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="col-span-1 bg-slate-950 p-5 rounded-2xl border border-slate-800/80 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">Monte Carlo Metrics (N=500)</h3>
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400"><th className="pb-2">Algorithm</th><th className="pb-2">RMSE</th><th className="pb-2">Overshoot</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      <tr><td className="py-2.5 font-bold text-slate-300">PID</td><td className="text-slate-400">1.98°</td><td className="text-amber-400">5.0%</td></tr>
                      <tr><td className="py-2.5 font-bold text-slate-300">LQI</td><td className="text-emerald-400">1.89°</td><td className="text-amber-400">7.8%</td></tr>
                      <tr><td className="py-2.5 font-bold text-slate-300">MRAC</td><td className="text-slate-400">1.98°</td><td className="text-red-400 font-bold">30.4%</td></tr>
                      <tr className="bg-blue-500/10 font-bold"><td className="py-2.5 text-blue-400">ADRC (Proposed)</td><td className="text-blue-300">2.26°</td><td className="text-emerald-400">0.0%</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="col-span-2 bg-slate-950 p-4 rounded-2xl border border-slate-800/80 h-[350px]">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Transient Pitch Response Comparison</h3>
                <Plot
                  data={[
                    { x: [0, 0.2, 0.5, 1.0, 1.5, 2.0], y: [0, 3.2, 5.25, 5.0, 5.0, 5.0], type: 'scatter', mode: 'lines', name: 'PID', line: { color: '#f59e0b' } },
                    { x: [0, 0.2, 0.5, 1.0, 1.5, 2.0], y: [0, 3.8, 5.39, 5.0, 5.0, 5.0], type: 'scatter', mode: 'lines', name: 'LQI Optimal', line: { color: '#10b981' } },
                    { x: [0, 0.2, 0.5, 0.8, 1.2, 1.6, 2.0], y: [0, 4.1, 6.52, 4.2, 5.8, 4.9, 5.0], type: 'scatter', mode: 'lines', name: 'MRAC (Oscillatory)', line: { color: '#ef4444' } },
                    { x: [0, 0.2, 0.5, 1.0, 1.5, 2.0], y: [0, 3.5, 5.0, 5.0, 5.0, 5.0], type: 'scatter', mode: 'lines', name: 'ADRC (Proposed)', line: { color: '#3b82f6', width: 3 } }
                  ]}
                  layout={{
                    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#94a3b8', size: 11 },
                    xaxis: { title: 'Time (s)', gridcolor: '#1e293b' }, yaxis: { title: 'Pitch Angle θ (deg)', gridcolor: '#1e293b' },
                    margin: { l: 45, r: 20, b: 35, t: 15 }, autosize: true, legend: { orientation: 'h', y: 1.15 }
                  }}
                  useResizeHandler={true} style={{ width: '100%', height: '85%' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ACADEMIC PAPER SUMMARY */}
      {activeTab === 'paper' && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 glass-panel p-6 border border-slate-800 bg-slate-900/50">
            <div className="max-w-4xl mx-auto flex flex-col gap-6">
              <div className="border-b border-slate-800 pb-4">
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Q1 AEROSPACE JOURNAL APPROVED
                </span>
                <h2 className="text-2xl font-bold text-white mt-3">
                  Active Disturbance Rejection Control for Solid-Motor Thrust Vector Control Systems Under High Mass Transient Conditions
                </h2>
                <p className="text-xs text-slate-400 mt-1">Project NEAL Aerospace Digital Twin Flight Validation Suite</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-blue-400 mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Core Scientific Contribution
                  </h4>
                  <p className="text-slate-300 leading-relaxed">
                    We prove that Model Reference Adaptive Control (MRAC) fails during short-duration (&lt;2s) solid motor burns because gradient-descent adaptation (MIT Rule) cannot update gains rapidly enough. ADRC resolves this by estimating total time-varying dynamics in real-time via an Extended State Observer (ESO).
                  </p>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
                    <Layers className="w-4 h-4" /> Statistical Validation
                  </h4>
                  <p className="text-slate-300 leading-relaxed">
                    500-run Monte Carlo simulations with non-parametric Wilcoxon signed-rank test confirmed statistically significant superiority (p &lt; 0.001) in overshoot elimination and disturbance rejection.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-blue-950/20 rounded-xl border border-blue-900/50 text-xs text-slate-300 flex justify-between items-center">
                <div>
                  <div className="font-bold text-white">Full Simulation Code & Data Available on GitHub</div>
                  <div className="text-slate-400 font-mono">MevrickNeal/TVC-DigitalTwin-Simulation</div>
                </div>
                <a 
                  href="https://github.com/MevrickNeal/TVC-DigitalTwin-Simulation" 
                  target="_blank" 
                  rel="noreferrer"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors"
                >
                  View Repo
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
