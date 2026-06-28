import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import Plot from 'react-plotly.js';
import { Activity, Wind, Settings2, Rocket } from 'lucide-react';

import { Suspense } from 'react';
import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';

function RocketModel({ pitch = 0, delta = 0 }) {
  const materials = useLoader(MTLLoader, '/ProjectNeal1.2.mtl');
  const obj = useLoader(OBJLoader, '/ProjectNeal1.2.obj', (loader) => {
    materials.preload();
    loader.setMaterials(materials);
  });

  return (
    <group rotation={[0, 0, pitch]}>
      {/* Scale down because raw OBJs are usually huge */}
      <primitive object={obj} scale={0.01} position={[0, 0, 0]} />
      
      {/* Gimbal nozzle visual representation since we might not have a separate nozzle mesh */}
      <mesh position={[0, -2, 0]} rotation={[0, 0, delta]}>
        <cylinderGeometry args={[0.2, 0.4, 0.5, 32]} />
        <meshStandardMaterial color="#ff5500" emissive="#ff2200" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

export default function App() {
  const [params, setParams] = useState({
    scenario: 'nominal',
    controller_idx: 4, // ADRC default
    m_wet: 2.055,
    thrust_N: 75.0,
  });

  const [simData, setSimData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const runSimulation = async () => {
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:8000/api/simulate', params);
      setSimData(response.data);
      setCurrentTime(0);
    } catch (err) {
      console.error(err);
      alert('Failed to run simulation. Ensure backend is running.');
    }
    setLoading(false);
  };

  // Animate the 3D rocket over time when simData is available
  useEffect(() => {
    if (!simData) return;
    
    let animationFrame;
    const startTime = performance.now();
    const duration = simData.t[simData.t.length - 1] * 1000; // in ms
    
    const animate = (now) => {
      const elapsed = now - startTime;
      const t_sim = elapsed / 1000;
      
      if (t_sim <= simData.t[simData.t.length - 1]) {
        setCurrentTime(t_sim);
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCurrentTime(simData.t[simData.t.length - 1]);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [simData]);

  // Interpolate current pitch and delta for animation
  let currentPitch = 0;
  let currentDelta = 0;
  if (simData) {
    const idx = simData.t.findIndex(t => t >= currentTime);
    if (idx >= 0) {
      currentPitch = (simData.theta[idx] * Math.PI) / 180; // convert deg to rad for Three.js
      currentDelta = (simData.delta[idx] * Math.PI) / 180;
    }
  }

  return (
    <div className="min-h-screen bg-background text-white p-6 grid grid-cols-12 gap-6 font-sans">
      
      {/* Header */}
      <div className="col-span-12 flex justify-between items-center glass-panel p-4">
        <div className="flex items-center gap-3">
          <Rocket className="text-primary w-8 h-8" />
          <h1 className="text-2xl font-bold tracking-wide">TVC Digital Twin <span className="text-primary/50 text-sm ml-2">v2.0</span></h1>
        </div>
        <button 
          onClick={runSimulation}
          disabled={loading}
          className="bg-primary hover:bg-blue-400 text-white font-semibold py-2 px-6 rounded-lg transition-all shadow-[0_0_15px_rgba(59,130,246,0.5)] flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? 'Simulating...' : 'Run Simulation'}
          <Activity className="w-4 h-4" />
        </button>
      </div>

      {/* Control Panel (Sidebar) */}
      <div className="col-span-12 md:col-span-3 glass-panel p-6 flex flex-col gap-6">
        <h2 className="text-lg font-semibold border-b border-surfaceBorder pb-2 flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-primary" /> Parameters
        </h2>
        
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">Controller Type</label>
          <select 
            className="bg-black/50 border border-surfaceBorder rounded p-2 text-sm focus:border-primary outline-none"
            value={params.controller_idx}
            onChange={(e) => setParams({...params, controller_idx: parseInt(e.target.value)})}
          >
            <option value={1}>PID (Classic)</option>
            <option value={2}>LQI (Optimal)</option>
            <option value={3}>MRAC (Adaptive)</option>
            <option value={4}>ADRC (Robust - Recommended)</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">Environment Scenario</label>
          <select 
            className="bg-black/50 border border-surfaceBorder rounded p-2 text-sm focus:border-primary outline-none"
            value={params.scenario}
            onChange={(e) => setParams({...params, scenario: e.target.value})}
          >
            <option value="nominal">Nominal Flight</option>
            <option value="wind">High Wind Disturbance</option>
            <option value="cg">CG Uncertainty (+15%)</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400 flex justify-between">
            <span>Wet Mass (kg)</span>
            <span className="text-primary">{params.m_wet.toFixed(3)}</span>
          </label>
          <input 
            type="range" min="1.5" max="2.5" step="0.05"
            className="accent-primary"
            value={params.m_wet}
            onChange={(e) => setParams({...params, m_wet: parseFloat(e.target.value)})}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400 flex justify-between">
            <span>Average Thrust (N)</span>
            <span className="text-primary">{params.thrust_N.toFixed(1)}</span>
          </label>
          <input 
            type="range" min="50" max="100" step="1"
            className="accent-primary"
            value={params.thrust_N}
            onChange={(e) => setParams({...params, thrust_N: parseFloat(e.target.value)})}
          />
        </div>
      </div>

      {/* Main Views */}
      <div className="col-span-12 md:col-span-9 grid grid-cols-2 gap-6">
        
        {/* 3D Rocket View */}
        <div className="glass-panel h-[400px] relative overflow-hidden rounded-2xl flex items-center justify-center">
          <div className="absolute top-4 left-4 z-10 bg-black/50 px-3 py-1 rounded text-sm text-gray-300">
            Live TVC Gimbal View (T: {currentTime.toFixed(2)}s)
          </div>
          <Canvas camera={{ position: [0, 5, 15], fov: 50 }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            <OrbitControls enableZoom={true} />
            <Suspense fallback={<mesh><boxGeometry/><meshBasicMaterial color="red"/></mesh>}>
              <RocketModel pitch={-currentPitch} delta={-currentDelta} />
            </Suspense>
            <Environment preset="city" />
          </Canvas>
        </div>

        {/* 3D Trajectory Plot */}
        <div className="glass-panel h-[400px] p-2 flex items-center justify-center">
          {simData ? (
            <Plot
              data={[
                {
                  x: simData.drift_x,
                  y: simData.t.map(() => 0), // Assuming negligible lateral Y drift for now
                  z: simData.altitude,
                  type: 'scatter3d',
                  mode: 'lines',
                  line: {
                    width: 6,
                    color: simData.t,
                    colorscale: 'Viridis',
                  },
                  name: 'Trajectory'
                }
              ]}
              layout={{
                title: { text: '3D Missile Trajectory Mapping', font: { color: '#fff' } },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { color: '#aaa' },
                margin: { l: 0, r: 0, b: 0, t: 40 },
                scene: {
                  xaxis: { title: 'Drift X (m)', gridcolor: '#333' },
                  yaxis: { title: 'Drift Y (m)', gridcolor: '#333' },
                  zaxis: { title: 'Altitude (m)', gridcolor: '#333' },
                  camera: { eye: {x: 1.5, y: 1.5, z: 0.5} }
                },
                autosize: true
              }}
              useResizeHandler={true}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <div className="text-gray-500">Run simulation to view trajectory</div>
          )}
        </div>

        {/* 2D Metrics Plots */}
        <div className="col-span-2 glass-panel h-[300px] p-2">
           {simData ? (
            <Plot
              data={[
                { x: simData.t, y: simData.theta, type: 'scatter', mode: 'lines', name: 'Pitch (deg)', line: {color: '#3b82f6', width: 2} },
                { x: simData.t, y: simData.delta, type: 'scatter', mode: 'lines', name: 'Gimbal (deg)', line: {color: '#ef4444', width: 2} }
              ]}
              layout={{
                title: { text: 'Control System Response', font: { color: '#fff' } },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { color: '#aaa' },
                xaxis: { title: 'Time (s)', gridcolor: '#333' },
                yaxis: { title: 'Angle (deg)', gridcolor: '#333' },
                margin: { l: 50, r: 20, b: 40, t: 40 },
                autosize: true,
                legend: { orientation: 'h', y: -0.2 }
              }}
              useResizeHandler={true}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">Awaiting Data</div>
          )}
        </div>

      </div>
    </div>
  );
}
