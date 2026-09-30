import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/settings')
      .then(res => setSettings(res.data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading settings...</div>;

  return (
    <div className="card">
      <h2 className="card-title">System Settings</h2>
      {settings ? (
        <pre>{JSON.stringify(settings, null, 2)}</pre>
      ) : (
        <p>No configuration found.</p>
      )}
    </div>
  );
}