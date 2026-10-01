import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

export default function Settings() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/admin/settings');
      setSettings(response.data?.data?.settings || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load system settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const editValue = async (setting) => {
    let value = setting.value;
    if (setting.type === 'boolean') {
      value = !setting.value;
    } else {
      const entered = window.prompt(`New value for ${setting.key}`, typeof value === 'string' ? value : JSON.stringify(value));
      if (entered === null) return;
      try {
        value = setting.type === 'number' ? Number(entered) : setting.type === 'json' ? JSON.parse(entered) : entered;
      } catch {
        setError('Enter a valid value for this setting.');
        return;
      }
      if (setting.type === 'number' && !Number.isFinite(value)) {
        setError('Enter a finite number.');
        return;
      }
    }
    setError('');
    try {
      await api.put(`/admin/settings/${encodeURIComponent(setting.key)}`, {
        key: setting.key,
        value,
        type: setting.type,
        category: setting.category,
        description: setting.description || ''
      });
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update setting.');
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">System Settings</h2>
      <p>Public client configuration is served by <code>GET /api/config/public</code>.</p>
      {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
      {loading ? <p role="status">Loading settings…</p> : settings.length === 0 ? <p>No settings found.</p> : (
        <div className="table-container">
          <table>
            <thead><tr><th>Key</th><th>Value</th><th>Type</th><th>Category</th><th>Active</th><th>Action</th></tr></thead>
            <tbody>{settings.map((setting) => (
              <tr key={setting._id}>
                <td>{setting.key}</td>
                <td>{typeof setting.value === 'object' ? JSON.stringify(setting.value) : String(setting.value)}</td>
                <td>{setting.type}</td>
                <td>{setting.category}</td>
                <td>{setting.isActive ? 'Yes' : 'No'}</td>
                <td><button type="button" className="btn" onClick={() => editValue(setting)}>Edit value</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}