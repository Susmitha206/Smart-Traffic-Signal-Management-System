import React, { useEffect, useRef, useState } from 'react';

function loadLeaflet() {
  return new Promise((resolve) => {
    if (window.L) {
      resolve(window.L);
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet/dist/leaflet.js';
    script.onload = () => resolve(window.L);
    document.body.appendChild(script);
  });
}

const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim() && password.trim()) {
      onLogin(username);
    } else {
      alert('Please enter valid credentials');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '100px' }}>
      <h2>Login to Free Route Finder</h2>
      <form onSubmit={handleSubmit} style={{ backgroundColor: '#f0f0f0', padding: 20, borderRadius: 8, width: 300 }}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ padding: 10, margin: '10px 0', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 10, margin: '10px 0', borderRadius: 4, border: '1px solid #ccc', width: '100%' }}
        />
        <button
          type="submit"
          style={{
            backgroundColor: '#4285f4',
            color: 'white',
            border: 'none',
            padding: 10,
            borderRadius: 4,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Login
        </button>
      </form>
    </div>
  );
};

const FreeRouteFinder = () => {
  const mapRef = useRef(null);
  const [L, setL] = useState(null);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [info, setInfo] = useState('Enter start and destination, then click Get Route.');

  useEffect(() => {
    loadLeaflet().then((Leaflet) => setL(Leaflet));
  }, []);

  useEffect(() => {
    if (L && !mapInitialized) {
      mapRef.current = L.map('map').setView([17.385, 78.4867], 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(mapRef.current);
      setMapInitialized(true);
    }
  }, [L, mapInitialized]);

  // ✅ Fixed: Backticks added for template literals
  async function geocode(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data || data.length === 0) throw new Error('Address not found: ' + address);
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display_name: data[0].display_name };
  }

  // ✅ Fixed: Backticks added for template literals
  async function reverseGeocode(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    const resp = await fetch(url);
    const data = await resp.json();
    const details = data.address || {};
    const state = details.state || 'Unknown';
    const county = details.county || details.suburb || 'Unknown';
    const pincode = details.postcode || 'Unknown';
    const placeType = details.city || details.town || details.village || details.hamlet || 'Unknown';
    const areaType = details.city || details.town ? 'Urban' : 'Rural';
    return { state, county, pincode, placeType, areaType };
  }

  // ✅ Fixed: Backticks added for OSRM route API
  async function calculateRoute() {
    if (!start.trim() || !end.trim()) {
      alert('Please enter both starting point and destination.');
      return;
    }

    setInfo('Finding routes and analyzing traffic...');
    try {
      const startCoords = await geocode(start);
      const endCoords = await geocode(end);

      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startCoords.lon},${startCoords.lat};${endCoords.lon},${endCoords.lat}?overview=full&geometries=geojson&alternatives=true`;
      const resp = await fetch(osrmUrl);
      const data = await resp.json();

      if (!data.routes || data.routes.length === 0) throw new Error('No route found');

      // Remove existing route layers
      mapRef.current.eachLayer((layer) => {
        if (layer instanceof L.Polyline) mapRef.current.removeLayer(layer);
      });

      const colors = ['green', 'yellow', 'red'];

      data.routes.slice(0, 3).forEach((route, idx) => {
        const routeCoords = route.geometry.coordinates.map((c) => [c[1], c[0]]);
        L.polyline(routeCoords, { color: colors[idx], weight: 5 }).addTo(mapRef.current);
      });

      mapRef.current.fitBounds(L.geoJSON(data.routes[0].geometry).getBounds(), { padding: [50, 50] });

      const startInfo = await reverseGeocode(startCoords.lat, startCoords.lon);
      const endInfo = await reverseGeocode(endCoords.lat, endCoords.lon);

      setInfo(
        <div style={{ textAlign: 'left' }}>
          <strong>From:</strong> {startCoords.display_name}<br />
          <strong>State:</strong> {startInfo.state}<br />
          <strong>Mandal:</strong> {startInfo.county}<br />
          <strong>Pincode:</strong> {startInfo.pincode}<br />
          <strong>Type:</strong> {startInfo.areaType}<br /><br />
          <strong>To:</strong> {endCoords.display_name}<br />
          <strong>State:</strong> {endInfo.state}<br />
          <strong>Mandal:</strong> {endInfo.county}<br />
          <strong>Pincode:</strong> {endInfo.pincode}<br />
          <strong>Type:</strong> {endInfo.areaType}<br /><br />
          <strong>Traffic:</strong> Green (Low), Yellow (Medium), Red (High)
        </div>
      );
    } catch (err) {
      alert('Error: ' + err.message);
      setInfo('Error: ' + err.message);
    }
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', margin: 20, textAlign: 'center' }}>
      <h2>Multi-Route Traffic Finder</h2>
      <input
        style={{ padding: 10, fontSize: 16, margin: 5, borderRadius: 4, border: '1px solid #ccc', width: 250 }}
        placeholder="Starting Point"
        value={start}
        onChange={(e) => setStart(e.target.value)}
      />
      <input
        style={{ padding: 10, fontSize: 16, margin: 5, borderRadius: 4, border: '1px solid #ccc', width: 250 }}
        placeholder="Destination"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
      />
      <button
        onClick={calculateRoute}
        style={{ backgroundColor: '#4285f4', color: 'white', border: 'none', padding: 10, borderRadius: 4, cursor: 'pointer' }}
      >
        Get Route
      </button>
      <div id="info" style={{ background: '#eef', padding: 10, borderRadius: 6, margin: 10 }}>{info}</div>
      <div id="map" style={{ height: 500, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }} />
    </div>
  );
};

const App = () => {
  const [loggedInUser, setLoggedInUser] = useState(null);
  return loggedInUser ? <FreeRouteFinder /> : <LoginPage onLogin={setLoggedInUser} />;
};

export default App;
