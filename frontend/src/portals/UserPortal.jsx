import React, { useState, useEffect } from "react";
import SeatMap from "../components/SeatMap";
import Map from "../components/Map";
import { CreditCard, MapPin, User, Users, CheckCircle, RefreshCw, XCircle } from "lucide-react";

export default function UserPortal({
  stops = [],
  drivers = [],
  bookings = [],
  config = {},
  activeUser = { name: "Ramesh Kumar", gender: "Male" },
  wsConnected = false,
  onNewBooking = null,
  onCancelBooking = null
}) {
  const [pickupStopId, setPickupStopId] = useState("");
  const [dropStopId, setDropStopId] = useState("");
  const [vehicleType, setVehicleType] = useState("5-seater");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedSeatIndex, setSelectedSeatIndex] = useState(null);
  const [activeBookingId, setActiveBookingId] = useState(() => {
    return localStorage.getItem("shareauto_active_booking_id") || "";
  });

  // Keep track of active booking in state
  const activeBooking = bookings.find(b => b.id === activeBookingId && b.status === "active");

  useEffect(() => {
    if (activeBooking) {
      localStorage.setItem("shareauto_active_booking_id", activeBooking.id);
    } else {
      localStorage.removeItem("shareauto_active_booking_id");
      if (activeBookingId) setActiveBookingId("");
    }
  }, [activeBooking, activeBookingId]);

  // Reset selected driver/seat when route or vehicle changes
  useEffect(() => {
    setSelectedDriverId("");
    setSelectedSeatIndex(null);
  }, [pickupStopId, dropStopId, vehicleType]);

  // Calculate fare based on stops list order
  const getHops = () => {
    if (!pickupStopId || !dropStopId) return 0;
    const pickupIdx = stops.findIndex(s => s.id === pickupStopId);
    const dropIdx = stops.findIndex(s => s.id === dropStopId);
    if (pickupIdx === -1 || dropIdx === -1) return 0;
    return Math.abs(dropIdx - pickupIdx);
  };

  const hops = getHops();
  const perStopFare = config.perStopFare || 20;
  const fare = hops * perStopFare;

  // Filter verified active drivers matching vehicle type
  const availableDrivers = drivers.filter(d => 
    d.status === "active" && 
    d.isVerified && 
    d.vehicleType === vehicleType
  );

  const selectedDriver = drivers.find(d => d.id === selectedDriverId);

  // Bookings list for currently selected driver
  const driverBookings = bookings.filter(b => b.driverId === selectedDriverId && b.status === "active");
  const maleCount = driverBookings.filter(b => b.passengerGender === "Male").length;
  const femaleCount = driverBookings.filter(b => b.passengerGender === "Female").length;
  const totalBooked = driverBookings.length;
  const maxSeats = vehicleType === "9-seater" ? 9 : 5;

  // Get active driver details for tracking screen
  const trackingDriver = activeBooking ? drivers.find(d => d.id === activeBooking.driverId) : null;
  const trackingBookings = activeBooking ? bookings.filter(b => b.driverId === activeBooking.driverId && b.status === "active") : [];

  // Calculate distance & ETA (haversine formula)
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  const getETA = () => {
    if (!trackingDriver || !activeBooking) return "Calculating...";
    const pickupStop = stops.find(s => s.id === activeBooking.pickupStopId);
    if (!pickupStop) return "Unknown";

    const dist = getDistance(trackingDriver.currentLat, trackingDriver.currentLng, pickupStop.lat, pickupStop.lng);
    
    // Check relative stop indexing to see if the driver has already passed the stop
    const driverStopIndex = stops.findIndex(s => s.id === trackingDriver.currentStopId);
    const pickupStopIndex = stops.findIndex(s => s.id === activeBooking.pickupStopId);
    const dropStopIndex = stops.findIndex(s => s.id === activeBooking.dropStopId);

    // If driver is at the stop
    if (dist < 0.1) {
      return "Arrived at your pickup!";
    }

    const direction = pickupStopIndex < dropStopIndex ? "forward" : "backward";
    
    if (direction === "forward" && driverStopIndex > pickupStopIndex) {
      return "Passed your stop (In transit to destination)";
    }
    if (direction === "backward" && driverStopIndex < pickupStopIndex) {
      return "Passed your stop (In transit to destination)";
    }

    // Average speed of auto-rickshaw in Hyderabad traffic: 22 km/h
    const speedKmh = 22;
    const hours = dist / speedKmh;
    const mins = Math.round(hours * 60);

    return mins <= 1 ? "Arriving in 1 min" : `Arriving in ${mins} min (${dist.toFixed(1)} km away)`;
  };

  const handleBook = async () => {
    if (!selectedDriverId || selectedSeatIndex === null || !pickupStopId || !dropStopId) return;

    const payload = {
      driverId: selectedDriverId,
      seatIndex: selectedSeatIndex,
      passengerName: activeUser.name,
      passengerGender: activeUser.gender,
      pickupStopId,
      dropStopId
    };

    if (onNewBooking) {
      const res = await onNewBooking(payload);
      if (res && res.id) {
        setActiveBookingId(res.id);
      }
    }
  };

  const handleCancel = async () => {
    if (!activeBookingId) return;
    if (onCancelBooking) {
      const success = await onCancelBooking(activeBookingId);
      if (success) {
        setActiveBookingId("");
      }
    }
  };

  // Live Tracking Dashboard
  if (activeBooking) {
    const pickupStop = stops.find(s => s.id === activeBooking.pickupStopId);
    const dropStop = stops.find(s => s.id === activeBooking.dropStopId);

    return (
      <div className="flex flex-col h-full bg-slate-50 md:flex-row">
        {/* Left pane: Details */}
        <div className="w-full md:w-96 bg-white p-6 shadow-md overflow-y-auto flex flex-col justify-between border-r border-slate-200">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                <CheckCircle size={12} /> Booked & Active
              </span>
              <span className="text-[10px] text-slate-400 font-mono">#{activeBooking.id.split("-")[1]}</span>
            </div>

            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 shadow-sm mb-6">
              <h3 className="text-sm font-bold text-amber-900 mb-1 flex items-center gap-1">
                🛺 Share Auto Ride Ticket
              </h3>
              <p className="text-xs text-amber-800 font-medium">
                Seat {activeBooking.seatIndex + 1} ({activeBooking.passengerGender})
              </p>
              <div className="mt-3 flex flex-col gap-2 text-xs border-t border-amber-200/50 pt-2 text-slate-700">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">From:</span>
                  <span className="font-semibold">{pickupStop?.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-rose-600 font-bold">To:</span>
                  <span className="font-semibold">{dropStop?.name}</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold text-slate-900 justify-between mt-2 border-t border-dashed border-amber-200 pt-2">
                  <span>Fare Paid:</span>
                  <span>₹{hops * perStopFare}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Driver Details</h4>
              {trackingDriver ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-400 border border-slate-300 rounded-full flex items-center justify-center text-lg shadow-sm">
                    🛺
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800 text-sm">{trackingDriver.name}</h5>
                    <p className="text-xs text-slate-500 font-medium">{trackingDriver.autoNumber} • {trackingDriver.vehicleType}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{trackingDriver.phone}</p>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400">Driver offline / connecting...</div>
              )}
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6 shadow-sm">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Live Tracking</h4>
              <div className="text-lg font-black text-indigo-900 tracking-tight">{getETA()}</div>
              <p className="text-[10px] text-indigo-600 mt-1 font-medium flex items-center gap-1">
                <RefreshCw size={10} className="animate-spin" /> Live coordinates updating from driver GPS...
              </p>
            </div>

            <div className="mb-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Co-Riders</h4>
              <div className="flex flex-wrap gap-2">
                {trackingBookings.map((b) => (
                  <span
                    key={b.id}
                    className={`text-[10px] font-bold px-2 py-1 rounded shadow-sm flex items-center gap-1 ${
                      b.id === activeBooking.id
                        ? "bg-slate-800 text-white"
                        : b.passengerGender === "Male"
                        ? "bg-blue-50 text-blue-800 border border-blue-200"
                        : "bg-pink-50 text-pink-800 border border-pink-200"
                    }`}
                  >
                    {b.id === activeBooking.id ? "You" : b.passengerName.split(" ")[0]}
                    <span>{b.passengerGender === "Male" ? "♂️" : "♀️"}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleCancel}
            className="w-full bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold py-2.5 rounded-xl transition duration-150 flex items-center justify-center gap-1.5 shadow-sm text-sm"
          >
            <XCircle size={16} /> Cancel My Booking
          </button>
        </div>

        {/* Right pane: Map */}
        <div className="flex-1 h-[60vh] md:h-full relative">
          <Map
            stops={stops}
            drivers={drivers}
            activeDriverId={activeBooking.driverId}
            pickupStopId={activeBooking.pickupStopId}
            dropStopId={activeBooking.dropStopId}
            olaMapsApiKey={config.olaMapsApiKey}
          />
        </div>
      </div>
    );
  }

  // Ride Booking Setup Screen
  return (
    <div className="flex flex-col h-full bg-slate-50 md:flex-row overflow-hidden">
      {/* Left panel: Form Controls */}
      <div className="w-full md:w-[420px] bg-white shadow-md overflow-y-auto border-r border-slate-200 p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-1">
            🛺 Book a Shared Auto
          </h2>
          <p className="text-xs text-slate-500 font-medium">Select stops, check co-riders, and book instantly</p>
        </div>

        {/* 1. Stop Selector */}
        <div className="space-y-3 bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-emerald-500 shrink-0" />
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pickup Stop</label>
              <select
                value={pickupStopId}
                onChange={(e) => setPickupStopId(e.target.value)}
                className="w-full bg-white border border-slate-300 text-sm font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">Choose Pickup Stop</option>
                {stops.map((stop) => (
                  <option key={stop.id} value={stop.id} disabled={stop.id === dropStopId}>
                    {stop.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-rose-500 shrink-0" />
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Drop Stop</label>
              <select
                value={dropStopId}
                onChange={(e) => setDropStopId(e.target.value)}
                className="w-full bg-white border border-slate-300 text-sm font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">Choose Drop Stop</option>
                {stops.map((stop) => (
                  <option key={stop.id} value={stop.id} disabled={stop.id === pickupStopId}>
                    {stop.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 2. Vehicle Selector */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Select Vehicle Capacity</label>
          <div className="grid grid-cols-2 gap-2">
            {["5-seater", "9-seater"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setVehicleType(type)}
                className={`py-2 rounded-xl text-xs font-extrabold border-2 transition-all ${
                  vehicleType === type
                    ? "bg-amber-400 border-amber-600 text-slate-900 shadow"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {type === "5-seater" ? "🛺 5-Seater" : "🚐 9-Seater"}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Fare Display */}
        {pickupStopId && dropStopId && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex justify-between items-center shadow-sm">
            <div>
              <span className="block text-[10px] font-bold text-amber-800 uppercase tracking-wider">Per-Hop Fare Route</span>
              <span className="text-xs text-amber-700 font-semibold">{hops} {hops === 1 ? "stop-hop" : "stop-hops"}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-800">
              <CreditCard size={16} className="text-amber-600" />
              <span className="text-lg font-black tracking-tight">₹{fare}</span>
            </div>
          </div>
        )}

        {/* 4. Active Driver Picker & Seat Selection */}
        {pickupStopId && dropStopId && (
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Choose Available Ride</label>
              {availableDrivers.length === 0 ? (
                <div className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-slate-500 font-medium">
                  No active/verified {vehicleType} autos online. Toggle a driver online in the Driver Portal to test!
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                  {availableDrivers.map((driver) => {
                    const currentDriverBookings = bookings.filter(b => b.driverId === driver.id && b.status === "active");
                    const seatsLeft = maxSeats - currentDriverBookings.length;
                    
                    return (
                      <button
                        key={driver.id}
                        type="button"
                        onClick={() => {
                          setSelectedDriverId(driver.id);
                          setSelectedSeatIndex(null);
                        }}
                        className={`w-full border-2 rounded-xl p-3 text-left transition-all flex justify-between items-center ${
                          selectedDriverId === driver.id
                            ? "bg-slate-900 border-slate-900 text-white shadow-md scale-[1.01]"
                            : "bg-white border-slate-200 text-slate-800 hover:border-slate-300"
                        }`}
                      >
                        <div>
                          <h4 className="text-xs font-black">{driver.name}</h4>
                          <span className={`text-[10px] font-semibold ${selectedDriverId === driver.id ? "text-slate-300" : "text-slate-500"}`}>
                            {driver.autoNumber}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            seatsLeft === 0 
                              ? "bg-rose-100 text-rose-800" 
                              : selectedDriverId === driver.id 
                              ? "bg-amber-400 text-slate-900" 
                              : "bg-emerald-100 text-emerald-800"
                          }`}>
                            {seatsLeft === 0 ? "Full" : `${seatsLeft} left`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedDriver && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Gender Balance & Composition</span>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-1.5">
                      <span className="block text-[9px] font-bold text-blue-500 uppercase">Males Booked</span>
                      <span className="text-sm font-black text-blue-900 flex items-center justify-center gap-0.5">
                        <Users size={12} /> {maleCount}
                      </span>
                    </div>
                    <div className="bg-pink-50 border border-pink-200 rounded-lg p-1.5">
                      <span className="block text-[9px] font-bold text-pink-500 uppercase">Females Booked</span>
                      <span className="text-sm font-black text-pink-900 flex items-center justify-center gap-0.5">
                        <Users size={12} /> {femaleCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Seat Map */}
                <SeatMap
                  vehicleType={vehicleType}
                  bookings={driverBookings}
                  selectedSeatIndex={selectedSeatIndex}
                  onSeatSelect={(idx) => setSelectedSeatIndex(idx)}
                />

                {/* Confirm Book Form */}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center text-xs text-slate-500 font-medium px-1">
                    <span>Passenger: <span className="font-bold text-slate-700">{activeUser.name}</span></span>
                    <span>Gender: <span className="font-bold text-slate-700">{activeUser.gender}</span></span>
                  </div>
                  <button
                    type="button"
                    onClick={handleBook}
                    disabled={selectedSeatIndex === null}
                    className="w-full bg-slate-900 text-white disabled:bg-slate-200 disabled:text-slate-400 font-extrabold py-3 rounded-xl shadow transition duration-150 hover:bg-slate-800 text-xs flex items-center justify-center gap-1.5 uppercase"
                  >
                    Confirm Booking: Book my Share Auto
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right panel: Static Map */}
      <div className="flex-1 h-[40vh] md:h-full">
        <Map
          stops={stops}
          drivers={drivers}
          pickupStopId={pickupStopId}
          dropStopId={dropStopId}
          olaMapsApiKey={config.olaMapsApiKey}
        />
      </div>
    </div>
  );
}
