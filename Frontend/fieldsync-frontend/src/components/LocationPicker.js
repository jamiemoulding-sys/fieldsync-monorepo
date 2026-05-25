/* =========================================================
src/components/LocationPicker.js
FULL COPY / PASTE FILE

FIXES:
✅ Search postcode
✅ Drag marker after search
✅ Click map to move marker
✅ Marker never locks
✅ Radius updates live
✅ Existing saved marker loads
========================================================= */

import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";

import { useState, useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* ========================================================= */

function Recenter({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(
        [position.lat, position.lng],
        map.getZoom(),
        { duration: 0.8 }
      );
    }
  }, [position, map]);

  return null;
}

function ClickMove({
  setPosition,
}) {
  useMapEvents({
    click(e) {
      setPosition({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      });
    },
  });

  return null;
}

/* ========================================================= */

export default function LocationPicker({
  position,
  setPosition,
  radius = 100,
  onSelectAddress,
}) {
  const [query, setQuery] =
    useState("");

  const [results, setResults] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const search =
    async () => {
      if (!query.trim()) return;

      try {
        setLoading(true);

        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=gb&q=${encodeURIComponent(
            query
          )}`
        );

        const data =
          await res.json();

        setResults(
          Array.isArray(data)
            ? data
            : []
        );
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

  const chooseResult = (
    item
  ) => {
    const next = {
      lat: Number(item.lat),
      lng: Number(item.lon),
    };

    setPosition(next);

    if (onSelectAddress) {
      onSelectAddress(
        item.display_name
      );
    }

    setResults([]);
  };

  const dragEvents = {
    dragend(e) {
      const p =
        e.target.getLatLng();

      setPosition({
        lat: p.lat,
        lng: p.lng,
      });
    },
  };

  return (
    <div className="space-y-4">

      <div className="grid grid-cols-4 gap-2">
        <input
          value={query}
          onChange={(e) =>
            setQuery(
              e.target.value
            )
          }
          placeholder="Postcode or address"
          className="col-span-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3"
        />

        <button
          type="button"
          onClick={search}
          className="bg-indigo-600 hover:bg-indigo-500 rounded-xl"
        >
          Search
        </button>
      </div>

      {loading && (
        <div className="text-sm text-gray-400">
          Searching...
        </div>
      )}

      {results.length > 0 && (
        <div className="max-h-56 overflow-y-auto border border-white/10 rounded-xl divide-y divide-white/5">
          {results.map(
            (
              item,
              i
            ) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  chooseResult(
                    item
                  )
                }
                className="w-full text-left px-4 py-3 hover:bg-white/5 text-sm"
              >
                {
                  item.display_name
                }
              </button>
            )
          )}
        </div>
      )}

      <div className="text-xs text-gray-400">
        Search postcode, then drag pin to exact entrance.
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">

        <MapContainer
          center={
            position
              ? [
                  position.lat,
                  position.lng,
                ]
              : [
                  51.8787,
                  0.5529,
                ]
          }
          zoom={16}
          className="h-[360px] w-full"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <ClickMove
            setPosition={
              setPosition
            }
          />

          {position && (
            <>
              <Marker
                position={[
                  position.lat,
                  position.lng,
                ]}
                draggable={
                  true
                }
                eventHandlers={
                  dragEvents
                }
              />

              <Circle
                center={[
                  position.lat,
                  position.lng,
                ]}
                radius={
                  Number(
                    radius
                  ) || 100
                }
                pathOptions={{
                  color:
                    "#6366f1",
                  fillColor:
                    "#6366f1",
                  fillOpacity: 0.15,
                }}
              />
            </>
          )}

          <Recenter
            position={
              position
            }
          />
        </MapContainer>
      </div>

      {position && (
        <div className="text-xs text-indigo-300">
          {position.lat.toFixed(
            6
          )}{" "}
          ,{" "}
          {position.lng.toFixed(
            6
          )}
        </div>
      )}
    </div>
  );
}