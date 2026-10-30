import React, { useState } from 'react';
import ApiListPage from '../../components/common/ApiListPage';
import driverService from '../../services/driverService';

export default function Drivers() {
  const [activeFilter, setActiveFilter] = useState({ label: 'All Drivers', value: '' });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Action modal for Approve, Reject, Suspend, Toggle Status
  const [actionModal, setActionModal] = useState({
    open: false,
    driver: null,
    type: '', // 'approve' | 'reject' | 'suspend' | 'toggle'
    reason: '',
    loading: false,
    error: ''
  });

  // Secure KYC document preview modal
  const [previewModal, setPreviewModal] = useState({
    open: false,
    loading: false,
    driverName: '',
    driverId: '',
    docType: '',
    docLabel: '',
    viewUrl: '',
    format: '',
    maskedNumber: '',
    error: ''
  });

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const getDocStatusBadge = (status) => {
    const map = {
      approved: { bg: '#dcfce7', color: '#166534', label: 'Approved' },
      pending: { bg: '#fef9c3', color: '#854d0e', label: 'Pending' },
      rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
      missing: { bg: '#f3f4f6', color: '#6b7280', label: 'Missing' },
      not_uploaded: { bg: '#f3f4f6', color: '#6b7280', label: 'Missing' }
    };
    const s = map[status] || map.missing;
    return (
      <span style={{
        background: s.bg,
        color: s.color,
        padding: '1px 6px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '600',
        textTransform: 'capitalize'
      }}>
        {s.label}
      </span>
    );
  };

  const getApprovalBadge = (status) => {
    const map = {
      approved: { bg: '#dcfce7', color: '#166534', label: 'Approved' },
      pending: { bg: '#fef9c3', color: '#854d0e', label: 'Pending' },
      rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
      suspended: { bg: '#fee2e2', color: '#991b1b', label: 'Suspended' }
    };
    const s = map[status] || { bg: '#f3f4f6', color: '#374151', label: status || 'Pending' };
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

  const openDocumentPreview = async (driver, doc) => {
    setPreviewModal({
      open: true,
      loading: true,
      driverName: driver.name || 'Driver',
      driverId: driver.id,
      docType: doc.key,
      docLabel: doc.label || doc.key,
      viewUrl: '',
      format: '',
      maskedNumber: '',
      error: ''
    });

    try {
      const res = await driverService.getDriverDocumentViewUrl(driver.id, doc.key);
      const docData = res.data?.data?.document;
      if (!docData?.viewUrl) {
        throw new Error('Authorized secure preview URL was not returned by the server.');
      }
      setPreviewModal((prev) => ({
        ...prev,
        loading: false,
        viewUrl: docData.viewUrl,
        format: docData.format || 'pdf',
        maskedNumber: docData.maskedNumber || '',
        error: ''
      }));
    } catch (err) {
      setPreviewModal((prev) => ({
        ...prev,
        loading: false,
        error: err.response?.data?.message || err.message || 'Failed to retrieve secure document link.'
      }));
    }
  };

  const handleActionSubmit = async () => {
    const { driver, type, reason } = actionModal;
    if (!driver) return;

    if (type === 'reject' && !reason.trim()) {
      setActionModal((prev) => ({ ...prev, error: 'A rejection reason is required.' }));
      return;
    }

    setActionModal((prev) => ({ ...prev, loading: true, error: '' }));

    try {
      if (type === 'approve') {
        await driverService.approveDriver(driver.id);
      } else if (type === 'reject') {
        await driverService.rejectDriver(driver.id, reason.trim());
      } else if (type === 'suspend') {
        await driverService.suspendDriver(driver.id, reason.trim());
      } else if (type === 'toggle') {
        await driverService.toggleDriverStatus(driver.id, !driver.isActive);
      }

      setActionModal({ open: false, driver: null, type: '', reason: '', loading: false, error: '' });
      triggerRefresh();
    } catch (err) {
      setActionModal((prev) => ({
        ...prev,
        loading: false,
        error: err.response?.data?.message || err.message || `Failed to ${type} driver`
      }));
    }
  };

  const renderKycDocuments = (item) => {
    const kycList = item.kycDocuments || [
      { key: 'idProof', label: 'Aadhaar / ID', ...item.documents?.idProof },
      { key: 'drivingLicense', label: 'Driving Licence', ...item.documents?.drivingLicense }
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px', minWidth: '190px' }}>
        {kycList.map((doc) => {
          const isSubmitted = doc.isSubmitted ?? (doc.status && doc.status !== 'not_uploaded' && doc.status !== 'missing');
          return (
            <div key={doc.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', borderBottom: '1px dashed #f3f4f6', paddingBottom: '3px' }}>
              <span style={{ color: isSubmitted ? '#111827' : '#9ca3af', fontWeight: isSubmitted ? 600 : 400 }}>
                {doc.label || doc.key}:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {getDocStatusBadge(doc.status)}
                {isSubmitted ? (
                  <button
                    type="button"
                    style={{
                      padding: '1px 5px',
                      fontSize: '11px',
                      color: 'var(--primary)',
                      textDecoration: 'underline',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDocumentPreview(item, doc);
                    }}
                  >
                    View
                  </button>
                ) : (
                  <span style={{ color: '#9ca3af', fontSize: '11px' }}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <ApiListPage
        key={refreshTrigger}
        title="Drivers"
        endpoint="/admin/drivers"
        collection="drivers"
        searchParam="search"
        rowKey="id"
        detailPath={(item) => `/drivers/${item.id}`}
        filters={[
          { label: 'All Drivers', value: '' },
          { label: 'Pending Agency Approval', value: 'pending_agency', param: 'filter' },
          { label: 'Agency Accepted, Pending Super Admin', value: 'agency_accepted_pending_super_admin', param: 'filter' },
          { label: 'Pending KYC Documents', value: 'pending_kyc', param: 'filter' },
          { label: 'Pending Final Driver Approval', value: 'pending_final_approval', param: 'filter' },
          { label: 'Fully Approved', value: 'fully_approved', param: 'filter' },
          { label: 'Rejected', value: 'rejected', param: 'filter' },
          { label: 'Suspended', value: 'suspended', param: 'filter' }
        ]}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        columns={[
          { label: 'Name', path: 'name' },
          { label: 'Phone', path: 'phone' },
          {
            label: 'Agency',
            render: (item) => item.agency?.agencyName
              ? `${item.agency.agencyName} · ${item.agency.id}`
              : 'Independent'
          },
          {
            label: 'Agency Association',
            render: (item) => {
              if (!item.agency) return <span style={{ color: 'var(--text-secondary)' }}>N/A (Independent)</span>;
              const status = item.agencyAssociation?.status || 'pending';
              const color = status === 'approved' ? '#10b981' : status === 'rejected' ? '#ef4444' : '#f59e0b';
              const label = status === 'approved' ? 'Accepted' : status === 'rejected' ? 'Rejected' : 'Pending Agency';
              return <span style={{ color, fontWeight: 600 }}>{label}</span>;
            }
          },
          { label: 'Registered', render: (item) => item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—' },
          {
            label: 'Online',
            render: (item) => (
              <span style={{
                color: item.isOnline ? '#166534' : '#6b7280',
                background: item.isOnline ? '#dcfce7' : '#f3f4f6',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: '600'
              }}>
                {item.isOnline ? 'Online' : 'Offline'}
              </span>
            )
          },
          { label: 'Approval', render: (item) => getApprovalBadge(item.approvalStatus) },
          { label: 'KYC Documents', render: renderKycDocuments },
          {
            label: 'Account',
            render: (item) => (
              <span style={{
                color: item.isActive ? '#166534' : '#991b1b',
                background: item.isActive ? '#dcfce7' : '#fee2e2',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: '600'
              }}>
                {item.isActive ? 'Active' : 'Inactive'}
              </span>
            )
          }
        ]}
        actions={[
          {
            label: 'Approve',
            disabled: (item) => !item.canApproveDriver || item.approvalStatus === 'approved',
            run: (item) => setActionModal({
              open: true,
              driver: item,
              type: 'approve',
              reason: '',
              loading: false,
              error: ''
            })
          },
          {
            label: 'Reject',
            disabled: (item) => item.approvalStatus === 'rejected',
            run: (item) => setActionModal({
              open: true,
              driver: item,
              type: 'reject',
              reason: item.rejectionReason || '',
              loading: false,
              error: ''
            })
          },
          {
            label: 'Suspend',
            disabled: (item) => item.approvalStatus === 'suspended',
            run: (item) => setActionModal({
              open: true,
              driver: item,
              type: 'suspend',
              reason: '',
              loading: false,
              error: ''
            })
          },
          {
            label: (item) => item.isActive ? 'Deactivate' : 'Activate',
            run: (item) => setActionModal({
              open: true,
              driver: item,
              type: 'toggle',
              reason: '',
              loading: false,
              error: ''
            })
          }
        ]}
      />

      {/* Action Confirmation / Reason Modal */}
      {actionModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 460, margin: 16 }}>
            <h3 style={{ marginTop: 0, textTransform: 'capitalize' }}>
              {actionModal.type === 'toggle'
                ? (actionModal.driver?.isActive ? 'Deactivate Account' : 'Activate Account')
                : `${actionModal.type} Driver`}
            </h3>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Driver: <strong>{actionModal.driver?.name}</strong> (Phone: {actionModal.driver?.phone})
            </p>

            {actionModal.type === 'approve' && (
              <p style={{ fontSize: 13, color: '#166534', background: '#dcfce7', padding: 10, borderRadius: 6 }}>
                Confirming final approval activates this driver on the platform for dispatch. All mandatory KYC documents and agency association have been verified.
              </p>
            )}

            {actionModal.type === 'suspend' && (
              <p style={{ fontSize: 13, color: '#991b1b', background: '#fee2e2', padding: 10, borderRadius: 6 }}>
                Suspending this driver takes them offline immediately and prevents them from receiving booking dispatches.
              </p>
            )}

            {actionModal.type === 'toggle' && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Are you sure you want to {actionModal.driver?.isActive ? 'deactivate' : 'activate'} this driver account?
                {actionModal.driver?.isActive ? ' The driver will be taken offline immediately.' : ''}
              </p>
            )}

            {(actionModal.type === 'reject' || actionModal.type === 'suspend') && (
              <div style={{ marginTop: 12 }}>
                <label htmlFor="driver-action-reason" style={{ fontWeight: 600, fontSize: 13 }}>
                  {actionModal.type === 'reject' ? 'Rejection Reason (Required):' : 'Suspension Reason (Optional):'}
                </label>
                <textarea
                  id="driver-action-reason"
                  maxLength={500}
                  required={actionModal.type === 'reject'}
                  placeholder={actionModal.type === 'reject' ? 'e.g. Expired Driving Licence or blurred Aadhaar scan.' : 'e.g. Customer safety complaint or vehicle inspection failure.'}
                  value={actionModal.reason}
                  onChange={(e) => setActionModal({ ...actionModal, reason: e.target.value })}
                  style={{ width: '100%', minHeight: 80, marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
                />
              </div>
            )}

            {actionModal.error && (
              <p role="alert" style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>
                {actionModal.error}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                className="btn"
                disabled={actionModal.loading}
                onClick={() => setActionModal({ open: false, driver: null, type: '', reason: '', loading: false, error: '' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={actionModal.loading || (actionModal.type === 'reject' && !actionModal.reason.trim())}
                style={{
                  background: actionModal.type === 'approve'
                    ? 'var(--primary)'
                    : actionModal.type === 'reject' || actionModal.type === 'suspend'
                      ? 'var(--danger)'
                      : undefined,
                  color: actionModal.type !== 'toggle' ? '#fff' : undefined
                }}
                onClick={handleActionSubmit}
              >
                {actionModal.loading ? 'Saving…' : `Confirm ${actionModal.type[0].toUpperCase() + actionModal.type.slice(1)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secure KYC Document Preview Modal */}
      {previewModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
        }}>
          <div className="card" role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column', margin: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 10, marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>{previewModal.docLabel}</h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Driver: <strong>{previewModal.driverName}</strong>
                  {previewModal.maskedNumber ? ` · Number: ${previewModal.maskedNumber}` : ''}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setPreviewModal({ open: false, loading: false, driverName: '', driverId: '', docType: '', docLabel: '', viewUrl: '', format: '', maskedNumber: '', error: '' })}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ flex: 1, minHeight: 320, maxHeight: 520, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', borderRadius: 8, padding: 12 }}>
              {previewModal.loading ? (
                <p role="status">Requesting authorized signed document preview…</p>
              ) : previewModal.error ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <p role="alert" style={{ color: 'var(--danger)', marginBottom: 12 }}>{previewModal.error}</p>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => openDocumentPreview({ id: previewModal.driverId, name: previewModal.driverName }, { key: previewModal.docType, label: previewModal.docLabel })}
                  >
                    Retry Loading
                  </button>
                </div>
              ) : previewModal.viewUrl ? (
                previewModal.format === 'pdf' || previewModal.viewUrl.toLowerCase().includes('.pdf') ? (
                  <iframe
                    src={previewModal.viewUrl}
                    style={{ width: '100%', height: '480px', border: 'none', borderRadius: 6 }}
                    title="Document PDF Preview"
                  />
                ) : (
                  <img
                    src={previewModal.viewUrl}
                    alt={previewModal.docLabel}
                    style={{ maxWidth: '100%', maxHeight: '480px', objectFit: 'contain', borderRadius: 6 }}
                  />
                )
              ) : (
                <p style={{ color: 'var(--text-secondary)' }}>Document is not available for preview.</p>
              )}
            </div>

            {previewModal.viewUrl && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: 11, color: '#b45309' }}>
                  🔒 Short-lived authenticated URL (expires in 5 minutes)
                </span>
                <a
                  href={previewModal.viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  Open in New Tab &rarr;
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
