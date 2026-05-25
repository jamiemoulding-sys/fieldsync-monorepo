import { useEffect, useState } from "react";
import { locationAPI } from "../services/api";
import {
  MapPin,
  Navigation,
} from "lucide-react";

export default function MyLocations() {
  const [rows, setRows] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);

      const data =
        await locationAPI.getLocations();

      setRows(
        Array.isArray(data)
          ? data
          : []
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const mapsLink = (
    lat,
    lng
  ) =>
    `https://www.google.com/maps?q=${lat},${lng}`;

  if (loading) {
    return (
      <div className="text-gray-400">
        Loading locations...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-semibold">
          Work Locations
        </h1>

        <p className="text-sm text-gray-400">
          All available job sites
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">

        {rows.map((loc) => (
          <div
            key={loc.id}
            className="rounded-2xl border border-white/10 p-5 bg-[#020617]"
          >
            <div className="flex items-start justify-between gap-3">

              <div>
                <h3 className="font-semibold text-lg">
                  {loc.name}
                </h3>

                <p className="text-sm text-gray-400 mt-2">
                  {loc.address}
                </p>

                <p className="text-xs text-gray-500 mt-3">
                  Radius: {loc.radius}m
                </p>
              </div>

              <MapPin
                size={18}
                className="text-indigo-400"
              />
            </div>

            <a
              href={mapsLink(
                loc.latitude,
                loc.longitude
              )}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500"
            >
              <Navigation size={16} />
              Navigate
            </a>
          </div>
        ))}

      </div>

      {rows.length === 0 && (
        <div className="text-gray-500">
          No locations added
        </div>
      )}

    </div>
  );
}