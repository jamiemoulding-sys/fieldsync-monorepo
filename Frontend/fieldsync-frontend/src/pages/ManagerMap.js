
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { managerAPI } from '../services/api';
import BackButton from '../components/BackButton';
import L from 'leaflet';

// ✅ Fix missing marker icons
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl:
    'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

function ManagerMap() {
  const [workers, setWorkers] = useState([]);

  useEffect(() => {
    loadWorkers();

    const interval = setInterval(() => {
      loadWorkers();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadWorkers = async () => {
    try {
      const res = await managerAPI.getActiveShifts();
      setWorkers(res.data || []);
    } catch (err) {
      console.error('MAP ERROR:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">

      <BackButton />

      <h1 className="text-2xl font-bold mb-4">Live Staff Map</h1>

      <div className="rounded-xl overflow-hidden">
        <MapContainer
          center={[52.6784, 0.9393]}
          zoom={13}
          style={{ height: '80vh', width: '100%' }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {workers.map(worker => (
  <Marker
    key={worker.id}
    position={[
      worker.latitude || 52.6784,
      worker.longitude || 0.9393
    ]}
  >
    <Popup>
      <strong>{worker.name}</strong>
      <br />
      📍 Live Location
      <br />
      Started: {new Date(worker.clock_in_time).toLocaleTimeString()}
    </Popup>
  </Marker>
))}

        </MapContainer>
      </div>

    </div>
  );
}


export default ManagerMap;