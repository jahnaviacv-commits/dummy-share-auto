import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "database.json");

// Express App Setup
const app = express();
app.use(cors());
app.use(express.json());

// Helper functions for DB reading/writing
const readDB = () => {
  try {
    const data = fs.readFileSync(dbPath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading database:", err);
    return { stops: [], drivers: [], bookings: [], admins: [], config: { perStopFare: 20, olaMapsApiKey: "" } };
  }
};

const writeDB = (data) => {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing database:", err);
  }
};

// --- HTTP Endpoints ---

// Get all state
app.get("/api/data", (req, res) => {
  res.json(readDB());
});

// Book a seat
app.post("/api/bookings", (req, res) => {
  const { driverId, seatIndex, passengerName, passengerGender, pickupStopId, dropStopId } = req.body;

  if (!driverId || seatIndex === undefined || !passengerName || !passengerGender || !pickupStopId || !dropStopId) {
    return res.status(400).json({ error: "Missing required fields for booking." });
  }

  const db = readDB();
  const driver = db.drivers.find(d => d.id === driverId);
  if (!driver) {
    return res.status(404).json({ error: "Driver not found." });
  }

  // Check if seat is already taken
  const isSeatTaken = db.bookings.some(b => b.driverId === driverId && b.seatIndex === seatIndex && b.status === "active");
  if (isSeatTaken) {
    return res.status(400).json({ error: "Seat is already booked." });
  }

  // Generate Booking ID
  const newBooking = {
    id: `booking-${Date.now()}`,
    driverId,
    seatIndex,
    passengerName,
    passengerGender,
    pickupStopId,
    dropStopId,
    status: "active",
    bookedAt: new Date().toISOString()
  };

  db.bookings.push(newBooking);
  writeDB(db);

  // Broadcast update to all connected clients
  broadcast({
    type: "booking_update",
    bookings: db.bookings
  });

  res.status(201).json(newBooking);
});

// Cancel a booking
app.post("/api/bookings/cancel", (req, res) => {
  const { bookingId } = req.body;
  if (!bookingId) {
    return res.status(400).json({ error: "Missing bookingId." });
  }

  const db = readDB();
  const booking = db.bookings.find(b => b.id === bookingId);
  if (!booking) {
    return res.status(404).json({ error: "Booking not found." });
  }

  booking.status = "cancelled";
  writeDB(db);

  broadcast({
    type: "booking_update",
    bookings: db.bookings
  });

  res.json({ message: "Booking cancelled successfully.", booking });
});

// Register or update driver profile (Admin / Driver Portal)
app.post("/api/drivers/register", (req, res) => {
  const { id, name, phone, autoNumber, vehicleType, currentStopId } = req.body;

  if (!name || !phone || !autoNumber || !vehicleType) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const db = readDB();
  let driver = db.drivers.find(d => d.phone === phone || (id && d.id === id));

  if (driver) {
    // Update
    driver.name = name;
    driver.autoNumber = autoNumber;
    driver.vehicleType = vehicleType;
    if (currentStopId) {
      driver.currentStopId = currentStopId;
      const stop = db.stops.find(s => s.id === currentStopId);
      if (stop) {
        driver.currentLat = stop.lat;
        driver.currentLng = stop.lng;
      }
    }
  } else {
    // Create new
    const defaultStop = db.stops[0];
    driver = {
      id: id || `driver-${Date.now()}`,
      name,
      phone,
      autoNumber,
      vehicleType,
      currentLat: defaultStop ? defaultStop.lat : 17.4837,
      currentLng: defaultStop ? defaultStop.lng : 78.3158,
      currentStopId: defaultStop ? defaultStop.id : "stop-1",
      status: "active",
      isVerified: false // Default to unverified, needs Admin approval
    };
    db.drivers.push(driver);
  }

  writeDB(db);

  broadcast({
    type: "driver_update",
    drivers: db.drivers
  });

  res.status(200).json(driver);
});

