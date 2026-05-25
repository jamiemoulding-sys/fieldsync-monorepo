
import React, { useState } from 'react';
import BackButton from '../components/BackButton';
import { locationAPI } from '../services/api';

function AddLocation() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [radius, setRadius] = useState(100);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name || !address) {
      alert('Fill all fields');
      return;
    }

    setLoading(true);

    try {
      // 🌍 Convert address → lat/lng
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${address}`
      );

      const geoData = await geoRes.json();

      if (!geoData.length) {
        alert('Address not found');
        setLoading(false);
        return;
      }

      const { lat, lon } = geoData[0];

      await locationAPI.create({
        name,
        address,
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        radius
      });

      alert('Location added!');
      setName('');
      setAddress('');
      setRadius(100);

    } catch (err) {
      console.error(err);
      alert('Failed to add location');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-md mx-auto space-y-6">

        <BackButton />

        <h1 className="text-2xl font-bold">Add Location</h1>

        <input
          placeholder="Location Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-3 rounded bg-gray-800"
        />

        <input
          placeholder="Address (e.g. Tesco Norwich)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full p-3 rounded bg-gray-800"
        />

        <input
          type="number"
          placeholder="Radius (meters)"
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          className="w-full p-3 rounded bg-gray-800"
        />

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-blue-600 py-3 rounded hover:bg-blue-700"
        >
          {loading ? 'Adding...' : 'Add Location'}
        </button>

      </div>
    </div>
  );
}


export default AddLocation;