import React, { useState, useEffect, useRef } from "react";
import Map from "../components/Map";
import { Play, Square, CircleDot, UserCheck, ShieldAlert, Phone, RefreshCw } from "lucide-react";

export default function DriverPortal({
  stops = [],
  drivers = [],
  bookings = [],
  config = {},
  onDriverRegister = null,
  onDriverLocationUpdate = null, // WebSocket send callback
  wsConnected = false
}) {
  const [selectedDriverId, setSelectedDriverId] = useState("");
  
  // Registration form
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regAutoNum, setRegAutoNum] = useState("");
  const [regVehicleType, setRegVehicleType] = useState("5-seater");

  // Simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const simIntervalRef = useRef(null);
  const simPathRef = useRef([]);
  const simIndexRef = useRef(0);

  const activeDriver = drivers.find(d => d.id === selectedDriverId);
  const activeBookings = bookings.filter(b => b.driverId === selectedDriverId && b.status === "active");

  // Clean up simulator on unmount
  useEffect(() => {
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regName || !regPhone || !regAutoNum) return;

    if (onDriverRegister) {
      const driver = await onDriverRegister({
        name: regName,
        phone: regPhone,
        autoNumber: regAutoNum,
        vehicleType: regVehicleType
      });
      if (driver && driver.id) {
        setSelectedDriverId(driver.id);
        // Clear form
        setRegName("");
        setRegPhone("");
        setRegAutoNum("");
      }
    }
  };

  const handleStopChange = (stopId) => {
    if (!activeDriver) return;
    const stop = stops.find(s => s.id === stopId);
    if (!stop) return;

    // Send update
    if (onDriverLocationUpdate) {
      onDriverLocationUpdate({
        driverId: activeDriver.id,
        lat: stop.lat,
        lng: stop.lng,
        currentStopId: stopId
      });
    }
  };

  // Generate intermediate points along stops for smooth simulation movement
  const generateRoutePoints = () => {
    if (stops.length < 2) return [];
    const points = [];
    const stepsPerHop = 15; // smooth steps between stops

    for (let i = 0; i < stops.length - 1; i++) {
      const from = stops[i];
      const to = stops[i + 1];

      for (let s = 0; s < stepsPerHop; s++) {
        const t = s / stepsPerHop;
        const lat = from.lat + (to.lat - from.lat) * t;
        const lng = from.lng + (to.lng - from.lng) * t;
        points.push({ lat, lng, stopId: from.id });
      }
    }
    // Add final stop
    const lastStop = stops[stops.length - 1];
    points.push({ lat: lastStop.lat, lng: lastStop.lng, stopId: lastStop.id });

    // Double the path to simulate return journey
    const reversePoints = [...points].reverse().slice(1);
    return [...points, ...reversePoints];
  };

  const startSimulation = () => {
    if (!activeDriver) return;
    setIsSimulating(true);

    const path = generateRoutePoints();
    simPathRef.current = path;
    
    // Find closest index in path to driver's current position
    let closestIndex = 0;
    let minDist = Infinity;
    path.forEach((pt, idx) => {
      const dist = Math.pow(pt.lat - activeDriver.currentLat, 2) + Math.pow(pt.lng - activeDriver.currentLng, 2);
      if (dist < minDist) {
        minDist = dist;
        closestIndex = idx;
      }
    });

    simIndexRef.current = closestIndex;

    // Set simulator interval (tick every 1.5 seconds)
    simIntervalRef.current = setInterval(() => {
      const currentIndex = simIndexRef.current;
      const nextIndex = (currentIndex + 1) % path.length;
      simIndexRef.current = nextIndex;

      const pos = path[nextIndex];
      
      // Determine nearest stop to report stop boundaries
      let nearestStopId = pos.stopId;
      stops.forEach(stop => {
        const dist = Math.sqrt(Math.pow(stop.lat - pos.lat, 2) + Math.pow(stop.lng - pos.lng, 2));
        if (dist < 0.003) { // close enough to snap to stop ID
          nearestStopId = stop.id;
        }
      });

      if (onDriverLocationUpdate) {
        onDriverLocationUpdate({
          driverId: activeDriver.id,
          lat: pos.lat,
          lng: pos.lng,
          currentStopId: nearestStopId
        });
      }
    }, 1500);
  };

  const stopSimulation = () => {
    setIsSimulating(false);
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 md:flex-row overflow-hidden">
      {/* Left controls */}
      <div className="w-full md:w-[400px] bg-white shadow-md overflow-y-auto border-r border-slate-200 p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-1">
            🧑‍✈️ Driver Dashboard
          </h2>
          <p className="text-xs text-slate-500 font-medium">Manage your auto status, bookings, and stream GPS location</p>
        </div>

        {/* Driver Selection Profile */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Select Driver Profile</label>
          <select
            value={selectedDriverId}
            onChange={(e) => {
              setSelectedDriverId(e.target.value);
              stopSimulation();
            }}
            className="w-full bg-white border border-slate-300 text-sm font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="">-- Choose Profile --</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.autoNumber} - {d.vehicleType})
              </option>
            ))}
          </select>
        </div>

        {/* Selected Driver Control Panel */}
        {activeDriver ? (
          <div className="space-y-4">
            {/* Status alerts */}
            {!activeDriver.isVerified ? (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-2 shadow-sm">
                <ShieldAlert className="text-rose-600 shrink-0 mt-0.5" size={16} />
                <div>
                  <h4 className="text-xs font-bold text-rose-800">Unverified Profile</h4>
                  <p className="text-[10px] text-rose-700 font-medium mt-0.5">
                    Your auto details are awaiting Admin approval. Open the Admin portal to approve your profile, otherwise passengers cannot see or book you.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-2 shadow-sm">
                <UserCheck className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                <div>
                  <h4 className="text-xs font-bold text-emerald-800">Verified & Active</h4>
                  <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                    Your profile is active and visible to passengers!
                  </p>
                </div>
              </div>
            )}

            {/* GPS simulation tools */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">GPS Simulation & Telemetry</h3>
              
              {/* Manual position setting */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Set Current Stop (Manual)</label>
                <select
                  value={activeDriver.currentStopId || ""}
                  disabled={isSimulating}
                  onChange={(e) => handleStopChange(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-60"
                >
                  <option value="">Select current stop</option>
                  {stops.map((stop) => (
                    <option key={stop.id} value={stop.id}>
                      {stop.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Automatic route simulator */}
              <div className="pt-2">
                {isSimulating ? (
                  <button
                    onClick={stopSimulation}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 shadow"
                  >
                    <Square size={14} /> Stop GPS Route Simulation
                  </button>
                ) : (
                  <button
                    onClick={startSimulation}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 shadow"
                  >
                    <Play size={14} /> Start Route Simulation (Auto Drive)
                  </button>
                )}
                {isSimulating && (
                  <p className="text-[9px] text-slate-400 mt-1.5 text-center flex items-center justify-center gap-1">
                    <RefreshCw size={10} className="animate-spin text-amber-500" /> Simulating GPS movement along route...
                  </p>
                )}
              </div>
            </div>

            {/* Booked Passengers listing */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Booked Passengers ({activeBookings.length})</h3>
              {activeBookings.length === 0 ? (
                <div className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-slate-400 font-medium">
                  No active passenger bookings at the moment.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {activeBookings.map((booking) => {
                    const pickupStop = stops.find(s => s.id === booking.pickupStopId);
                    const dropStop = stops.find(s => s.id === booking.dropStopId);
                    
                    return (
                      <div key={booking.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2 shadow-sm text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-800 flex items-center gap-1">
                            {booking.passengerName} ({booking.passengerGender === "Male" ? "♂️" : "♀️"})
                          </span>
                          <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                            Seat {booking.seatIndex + 1}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 flex flex-col gap-0.5">
                          <div><span className="font-bold text-emerald-600">Pickup:</span> {pickupStop?.name}</div>
                          <div><span className="font-bold text-rose-600">Drop:</span> {dropStop?.name}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Register New Driver Form */
          <form onSubmit={handleRegister} className="border-t border-slate-100 pt-4 space-y-3.5">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Or Register New Profile</h3>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Driver Name</label>
              <input
                type="text"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="E.g. Raju Prasad"
                className="w-full bg-white border border-slate-300 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone Number</label>
              <input
                type="tel"
                required
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="E.g. 9876543210"
                className="w-full bg-white border border-slate-300 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Auto Vehicle Number</label>
              <input
                type="text"
                required
                value={regAutoNum}
                onChange={(e) => setRegAutoNum(e.target.value)}
                placeholder="E.g. TS-09-TA-1234"
                className="w-full bg-white border border-slate-300 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Auto Capacity Type</label>
              <select
                value={regVehicleType}
                onChange={(e) => setRegVehicleType(e.target.value)}
                className="w-full bg-white border border-slate-300 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="5-seater">5-Seater</option>
                <option value="9-seater">9-Seater</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs uppercase shadow transition"
            >
              Submit Verification Request
            </button>
          </form>
        )}
      </div>

      {/* Right map */}
      <div className="flex-1 h-[40vh] md:h-full">
        <Map
          stops={stops}
          drivers={drivers}
          activeDriverId={selectedDriverId}
          olaMapsApiKey={config.olaMapsApiKey}
        />
      </div>
    </div>
  );
}
