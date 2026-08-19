import React, { useState, useEffect, useRef } from "react";
import UserPortal from "./portals/UserPortal";
import DriverPortal from "./portals/DriverPortal";
import AdminPortal from "./portals/AdminPortal";
import { User, Shield, Users, Radio, Wifi, WifiOff } from "lucide-react";

// Mock profiles for testing bookings/demographics
const testProfiles = [
  { name: "Lakshmi Priya", gender: "Female" },
  { name: "Ramesh Kumar", gender: "Male" },
  { name: "Vikram Singh", gender: "Male" },
  { name: "Deepa Reddy", gender: "Female" }
];

export default function App() {
  const [activePortal, setActivePortal] = useState("user");
  const [activeUserIndex, setActiveUserIndex] = useState(0);

  // Global Sync States
  const [stops, setStops] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [config, setConfig] = useState({ perStopFare: 20, olaMapsApiKey: "" });
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const activeUser = testProfiles[activeUserIndex];

  // Fetch initial data
  const fetchData = async () => {
    try {
      const res = await fetch("/api/data");
      if (res.ok) {
        const data = await res.json();
        setStops(data.stops || []);
        setDrivers(data.drivers || []);
        setBookings(data.bookings || []);
        setConfig(data.config || { perStopFare: 20, olaMapsApiKey: "" });
      }
    } catch (err) {
      console.error("Error fetching initial Sherato data:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Connect WebSockets
  const connectWebSocket = () => {
    if (wsRef.current) return;

    // Build WS path dynamically supporting remote connections
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.50" || window.location.hostname === "127.0.0.1"
      ? "localhost:5000"
      : window.location.host;
    
    const wsUrl = `${wsProtocol}//${wsHost}`;
    console.log("Connecting to WebSocket:", wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected successfully");
      setWsConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case "booking_update":
            setBookings(message.bookings);
            break;
          case "driver_update":
            setDrivers(message.drivers);
            break;
          case "driver_location":
            setDrivers((prevDrivers) =>
              prevDrivers.map((d) =>
                d.id === message.driverId
                  ? {
                      ...d,
                      currentLat: message.lat,
                      currentLng: message.lng,
                      currentStopId: message.currentStopId
                    }
                  : d
              )
            );
            break;
          case "stops_update":
            setStops(message.stops);
            break;
          default:
            break;
        }
      } catch (err) {
        console.error("Failed to parse WebSocket packet:", err);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket connection lost");
      setWsConnected(false);
      wsRef.current = null;
      
      // Auto reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 3000);
    };

    ws.onerror = (err) => {
      console.error("WebSocket error observed:", err);
      ws.close();
    };
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  // Update subscription when portal changes
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "subscribe",
          role: activePortal === "admin" ? "admin" : "passenger"
        })
      );
    }
  }, [activePortal, wsConnected]);

  // WebSocket callbacks
  const sendDriverLocationUpdate = (payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "location_update",
          ...payload
        })
      );
      
      // Update local state immediately for fast feedback
      setDrivers((prev) =>
        prev.map((d) =>
          d.id === payload.driverId
            ? { ...d, currentLat: payload.lat, currentLng: payload.lng, currentStopId: payload.currentStopId }
            : d
        )
      );
    }
  };

  // REST callbacks
  const handleNewBooking = async (bookingData) => {
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData)
      });
      if (res.ok) {
        const newBooking = await res.json();
        // State is updated by WebSocket message broadcast
        return newBooking;
      } else {
        const err = await res.json();
        alert(err.error || "Booking failed.");
      }
    } catch (err) {
      console.error("Booking API error:", err);
    }
    return null;
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId })
      });
      if (res.ok) {
        return true;
      } else {
        const err = await res.json();
        alert(err.error || "Cancellation failed.");
      }
    } catch (err) {
      console.error("Cancellation API error:", err);
    }
    return false;
  };

  const handleDriverVerify = async (driverId) => {
    try {
      const res = await fetch("/api/admin/drivers/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId, action: "verify" })
      });
      return res.ok;
    } catch (err) {
      console.error("Verify driver API error:", err);
    }
    return false;
  };

  const handleDriverDelete = async (driverId) => {
    try {
      const res = await fetch("/api/admin/drivers/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId, action: "delete" })
      });
      return res.ok;
    } catch (err) {
      console.error("Delete driver API error:", err);
    }
    return false;
  };

  const handleConfigUpdate = async (newConfig) => {
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig)
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
      }
    } catch (err) {
      console.error("Config update API error:", err);
    }
  };

  const handleStopAction = async (action, stop) => {
    try {
      const res = await fetch("/api/admin/stops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, stop })
      });
      if (res.ok) {
        const data = await res.json();
        setStops(data.stops);
      }
    } catch (err) {
      console.error("Stops management API error:", err);
    }
  };

  const handleDriverRegister = async (driverData) => {
    try {
      const res = await fetch("/api/drivers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(driverData)
      });
      if (res.ok) {
        const driver = await res.json();
        alert("Registration request submitted to Admin portal!");
        return driver;
      }
    } catch (err) {
      console.error("Driver register API error:", err);
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 overflow-hidden">
      {/* Global Navigation Header */}
      <header className="bg-slate-900 text-white shrink-0 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          
          {/* Logo & Network Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🛺</span>
              <div>
                <h1 className="text-xl font-black tracking-tight leading-none">Share Auto</h1>
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Booking App</span>
              </div>
            </div>
            
            {/* WS Connectivity Dot */}
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 text-[10px] font-bold md:hidden">
              {wsConnected ? (
                <>
                  <Wifi size={10} className="text-emerald-500" />
                  <span className="text-emerald-400">Live</span>
                </>
              ) : (
                <>
                  <WifiOff size={10} className="text-rose-500" />
                  <span className="text-rose-400">Offline</span>
                </>
              )}
            </div>
          </div>

          {/* Controls: Portal Switching & Demo User Selector */}
          <div className="flex flex-wrap items-center gap-3 justify-between md:justify-end">
            
            {/* Passenger Simulation Profiler (Useful for Testing) */}
            {activePortal === "user" && (
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2 py-1 rounded-xl shadow-inner text-xs">
                <span className="text-slate-400 font-medium">Profile:</span>
                <select
                  value={activeUserIndex}
                  onChange={(e) => setActiveUserIndex(Number(e.target.value))}
                  className="bg-transparent text-amber-300 font-bold border-none focus:outline-none cursor-pointer"
                >
                  {testProfiles.map((p, idx) => (
                    <option key={idx} value={idx} className="bg-slate-800 text-white font-bold">
                      {p.name} ({p.gender[0]})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Navigation Tabs */}
            <nav className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 shadow-inner">
              <button
                onClick={() => setActivePortal("user")}
                className={`px-3 py-1 rounded-lg text-xs font-black tracking-wide transition-all ${
                  activePortal === "user"
                    ? "bg-amber-400 text-slate-900 shadow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Passenger
              </button>
              <button
                onClick={() => setActivePortal("driver")}
                className={`px-3 py-1 rounded-lg text-xs font-black tracking-wide transition-all ${
                  activePortal === "driver"
                    ? "bg-amber-400 text-slate-900 shadow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Driver
              </button>
              <button
                onClick={() => setActivePortal("admin")}
                className={`px-3 py-1 rounded-lg text-xs font-black tracking-wide transition-all ${
                  activePortal === "admin"
                    ? "bg-amber-400 text-slate-900 shadow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Admin
              </button>
            </nav>

            {/* Desktop WS Connectivity Dot */}
            <div className="hidden md:flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-full text-xs font-bold shadow-inner">
              {wsConnected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-emerald-400 text-[10px]">Connected</span>
                </>
              ) : (
                <>
                  <span className="inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  <span className="text-rose-400 text-[10px]">Reconnecting...</span>
                </>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Portal Container */}
      <main className="flex-1 overflow-hidden">
        {activePortal === "user" && (
          <UserPortal
            stops={stops}
            drivers={drivers}
            bookings={bookings}
            config={config}
            activeUser={activeUser}
            wsConnected={wsConnected}
            onNewBooking={handleNewBooking}
            onCancelBooking={handleCancelBooking}
          />
        )}

        {activePortal === "driver" && (
          <DriverPortal
            stops={stops}
            drivers={drivers}
            bookings={bookings}
            config={config}
            onDriverRegister={handleDriverRegister}
            onDriverLocationUpdate={sendDriverLocationUpdate}
            wsConnected={wsConnected}
          />
        )}

        {activePortal === "admin" && (
          <AdminPortal
            stops={stops}
            drivers={drivers}
            bookings={bookings}
            config={config}
            onDriverVerify={handleDriverVerify}
            onDriverDelete={handleDriverDelete}
            onConfigUpdate={handleConfigUpdate}
            onStopAction={handleStopAction}
          />
        )}
      </main>
    </div>
  );
}
