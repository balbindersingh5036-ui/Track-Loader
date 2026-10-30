import React, { useState } from 'react';
import api from '../../services/api';
import ApiListPage from '../../components/common/ApiListPage';
import { useNavigate } from 'react-router-dom';

export default function Agencies() {
  const navigate = useNavigate();
  const [rejectModal, setRejectModal] = useState({ open: false, id: null, type: 'reject', reason: '' });
  const [actionError, setActionError] = useState('');
  const [activeFilter, setActiveFilter] = useState({ label: 'All Agencies', value: '' });

  const statusFilters = [
    { label: 'All Agencies', value: '' },
    { label: 'Pending Verification', value: 'pending', param: 'approvalStatus' },
    { label: 'Approved', value: 'approved', param: 'approvalStatus' },
    { label: 'Rejected', value: 'rejected', param: 'approvalStatus' },
    { label: 'Suspended', value: 'suspended', param: 'approvalStatus' }
  ];

  const submitActionWithReason = async () => {
    try {
      setActionError('');
      const endpoint = rejectModal.type === 'reject'
        ? `/admin/agencies/${rejectModal.id}/reject`
        : `/admin/agencies/${rejectModal.id}/suspend`;
      await api.patch(endpoint, { reason: rejectModal.reason || `${rejectModal.type}ed by Super Admin` });
      setRejectModal({ open: false, id: null, type: 'reject', reason: '' });
      window.location.reload();
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Action failed');
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      approved: { bg: '#dcfce7', color: '#166534', label: 'Approved' },
      pending: { bg: '#fef9c3', color: '#854d0e', label: 'Pending Verification' },
      rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
      suspended: { bg: '#f3f4f6', color: '#374151', label: 'Suspended' }
    };
    const s = map[status] || { bg: '#e5e7eb', color: '#374151', label: status };
    return (
      <span style={{
        background: s.bg,
        color: s.color,
        padding: '3px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 'bold',
        textTransform: 'capitalize'
      }}>
        {s.label}
      </span>
    );
  };

  const getDocumentStatusBadge = (status) => {
    const map = {
      approved: { bg: '#dcfce7', color: '#166534', label: 'Approved' },
      pending: { bg: '#fef9c3', color: '#854d0e', label: 'Pending' },
      rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
      missing: { bg: '#f3f4f6', color: '#6b7280', label: 'Missing' },
      not_uploaded: { bg: '#f3f4f6', color: '#6b7280', label: 'Missing' }
    };
    const s = map[status] || { bg: '#f3f4f6', color: '#6b7280', label: 'Missing' };
    return (
      <span style={{
        background: s.bg,
        color: s.color,
        padding: '2px 6px',
        borderRadius: '10px',
        fontSize: '11px',
        fontWeight: '600',
        textTransform: 'capitalize',
        whiteSpace: 'nowrap'
      }}>
        {s.label}
      </span>
    );
  };

  const renderSubmittedDocuments = (item) => {
    const summary = item.submittedDocumentsSummary || [];
    let docList = summary;
    if (!docList.length && item.documents) {
      const standard = [
        { key: 'ownerAadhaar', label: 'Owner Aadhaar' },
        { key: 'businessRegistration', label: 'Business Registration' },
        { key: 'tradeLicense', label: 'Trade Licence' },
        { key: 'gstCertificate', label: 'GST Certificate' },
        { key: 'taxId', label: 'Tax ID' }
      ];
      docList = standard.map(({ key, label }) => {
        const doc = item.documents[key];
        const isSubmitted = Boolean(doc && doc.status !== 'not_uploaded' && doc.status !== 'missing');
        return {
          key,
          label,
          isSubmitted,
          status: isSubmitted ? (doc?.status || 'pending') : 'missing'
        };
      });
    }

    const totalSubmitted = item.submittedDocumentCount ?? docList.filter((d) => d.isSubmitted).length;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', minWidth: '175px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: '700', color: '#1f2937', marginBottom: '2px' }}>
          <span>Total: {totalSubmitted} Submitted</span>
        </div>
        {docList.map((doc) => (
          <div key={doc.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ color: doc.isSubmitted ? '#111827' : '#9ca3af' }}>{doc.label}:</span>
            {getDocumentStatusBadge(doc.status)}
          </div>
        ))}
        <button
          type="button"
          className="btn btn-sm"
          style={{ marginTop: '4px', fontSize: '11px', padding: '2px 6px', alignSelf: 'flex-start', color: 'var(--primary)' }}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/agencies/${item._id}#documents`);
          }}
        >
          View Documents &rarr;
        </button>
      </div>
    );
  };

  return (
    <>
      <ApiListPage
        title="Agencies"
        endpoint="/admin/agencies"
        collection="agencies"
        searchParam="search"
        filters={statusFilters}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        rowKey="_id"
        detailPath={(item) => `/agencies/${item._id}`}
        columns={[
          { label: 'Agency Name', path: 'agencyName' },
          { label: 'Owner Name', render: (item) => item.owner?.name || '—' },
          { label: 'Phone', path: 'phone' },
          { label: 'City', path: 'city' },
          { label: 'Verification', render: (item) => getStatusBadge(item.approvalStatus) },
          { label: 'Active', render: (item) => item.isActive ? 'Active' : 'Inactive' },
          { label: 'Submitted Documents', render: renderSubmittedDocuments }
        ]}
        actions={[
          {
            label: 'View Documents',
            run: (item) => navigate(`/agencies/${item._id}#documents`)
          },
          {
            label: 'Approve',
            disabled: (item) => item.approvalStatus === 'approved',
            run: (item) => api.patch(`/admin/agencies/${item._id}/approve`)
          },
          {
            label: 'Reject',
            disabled: (item) => item.approvalStatus === 'rejected',
            run: (item) => setRejectModal({ open: true, id: item._id, type: 'reject', reason: '' })
          },
          {
            label: 'Suspend',
            disabled: (item) => item.approvalStatus === 'suspended',
            run: (item) => setRejectModal({ open: true, id: item._id, type: 'suspend', reason: '' })
          }
        ]}
      />

      {rejectModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 440 }}>
            <h3 style={{ marginTop: 0, textTransform: 'capitalize' }}>{rejectModal.type} Agency</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Please provide a reason for {rejectModal.type}ing this agency:
            </p>
            {actionError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{actionError}</p>}
            <textarea
              style={{ width: '100%', height: 80, padding: 8, borderRadius: 6, border: '1px solid #ccc', marginBottom: 16 }}
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
              placeholder="e.g. Invalid Aadhaar document or unregistered firm number."
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setRejectModal({ open: false, id: null, type: 'reject', reason: '' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: 'var(--danger)', color: '#fff' }}
                onClick={submitActionWithReason}
              >
                Confirm {rejectModal.type[0].toUpperCase() + rejectModal.type.slice(1)}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