// Update driver details (Admin toggle verification/delete)
app.post("/api/admin/drivers/action", (req, res) => {
  const { driverId, action } = req.body; // action: 'verify' | 'delete'
  if (!driverId || !action) {
    return res.status(400).json({ error: "Missing details." });
  }

  const db = readDB();
  if (action === "verify") {
    const driver = db.drivers.find(d => d.id === driverId);
    if (driver) driver.isVerified = true;
  } else if (action === "delete") {
    db.drivers = db.drivers.filter(d => d.id !== driverId);
    // Also cancel bookings
    db.bookings = db.bookings.map(b => b.driverId === driverId ? { ...b, status: "cancelled" } : b);
  }

  writeDB(db);

  broadcast({
    type: "driver_update",
    drivers: db.drivers
  });
  broadcast({
    type: "booking_update",
    bookings: db.bookings
  });

  res.json({ success: true });
});

// Update Admin settings / Stops / Config
app.post("/api/admin/config", (req, res) => {
  const { perStopFare, olaMapsApiKey } = req.body;
  const db = readDB();

  if (perStopFare !== undefined) db.config.perStopFare = Number(perStopFare);
  if (olaMapsApiKey !== undefined) db.config.olaMapsApiKey = olaMapsApiKey;

  writeDB(db);
  res.json({ message: "Config updated.", config: db.config });
});

app.post("/api/admin/stops", (req, res) => {
  const { action, stop } = req.body; // action: 'add' | 'delete'
  const db = readDB();

  if (action === "add") {
    const newStop = {
      id: stop.id || `stop-${Date.now()}`,
      name: stop.name,
      lat: Number(stop.lat),
      lng: Number(stop.lng)
    };
    db.stops.push(newStop);
  } else if (action === "delete") {
    db.stops = db.stops.filter(s => s.id !== stop.id);
  }

  writeDB(db);
  broadcast({
    type: "stops_update",
    stops: db.stops
  });

  res.json({ stops: db.stops });
});

// Serve static assets from frontend/dist
const frontendDistPath = path.join(__dirname, "../frontend/dist");
app.use(express.static(frontendDistPath));

// For SPA routing, redirect all non-API paths to index.html
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(frontendDistPath, "index.html"));
});

// --- WebSocket Setup ---
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Map to track active client connections
const clients = new Map(); // ws -> { role, driverId }

wss.on("connection", (ws) => {
  console.log("Client connected via WebSocket");

  ws.on("message", (messageStr) => {
    try {
      const message = JSON.parse(messageStr);
      
      switch (message.type) {
        case "subscribe":
          clients.set(ws, { role: message.role, driverId: message.driverId });
          console.log(`Client subscribed as ${message.role} for driver ${message.driverId}`);
          break;

        case "location_update":
          // Driver reporting coordinates
          const { driverId, lat, lng, currentStopId } = message;
          if (driverId) {
            const db = readDB();
            const driver = db.drivers.find(d => d.id === driverId);
            if (driver) {
              driver.currentLat = lat;
              driver.currentLng = lng;
              if (currentStopId) driver.currentStopId = currentStopId;
              writeDB(db);

              // Broadcast this location update to all passengers subscribed to this driver, and all admins
              broadcastToSubscribers(driverId, {
                type: "driver_location",
                driverId,
                lat,
                lng,
                currentStopId
              });
            }
          }
          break;

        default:
          console.log("Unknown message type received:", message.type);
      }
    } catch (err) {
      console.error("Error parsing WebSocket message:", err);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log("Client disconnected");
  });
});

// Broadcast to ALL connected clients
function broadcast(data) {
  const payload = JSON.stringify(data);
  for (const [ws] of clients.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

// Broadcast specifically to clients subscribed to a driver (or admins)
function broadcastToSubscribers(driverId, data) {
  const payload = JSON.stringify(data);
  for (const [ws, info] of clients.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      // Send to matching passengers, or anyone with Admin role
      if ((info.role === "passenger" && info.driverId === driverId) || info.role === "admin") {
        ws.send(payload);
      }
    }
  }
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Share Auto backend running on HTTP/WS port ${PORT}`);
});
