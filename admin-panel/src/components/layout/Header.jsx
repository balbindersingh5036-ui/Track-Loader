import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import { Bell, Search, User } from 'lucide-react';
import api from '../../services/api';

export default function Header() {
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Fetch unread notifications count
    api.get('/notifications/unread-count')
      .then(res => setUnreadCount(res.data.data.count || 0))
      .catch(err => console.error(err));
  }, []);

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f5', padding: '8px 16px', borderRadius: '8px', width: '300px' }}>
        <Search size={18} color="var(--text-secondary)" style={{ marginRight: '8px' }} />
        <input type="text" placeholder="Search..." style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0 }} />
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ position: 'relative', cursor: 'pointer' }}>
          <Bell size={24} color="var(--text-secondary)" />
          {unreadCount > 0 && (
            <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'var(--danger)', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '10px', fontWeight: 'bold' }}>
              {unreadCount}
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>{user?.name || 'Admin User'}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{user?.role === 'admin' ? 'Super Admin' : user?.role}</div>
          </div>
          <button onClick={handleLogout} className="btn" style={{ marginLeft: '16px', border: '1px solid var(--border-color)' }}>Logout</button>
        </div>
      </div>
    </header>
  );
}