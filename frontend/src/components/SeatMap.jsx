import React from "react";
import { User, ShieldCheck } from "lucide-react";

export default function SeatMap({
  vehicleType = "5-seater",
  bookings = [],
  selectedSeatIndex = null,
  onSeatSelect = null
}) {
  const isNineSeater = vehicleType === "9-seater";
  const totalSeats = isNineSeater ? 9 : 5;

  // Map seat index to a booking if it exists
  const getBookingForSeat = (seatIndex) => {
    return bookings.find(b => b.seatIndex === seatIndex && b.status === "active");
  };

  // Render a single seat
  const renderSeat = (seatIndex, label) => {
    const booking = getBookingForSeat(seatIndex);
    const isSelected = selectedSeatIndex === seatIndex;
    const isBooked = !!booking;
    const gender = booking?.passengerGender;

    let seatClasses = "w-12 h-12 rounded-lg flex flex-col items-center justify-center text-xs font-semibold shadow transition-all duration-200 border-2 ";
    let seatIcon = <User size={16} className="text-slate-400" />;
    let tooltip = `Seat ${label} (Available)`;

    if (isBooked) {
      if (gender === "Male") {
        seatClasses += "bg-blue-100 border-blue-400 text-blue-800 cursor-not-allowed";
        seatIcon = <span className="font-extrabold text-sm text-blue-600">♂️</span>;
      } else {
        seatClasses += "bg-pink-100 border-pink-400 text-pink-800 cursor-not-allowed";
        seatIcon = <span className="font-extrabold text-sm text-pink-600">♀️</span>;
      }
      tooltip = `${booking.passengerName} (${gender}) - booked from ${booking.pickupStopId} to ${booking.dropStopId}`;
    } else if (isSelected) {
      seatClasses += "bg-amber-400 border-amber-600 text-slate-900 ring-2 ring-amber-300 transform scale-105 cursor-pointer";
      seatIcon = <User size={16} className="text-slate-900 fill-slate-900" />;
      tooltip = `Seat ${label} (Selected)`;
    } else {
      seatClasses += "bg-white border-slate-300 text-slate-600 hover:border-slate-400 cursor-pointer hover:bg-slate-50";
      tooltip = `Seat ${label} (Available)`;
    }

    return (
      <button
        key={seatIndex}
        type="button"
        disabled={isBooked}
        onClick={() => onSeatSelect && onSeatSelect(seatIndex)}
        className={seatClasses}
        title={tooltip}
      >
        {seatIcon}
        <span className="text-[10px] mt-0.5">{isBooked ? booking.passengerName.split(" ")[0] : label}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col items-center bg-slate-100 p-6 rounded-2xl border border-slate-200 shadow-inner max-w-sm mx-auto">
      <div className="w-full text-center text-xs text-slate-500 font-bold mb-4 uppercase tracking-wider flex items-center justify-center gap-1">
        <ShieldCheck size={14} className="text-emerald-500" /> Auto Cabin Layout ({vehicleType})
      </div>

      {/* Windshield / Front Banner */}
      <div className="w-full h-4 bg-slate-700 rounded-t-xl mb-4 border-b-4 border-slate-800 flex items-center justify-center shadow-md">
        <div className="w-1/3 h-1 bg-sky-200 opacity-60 rounded-full"></div>
      </div>

      {/* Front Row (Driver + Front Passengers) */}
      {!isNineSeater ? (
        /* 5-Seater Front Row: Passenger P1 (Left) | Driver (Center) | Passenger P2 (Right) */
        <div className="grid grid-cols-3 gap-4 w-full mb-6 items-center justify-items-center">
          {renderSeat(0, "P1")}
          
          <div className="w-12 h-12 bg-slate-800 border-2 border-slate-950 text-white rounded-lg flex flex-col items-center justify-center text-[10px] font-bold shadow-md cursor-not-allowed">
            🛺
            <span>Driver</span>
          </div>

          {renderSeat(1, "P2")}
        </div>
      ) : (
        /* 9-Seater Front Row: Driver (Left) | Passenger P1 (Right) + Spacer for grid alignment */
        <div className="grid grid-cols-3 gap-4 w-full mb-6 items-center justify-items-center">
          <div className="w-12 h-12 bg-slate-800 border-2 border-slate-950 text-white rounded-lg flex flex-col items-center justify-center text-[10px] font-bold shadow-md cursor-not-allowed">
            🛺
            <span>Driver</span>
          </div>
          
          {renderSeat(0, "P1")}
          
          <div className="w-12 h-12"></div> {/* empty right column for grid center balance */}
        </div>
      )}

      {/* Partition divider line */}
      <div className="w-full border-t-2 border-dashed border-slate-300 my-2"></div>

      {/* Passenger Cabin Layout */}
      {!isNineSeater ? (
        /* 5-Seater Cabin (Back row of 3 seats: P3, P4, P5) */
        <div className="flex gap-3 justify-center w-full mt-4">
          {renderSeat(2, "P3")}
          {renderSeat(3, "P4")}
          {renderSeat(4, "P5")}
        </div>
      ) : (
        /* 9-Seater Cabin (Rest 8 seats in 4-4 configuration facing each other) */
        <div className="flex flex-col gap-4 w-full mt-2">
          {/* Middle Row (Indices 1, 2, 3, 4 facing backward) */}
          <div className="flex gap-2 justify-center">
            {renderSeat(1, "P2")}
            {renderSeat(2, "P3")}
            {renderSeat(3, "P4")}
            {renderSeat(4, "P5")}
          </div>
          
          <div className="text-[10px] text-slate-400 font-bold text-center my-0.5">
            ◄ Facing Each Other ►
          </div>

          {/* Back Row (Indices 5, 6, 7, 8 facing forward) */}
          <div className="flex gap-2 justify-center">
            {renderSeat(5, "P6")}
            {renderSeat(6, "P7")}
            {renderSeat(7, "P8")}
            {renderSeat(8, "P9")}
          </div>
        </div>
      )}

      {/* Color legend */}
      <div className="flex gap-4 mt-6 text-[10px] font-semibold text-slate-500 border-t border-slate-200 pt-4 w-full justify-center">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-white border border-slate-300 rounded"></div>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
          <span>Male ♂️</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-pink-100 border border-pink-300 rounded"></div>
          <span>Female ♀️</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-amber-400 rounded"></div>
          <span>Selected</span>
        </div>
      </div>
    </div>
  );
}
