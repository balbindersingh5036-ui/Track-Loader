import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

export default function Banners() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentBanner, setCurrentBanner] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '', subtitle: '', ctaText: '', ctaAction: '',
    targetAudience: 'all', sortOrder: 0,
    isActive: true, startDate: '', endDate: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBanner, setPreviewBanner] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await api.get('/banners/admin');
      setBanners(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load banners.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openModal = (banner = null) => {
    setCurrentBanner(banner);
    if (banner) {
      setFormData({
        title: banner.title || '', subtitle: banner.subtitle || '',
        ctaText: banner.ctaText || '', ctaAction: banner.ctaAction || '',
        targetAudience: banner.targetAudience || 'all',
        sortOrder: banner.sortOrder || 0,
        isActive: banner.isActive ?? true,
        startDate: banner.startDate ? new Date(banner.startDate).toISOString().slice(0, 16) : '',
        endDate: banner.endDate ? new Date(banner.endDate).toISOString().slice(0, 16) : ''
      });
      setImagePreview(banner.imageUrl);
    } else {
      setFormData({
        title: '', subtitle: '', ctaText: '', ctaAction: '',
        targetAudience: 'all', sortOrder: 0,
        isActive: true, startDate: '', endDate: ''
      });
      setImagePreview(null);
    }
    setImageFile(null);
    setIsModalOpen(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const saveBanner = async (e) => {
    e.preventDefault();
    try {
      let imageUrl = imagePreview;
      
      // Upload image if selected
      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        const uploadRes = await api.post('/uploads/image', formData);
        imageUrl = uploadRes.data.url;
      }

      if (!imageUrl) {
        alert('Image is required');
        return;
      }

      const payload = {
        ...formData,
        imageUrl,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null
      };

      if (currentBanner) {
        await api.patch(`/banners/${currentBanner._id}`, payload);
      } else {
        await api.post('/banners', payload);
      }
      setIsModalOpen(false);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving banner');
    }
  };

  const toggleStatus = async (banner) => {
    try {
      await api.patch(`/banners/${banner._id}`, { isActive: !banner.isActive });
      load();
    } catch (err) {
      alert('Error updating status');
    }
  };

  const deleteBanner = async (id) => {
    if (!window.confirm('Delete this banner?')) return;
    try {
      await api.delete(`/banners/${id}`);
      load();
    } catch (err) {
      alert('Error deleting banner');
    }
  };

  const reorder = async (banner, dir) => {
    try {
      await api.patch(`/banners/${banner._id}`, { sortOrder: banner.sortOrder + dir });
      load();
    } catch (err) {
      alert('Error reordering');
    }
  };

  const openPreview = (banner) => {
    setPreviewBanner(banner);
    setIsPreviewOpen(true);
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="card-title">Banner Management</h2>
        <button className="btn" style={{ background: 'var(--primary)' }} onClick={() => openModal()}>Add Banner</button>
      </div>

      {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
      
      {loading ? <p>Loading banners...</p> : (
        <div className="table-container" style={{ marginTop: '1rem' }}>
          <table>
            <thead>
              <tr>
                <th>Image</th>
                <th>Title</th>
                <th>Audience</th>

                <th>Status</th>
                <th>Order</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {banners.map(banner => (
                <tr key={banner._id}>
                  <td>
                    <img src={banner.imageUrl} alt="banner" style={{ width: 80, height: 40, objectFit: 'cover', borderRadius: 4 }} />
                  </td>
                  <td>{banner.title}</td>
                  <td style={{ textTransform: 'capitalize' }}>{banner.targetAudience}</td>

                  <td>
                    <span style={{ color: banner.isActive ? 'var(--success)' : 'var(--danger)' }}>
                      {banner.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{banner.sortOrder}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn" onClick={() => openPreview(banner)}>Preview</button>
                      <button className="btn" onClick={() => openModal(banner)}>Edit</button>
                      <button className="btn" onClick={() => toggleStatus(banner)}>{banner.isActive ? 'Deactivate' : 'Activate'}</button>
                      <button className="btn" onClick={() => reorder(banner, -1)}>Up</button>
                      <button className="btn" onClick={() => reorder(banner, 1)}>Down</button>
                      <button className="btn" style={{ background: 'var(--danger)' }} onClick={() => deleteBanner(banner._id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {banners.length === 0 && (
                <tr><td colSpan="7" style={{ textAlign: 'center' }}>No banners found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ADD/EDIT MODAL */}
      {isModalOpen && (
        <div style={modalOverlayStyle}>
          <div className="card" style={modalStyle}>
            <h3>{currentBanner ? 'Edit Banner' : 'Add Banner'}</h3>
            <form onSubmit={saveBanner} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label>Banner Image (required)</label>
                <input type="file" accept="image/*" onChange={handleImageChange} />
                {imagePreview && <img src={imagePreview} alt="preview" style={{ width: '100%', height: 120, objectFit: 'cover', marginTop: '0.5rem' }} />}
              </div>
              <input placeholder="Title" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
              <input placeholder="Subtitle" value={formData.subtitle} onChange={e => setFormData({ ...formData, subtitle: e.target.value })} />
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input style={{ flex: 1 }} placeholder="CTA Text" value={formData.ctaText} onChange={e => setFormData({ ...formData, ctaText: e.target.value })} />
                <input style={{ flex: 1 }} placeholder="CTA Action (e.g. FindTruck)" value={formData.ctaAction} onChange={e => setFormData({ ...formData, ctaAction: e.target.value })} />
              </div>

                <select style={{ flex: 1 }} value={formData.targetAudience} onChange={e => setFormData({ ...formData, targetAudience: e.target.value })}>
                  <option value="all">All Audiences</option>
                  <option value="customer">Customer App</option>
                  <option value="driver">Driver App</option>
                </select>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: 12 }}>Start Date</label>
                  <input type="datetime-local" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12 }}>End Date</label>
                  <input type="datetime-local" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12 }}>Sort Order</label>
                  <input type="number" value={formData.sortOrder} onChange={e => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} />
                Active
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn" style={{ background: 'var(--primary)' }}>Save Banner</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {isPreviewOpen && previewBanner && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalStyle, width: 375, height: 600, padding: 0, position: 'relative', background: '#08111F', overflow: 'hidden' }}>
            <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ color: '#fff' }}>Load Balbin Logo</div>
            </div>
            
            <div style={{ padding: 16 }}>
              <div style={{
                position: 'relative', width: '100%', height: 160, borderRadius: 16, overflow: 'hidden', background: '#0F1B29'
              }}>
                <img src={previewBanner.imageUrl} alt="banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(8,17,31,0.9) 0%, rgba(8,17,31,0.4) 100%)', padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <h3 style={{ color: '#fff', margin: 0, fontSize: 18 }}>{previewBanner.title}</h3>
                  <p style={{ color: '#B8C4D1', fontSize: 12, margin: '4px 0 12px 0' }}>{previewBanner.subtitle}</p>
                  {previewBanner.ctaText && (
                    <div style={{ alignSelf: 'flex-start', background: '#FF7A00', padding: '6px 12px', borderRadius: 4, color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                      {previewBanner.ctaText}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button 
              className="btn" 
              style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)' }}
              onClick={() => setIsPreviewOpen(false)}
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const modalOverlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center'
};
const modalStyle = {
  width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto',
  background: 'var(--surface, #fff)', color: 'var(--text, #000)'
};
