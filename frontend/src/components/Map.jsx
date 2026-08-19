import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function Map({
  stops = [],
  drivers = [],
  activeDriverId = null,
  pickupStopId = null,
  dropStopId = null,
  passengerLocation = null,
  onMapClick = null,
  olaMapsApiKey = ""
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({ stops: {}, drivers: {}, path: null, passenger: null });

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Default to Hyderabad center
    const defaultCenter = [17.463, 78.34];
    const defaultZoom = 13;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true
    }).setView(defaultCenter, defaultZoom);

    mapRef.current = map;

    // Setup map click handler
    if (onMapClick) {
      map.on("click", (e) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [onMapClick]);

  // Handle Tile Layer Updates (OSM vs Ola Maps API)
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing tile layers
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        mapRef.current.removeLayer(layer);
      }
    });

    let tileLayerUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    let attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    if (olaMapsApiKey && olaMapsApiKey.trim() !== "") {
      tileLayerUrl = `https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/{z}/{x}/{y}.png?api_key=${olaMapsApiKey}`;
      attribution = "&copy; Ola Maps";
    }

    L.tileLayer(tileLayerUrl, {
      attribution,
      maxZoom: 19
    }).addTo(mapRef.current);
  }, [olaMapsApiKey]);

  // Update Markers and Elements on Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers = markersRef.current;

    // 1. Clear old stops
    Object.values(markers.stops).forEach(marker => map.removeLayer(marker));
    markers.stops = {};

    // 2. Clear old path
    if (markers.path) {
      map.removeLayer(markers.path);
      markers.path = null;
    }

    // 3. Clear old passenger marker
    if (markers.passenger) {
      map.removeLayer(markers.passenger);
      markers.passenger = null;
    }

    // 4. Draw Stops
    const stopLatLngs = [];
    stops.forEach((stop, index) => {
      const isPickup = stop.id === pickupStopId;
      const isDrop = stop.id === dropStopId;
      
      let stopColorClass = "bg-blue-600 ring-blue-300";
      let label = `${index + 1}`;
      if (isPickup) {
        stopColorClass = "bg-emerald-600 ring-emerald-300 scale-125";
        label = "🟢";
      } else if (isDrop) {
        stopColorClass = "bg-rose-600 ring-rose-300 scale-125";
        label = "🔴";
      }

      const stopHtml = `
        <div class="flex flex-col items-center justify-center">
          <div class="w-6 h-6 rounded-full ${stopColorClass} border-2 border-white flex items-center justify-center text-white text-xs font-black shadow-md ring-2">
            ${label}
          </div>
          <div class="bg-white/95 px-1.5 py-0.5 rounded shadow text-[10px] font-bold text-slate-800 border border-slate-200 mt-0.5 whitespace-nowrap">
            ${stop.name}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: "custom-div-icon",
        html: stopHtml,
        iconSize: [60, 45],
        iconAnchor: [30, 12]
      });

      const marker = L.marker([stop.lat, stop.lng], { icon: customIcon }).addTo(map);
      marker.bindPopup(`<b>Stop #${index + 1}: ${stop.name}</b>`);
      markers.stops[stop.id] = marker;
      stopLatLngs.push([stop.lat, stop.lng]);
    });

    // 5. Draw path line representing the route
    if (stopLatLngs.length > 1) {
      markers.path = L.polyline(stopLatLngs, {
        color: "#64748b",
        weight: 3,
        dashArray: "6, 6",
        opacity: 0.8
      }).addTo(map);
    }

    // 6. Draw passenger location if available
    if (passengerLocation) {
      const passengerHtml = `
        <div class="flex flex-col items-center">
          <div class="w-6 h-6 rounded-full bg-violet-600 border-2 border-white flex items-center justify-center text-white shadow-md animate-bounce">
            🚶
          </div>
          <span class="bg-violet-100 text-violet-800 text-[9px] font-bold px-1 rounded shadow-sm">You</span>
        </div>
      `;
      const passengerIcon = L.divIcon({
        className: "custom-div-icon",
        html: passengerHtml,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
      markers.passenger = L.marker([passengerLocation.lat, passengerLocation.lng], { icon: passengerIcon }).addTo(map);
    }

    // 7. Update Drivers
    // Clear old driver markers not in list or if we're filtering for a specific active driver
    const driverIdsToDraw = activeDriverId 
      ? [activeDriverId] 
      : drivers.map(d => d.id);

    Object.keys(markers.drivers).forEach(id => {
      if (!driverIdsToDraw.includes(id)) {
        map.removeLayer(markers.drivers[id]);
        delete markers.drivers[id];
      }
    });

    drivers.forEach((driver) => {
      // Skip if activeDriverId filtering is active and this is not the active driver
      if (activeDriverId && driver.id !== activeDriverId) return;

      const driverInfo = stops.find(s => s.id === driver.currentStopId);
      const stopLabel = driverInfo ? `Near ${driverInfo.name}` : "En Route";

      const driverHtml = `
        <div class="flex flex-col items-center">
          <div class="w-10 h-10 bg-amber-400 border-2 border-slate-900 rounded-full flex items-center justify-center text-xl shadow-lg ring-4 ring-amber-300">
            🛺
          </div>
          <div class="bg-amber-900 text-white text-[9px] px-1 rounded font-bold shadow-md -mt-1 uppercase max-w-[80px] overflow-hidden text-ellipsis whitespace-nowrap">
            ${driver.name}
          </div>
        </div>
      `;

      const driverIcon = L.divIcon({
        className: "custom-div-icon",
        html: driverHtml,
        iconSize: [50, 50],
        iconAnchor: [25, 25]
      });

      if (markers.drivers[driver.id]) {
        // Update existing marker position
        markers.drivers[driver.id].setLatLng([driver.currentLat, driver.currentLng]);
      } else {
        // Create new marker
        const marker = L.marker([driver.currentLat, driver.currentLng], { icon: driverIcon }).addTo(map);
        marker.bindPopup(`
          <div class="text-xs">
            <h4 class="font-bold text-slate-800">${driver.name}</h4>
            <p class="text-slate-600">${driver.autoNumber} (${driver.vehicleType})</p>
            <p class="text-indigo-600 font-semibold mt-1">${stopLabel}</p>
          </div>
        `);
        markers.drivers[driver.id] = marker;
      }
    });

    // 8. Auto-fit bounds if we have stops or active driver
    if (stopLatLngs.length > 0) {
      const bounds = L.latLngBounds(stopLatLngs);
      
      // Include passenger and active drivers in bounds if present
      if (passengerLocation) bounds.extend([passengerLocation.lat, passengerLocation.lng]);
      drivers.forEach(d => {
        if (!activeDriverId || d.id === activeDriverId) {
          bounds.extend([d.currentLat, d.currentLng]);
        }
      });

      map.fitBounds(bounds, { padding: [40, 40] });
    }

  }, [stops, drivers, activeDriverId, pickupStopId, dropStopId, passengerLocation]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-200 shadow-inner">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      {olaMapsApiKey && (
        <div className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-[9px] px-1.5 py-0.5 rounded backdrop-blur-sm z-[1000]">
          Ola Maps Active
        </div>
      )}
    </div>
  );
}
