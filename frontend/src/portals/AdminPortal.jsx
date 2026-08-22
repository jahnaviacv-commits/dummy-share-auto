import React, { useState } from "react";
import Map from "../components/Map";
import { ShieldCheck, UserCheck, Trash2, Plus, CreditCard, Save, Settings, Layers } from "lucide-react";

export default function AdminPortal({
  stops = [],
  drivers = [],
  bookings = [],
  config = {},
  onDriverVerify = null,
  onDriverDelete = null,
  onConfigUpdate = null,
  onStopAction = null,
  skipAuth = false
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(skipAuth);
  const [password, setPassword] = useState("");
  const [passError, setPassError] = useState("");

  // Stop Form State
  const [stopName, setStopName] = useState("");
  const [stopLat, setStopLat] = useState("");
  const [stopLng, setStopLng] = useState("");

  // Config State
  const [perStopFare, setPerStopFare] = useState(config.perStopFare || 20);
  const [olaApiKey, setOlaApiKey] = useState(config.olaMapsApiKey || "");

  const handleLogin = (e) => {
    e.preventDefault();
    // Simple verification check - allow 'shareauto2026' or blank for easy sandbox testing
    if (password === "shareauto2026" || password === "") {
      setIsAuthenticated(true);
      setPassError("");
    } else {
      setPassError("Incorrect Password. Use 'shareauto2026' or leave empty to test.");
    }
  };

  const handleSaveConfig = () => {
    if (onConfigUpdate) {
      onConfigUpdate({
        perStopFare: Number(perStopFare),
        olaMapsApiKey: olaApiKey
      });
      alert("Configuration saved successfully!");
    }
  };

  const handleAddStop = (e) => {
    e.preventDefault();
    if (!stopName || !stopLat || !stopLng) return;

    if (onStopAction) {
      onStopAction("add", {
        name: stopName,
        lat: Number(stopLat),
        lng: Number(stopLng)
      });
      // Reset
      setStopName("");
      setStopLat("");
      setStopLng("");
    }
  };

  const handleDeleteStop = (stopId) => {
    if (window.confirm("Are you sure you want to delete this stop?")) {
      if (onStopAction) {
        onStopAction("delete", { id: stopId });
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50 p-4">
        <div className="w-full max-w-sm bg-white p-6 rounded-2xl border border-slate-200 shadow-md">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center text-2xl mx-auto shadow mb-3">
              ⚙️
            </div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">Admin Gate</h2>
            <p className="text-xs text-slate-500 font-medium">Password restricted to authorized operators</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Enter Passcode</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="E.g. shareauto2026 (or blank)"
                className="w-full bg-white border border-slate-300 text-sm font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              {passError && <p className="text-[10px] text-rose-600 font-medium mt-1">{passError}</p>}
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs uppercase shadow transition"
            >
              Verify Credentials
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Active bookings in system
  const activeBookings = bookings.filter(b => b.status === "active");

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden md:flex-row">
      {/* Left panel */}
      <div className="w-full md:w-[480px] bg-white shadow-md border-r border-slate-200 overflow-y-auto p-5 flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-1.5">
            ⚙️ Admin Panel <span className="bg-slate-100 text-slate-800 text-[10px] px-2 py-0.5 rounded-full border">Super</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">Verify driver profiles, configure stop routes, and adjust fares</p>
        </div>

        {/* 1. Fare & Map configuration */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
            <Settings size={14} className="text-amber-500" /> Fare & Ola Maps Integration
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase">Per-Hop Fare (₹)</label>
              <input
                type="number"
                value={perStopFare}
                onChange={(e) => setPerStopFare(e.target.value)}
                className="w-full bg-white border border-slate-300 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase">Ola Maps API Key</label>
              <input
                type="text"
                value={olaApiKey}
                onChange={(e) => setOlaApiKey(e.target.value)}
                placeholder="Paste key to switch tiles"
                className="w-full bg-white border border-slate-300 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={handleSaveConfig}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1 transition shadow-sm"
          >
            <Save size={12} /> Save Configurations
          </button>
        </div>

        {/* 2. Driver Approval Manager */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Manage Drivers ({drivers.length})</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {drivers.length === 0 ? (
              <div className="text-xs text-slate-400 py-2">No registered drivers in database.</div>
            ) : (
              drivers.map((driver) => (
                <div key={driver.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center shadow-sm">
                  <div>
                    <h4 className="text-xs font-black text-slate-800">{driver.name}</h4>
                    <span className="text-[10px] text-slate-500 font-semibold">{driver.phone} • {driver.autoNumber}</span>
                    <span className="block text-[9px] text-indigo-600 font-bold uppercase mt-0.5">{driver.vehicleType}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {!driver.isVerified && (
                      <button
                        onClick={() => onDriverVerify && onDriverVerify(driver.id)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-0.5 shadow-sm"
                        title="Approve driver"
                      >
                        <UserCheck size={10} /> Approve
                      </button>
                    )}
                    <button
                      onClick={() => onDriverDelete && onDriverDelete(driver.id)}
                      className="bg-rose-50 text-rose-600 hover:bg-rose-100 text-[10px] font-bold p-1.5 rounded-lg"
                      title="Remove profile"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. Stops Route Manager */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Layers size={14} className="text-slate-500" /> Stops & Routes ({stops.length} Stops)
          </h3>
          
          {/* Stops List */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {stops.map((stop, idx) => (
              <div key={stop.id} className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700">
                  {idx + 1}. {stop.name} <span className="text-[9px] text-slate-400 font-mono">({stop.lat.toFixed(4)}, {stop.lng.toFixed(4)})</span>
                </span>
                <button
                  onClick={() => handleDeleteStop(stop.id)}
                  className="text-slate-400 hover:text-rose-600 transition"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Add Stop Form */}
          <form onSubmit={handleAddStop} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <span className="block text-[10px] font-bold text-slate-500 uppercase">Add New Hyderabad Stop</span>
            
            <input
              type="text"
              required
              placeholder="Stop Name (e.g. Lingampally Station)"
              value={stopName}
              onChange={(e) => setStopName(e.target.value)}
              className="w-full bg-white border border-slate-300 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="any"
                required
                placeholder="Latitude (e.g. 17.483)"
                value={stopLat}
                onChange={(e) => setStopLat(e.target.value)}
                className="w-full bg-white border border-slate-300 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none"
              />
              <input
                type="number"
                step="any"
                required
                placeholder="Longitude (e.g. 78.315)"
                value={stopLng}
                onChange={(e) => setStopLng(e.target.value)}
                className="w-full bg-white border border-slate-300 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 rounded-lg text-xs flex items-center justify-center gap-1 shadow-sm uppercase"
            >
              <Plus size={12} /> Add Stop to Route
            </button>
          </form>
        </div>

        {/* 4. Active bookings list */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Active System Bookings ({activeBookings.length})</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {activeBookings.length === 0 ? (
              <div className="text-xs text-slate-400 py-1">No active bookings.</div>
            ) : (
              activeBookings.map((b) => {
                const driver = drivers.find(d => d.id === b.driverId);
                const pickup = stops.find(s => s.id === b.pickupStopId);
                const drop = stops.find(s => s.id === b.dropStopId);
                
                return (
                  <div key={b.id} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] shadow-sm flex flex-col gap-1">
                    <div className="flex justify-between items-center font-bold text-slate-700">
                      <span>{b.passengerName} ({b.passengerGender === "Male" ? "♂️" : "♀️"})</span>
                      <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 rounded-full">
                        Driver: {driver ? driver.name : "Unknown"}
                      </span>
                    </div>
                    <div className="text-slate-500 font-medium">
                      {pickup?.name} ➔ {drop?.name}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Right Monitor Map */}
      <div className="flex-1 h-[40vh] md:h-full">
        <Map
          stops={stops}
          drivers={drivers}
          olaMapsApiKey={config.olaMapsApiKey}
        />
      </div>
    </div>
  );
}
