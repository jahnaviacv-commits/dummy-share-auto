import React, { useState } from "react";
import { ArrowLeft, LogIn } from "lucide-react";

const PORTALS = [
  {
    id: "passenger",
    title: "Passenger",
    subtitle: "Book a shared auto, pick a seat, track your ride",
    icon: "🧍",
    accent: "bg-amber-400",
    demo: "9000000001 / passenger"
  },
  {
    id: "driver",
    title: "Driver",
    subtitle: "Go online, see passengers, stream GPS along the route",
    icon: "🧑‍✈️",
    accent: "bg-emerald-400",
    demo: "9876543210 / driver"
  },
  {
    id: "admin",
    title: "Admin",
    subtitle: "Approve drivers, manage stops, set per-hop fare",
    icon: "⚙️",
    accent: "bg-slate-800 text-white",
    demo: "9999999999 / admin"
  }
];

export default function PortalGate({ onLogin }) {
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const portal = PORTALS.find((p) => p.id === role);

  const fillDemo = () => {
    if (!portal) return;
    const [demoPhone, demoPass] = portal.demo.split(" / ");
    setPhone(demoPhone);
    setPassword(demoPass);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, phone, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed.");
        return;
      }
      onLogin(data.user);
    } catch (err) {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!role) {
    return (
      <div className="h-full overflow-y-auto bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="text-center mb-8">
            <div className="text-4xl mb-2">🛺</div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Choose your portal</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Three separate users: Passenger, Driver, and Admin
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {PORTALS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setRole(p.id);
                  setPhone("");
                  setPassword("");
                  setError("");
                }}
                className="text-left bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-amber-300 transition"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-3 ${p.accent}`}>
                  {p.icon}
                </div>
                <h3 className="text-lg font-black text-slate-800">{p.title}</h3>
                <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{p.subtitle}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-3">Demo: {p.demo}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full bg-slate-50 p-4">
      <div className="w-full max-w-sm bg-white p-6 rounded-2xl border border-slate-200 shadow-md">
        <button
          type="button"
          onClick={() => setRole("")}
          className="text-[11px] font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1 mb-4"
        >
          <ArrowLeft size={12} /> All portals
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center text-2xl mx-auto shadow mb-3">
            {portal.icon}
          </div>
          <h2 className="text-lg font-black text-slate-800 tracking-tight">{portal.title} login</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">{portal.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone"
              className="w-full bg-white border border-slate-300 text-sm font-semibold rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full bg-white border border-slate-300 text-sm font-semibold rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          {error && <p className="text-[11px] text-rose-600 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-xs uppercase shadow transition flex items-center justify-center gap-1.5"
          >
            <LogIn size={14} /> {loading ? "Signing in..." : `Enter ${portal.title} portal`}
          </button>
        </form>

        <button
          type="button"
          onClick={fillDemo}
          className="mt-3 w-full text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl py-2 hover:bg-amber-100"
        >
          Fill demo login ({portal.demo})
        </button>
      </div>
    </div>
  );
}
