import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import fareService from '../../services/fareService';
import {
  Calculator,
  CheckCircle2,
  Edit3,
  Power,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Clock,
  ArrowRight,
  PlusCircle
} from 'lucide-react';

const FALLBACK_CATEGORIES = [
  { type: 'mini-truck', label: 'Mini Truck', desc: 'e.g. Tata Ace, Mahindra Jeeto (Up to 1.5 Tons)' },
  { type: 'pickup', label: 'Pickup Truck', desc: 'e.g. Bolero Pik-Up, Dost (Up to 2.5 Tons)' },
  { type: 'small-truck', label: 'Small Truck', desc: 'e.g. Tata 407, Eicher Pro 2049 (Up to 5 Tons)' },
  { type: 'medium-truck', label: 'Medium Truck', desc: 'e.g. Eicher 17ft/19ft, BharatBenz 1217C (Up to 10 Tons)' },
  { type: 'large-truck', label: 'Large Heavy Truck', desc: 'e.g. 10/12/14 Wheeler Multi-Axle (10+ Tons)' }
];

export default function FareManagement() {
  const { user } = useSelector((state) => state.auth);
  const isSuperAdmin = Boolean(user?.isSuperAdmin);

  const [categories, setCategories] = useState([]);
  const [fares, setFares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editing state
  const [editingTarget, setEditingTarget] = useState(null); // category object or fare object
  const [editForm, setEditForm] = useState({
    perKmRate: '',
    perTonRate: '',
    minimumFare: ''
  });

  // Confirmation Modal state
  const [confirmData, setConfirmData] = useState(null);
  const [saving, setSaving] = useState(false);

  // Live Simulator state
  const [calcCategory, setCalcCategory] = useState('medium-truck');
  const [calcDistance, setCalcDistance] = useState(100);
  const [calcWeight, setCalcWeight] = useState(2000);
  const [calcWeightUnit, setCalcWeightUnit] = useState('kg');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch available vehicle categories (with current fare mapping)
      let cats = [];
      try {
        const catRes = await fareService.getCategories();
        cats = catRes.data?.data?.categories || [];
      } catch (err) {
        // Fallback to static if endpoint fails
        cats = FALLBACK_CATEGORIES.map(c => ({
          type: c.type,
          label: c.label,
          desc: c.desc,
          hasFare: false
        }));
      }

      // 2. Fetch full fare list
      const fareRes = await fareService.getFares();
      const loadedFares = fareRes.data?.data?.fares || [];
      setFares(loadedFares);

      // Merge fare metadata into categories
      const mergedCats = (cats.length > 0 ? cats : FALLBACK_CATEGORIES).map(c => {
        const matchingFare = loadedFares.find(f => f.vehicleType === c.type);
        return {
          ...c,
          hasFare: Boolean(matchingFare),
          fare: matchingFare || null,
          perKmRate: matchingFare?.perKmRate ?? c.perKmRate ?? null,
          perTonRate: matchingFare?.perTonRate ?? c.perTonRate ?? null,
          minimumFare: matchingFare?.minimumFare ?? c.minimumFare ?? null,
          isActive: matchingFare ? matchingFare.isActive : false,
          updatedAt: matchingFare?.updatedAt || c.updatedAt || null,
          updatedBy: matchingFare?.updatedBy || c.updatedBy || null
        };
      });

      setCategories(mergedCats);
      if (mergedCats.length > 0 && !calcCategory) {
        setCalcCategory(mergedCats[0].type);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load vehicle pricing data.');
    } finally {
      setLoading(false);
    }
  }, [calcCategory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenEdit = (item) => {
    if (!isSuperAdmin) {
      setError('Only the designated Super Admin has permission to modify vehicle fare rates.');
      return;
    }

    setEditingTarget(item);
    setEditForm({
      perKmRate: item.perKmRate != null ? String(item.perKmRate) : '',
      perTonRate: item.perTonRate != null ? String(item.perTonRate) : '',
      minimumFare: item.minimumFare != null ? String(item.minimumFare) : ''
    });
    setError('');
    setSuccess('');
  };

  const handleReviewChanges = (e) => {
    e.preventDefault();
    if (!editingTarget) return;

    const perKmRate = Number(editForm.perKmRate);
    const perTonRate = Number(editForm.perTonRate);
    const minimumFare = Number(editForm.minimumFare);

    if (
      !Number.isFinite(perKmRate) || perKmRate < 0 ||
      !Number.isFinite(perTonRate) || perTonRate < 0 ||
      !Number.isFinite(minimumFare) || minimumFare < 0
    ) {
      setError('Please enter valid, non-negative numbers for all rate fields.');
      return;
    }

    setConfirmData({
      category: editingTarget.type || editingTarget.vehicleType,
      categoryLabel: editingTarget.label || editingTarget.type || editingTarget.vehicleType,
      fareId: editingTarget.fare?._id || editingTarget._id || null,
      isNew: !editingTarget.hasFare && !editingTarget.fare && !editingTarget._id,
      current: {
        perKmRate: editingTarget.perKmRate ?? 0,
        perTonRate: editingTarget.perTonRate ?? 0,
        minimumFare: editingTarget.minimumFare ?? 0
      },
      newRates: {
        perKmRate,
        perTonRate,
        minimumFare
      }
    });
  };

  const handleConfirmSave = async () => {
    if (!confirmData) return;
    setSaving(true);
    setError('');

    try {
      if (confirmData.isNew) {
        await fareService.createFare({
          vehicleType: confirmData.category,
          perKmRate: confirmData.newRates.perKmRate,
          perTonRate: confirmData.newRates.perTonRate,
          minimumFare: confirmData.newRates.minimumFare
        });
        setSuccess(`Dynamic pricing configured successfully for ${confirmData.categoryLabel}!`);
      } else {
        await fareService.updateFare(confirmData.fareId, {
          perKmRate: confirmData.newRates.perKmRate,
          perTonRate: confirmData.newRates.perTonRate,
          minimumFare: confirmData.newRates.minimumFare
        });
        setSuccess(`Dynamic pricing updated successfully for ${confirmData.categoryLabel}!`);
      }

      setConfirmData(null);
      setEditingTarget(null);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save pricing changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (item) => {
    if (!isSuperAdmin) {
      setError('Only the designated Super Admin has permission to modify vehicle fare rates.');
      return;
    }

    const fareId = item.fare?._id || item._id;
    if (!fareId) return;

    try {
      await fareService.toggleFareStatus(fareId);
      await loadData();
      setSuccess(`Status toggled for ${item.label || item.vehicleType || item.type}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to toggle fare status.');
    }
  };

  const formatTimestamp = (dateStr, updatedBy) => {
    if (!dateStr) return 'Not yet updated';
    const d = new Date(dateStr);
    const formatted = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const updater = updatedBy?.name ? ` by ${updatedBy.name}` : '';
    return `${formatted}${updater}`;
  };

  // Live Simulator calculation
  const selectedCat = categories.find((c) => c.type === calcCategory);
  const ratePerKm = selectedCat?.perKmRate || 0;
  const ratePerTon = selectedCat?.perTonRate || 0;
  const minFare = selectedCat?.minimumFare || 0;

  const numericWeight = Number(calcWeight) || 0;
  const weightInTon = calcWeightUnit === 'ton' ? numericWeight : numericWeight / 1000;
  const distanceKm = Number(calcDistance) || 0;
  const distCharge = distanceKm * ratePerKm;
  const wtCharge = weightInTon * ratePerTon;
  const formulaTotal = distCharge + wtCharge;
  const finalCalculatedFare = Math.max(formulaTotal, minFare);

  return (
    <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto', color: '#1e293b' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: 'bold', margin: 0, color: '#0f172a' }}>
              Super Admin Vehicle Pricing Management
            </h1>
            {isSuperAdmin ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '14px', fontSize: '12px', fontWeight: '600' }}>
                <ShieldCheck size={14} /> Super Admin Authorized
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: '14px', fontSize: '12px', fontWeight: '600' }}>
                <ShieldAlert size={14} /> View-Only Access
              </span>
            )}
          </div>
          <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: '14px' }}>
            Configure and manage authoritative 3-tier road pricing per vehicle category. Only the designated Super Admin can modify rates.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: 'white',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '13px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          <RefreshCw size={14} /> Refresh Pricing
        </button>
      </div>

      {/* SUPER ADMIN RESTRICTION NOTICE (IF NOT SUPER ADMIN) */}
      {!isSuperAdmin && (
        <div style={{ padding: '14px 18px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', color: '#92400e', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldAlert size={22} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
            <strong>Super Admin Protected:</strong> You are currently signed in as an Administrator in Read-Only mode. Under LoadBalbin security policy, vehicle pricing configuration and modifications are strictly restricted to the designated Super Admin.
          </div>
        </div>
      )}

      {/* FEEDBACK NOTICES */}
      {error && (
        <div style={{ padding: '14px 18px', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '10px', color: '#b91c1c', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '14px', fontWeight: '500' }}>{error}</span>
        </div>
      )}

      {success && (
        <div style={{ padding: '14px 18px', background: '#dcfce7', border: '1px solid #4ade80', borderRadius: '10px', color: '#15803d', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '14px', fontWeight: '500' }}>{success}</span>
        </div>
      )}

      {/* PRICING FORMULA SPEC CARD */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
          📐 Authoritative 3-Tier Vehicle Road Pricing Formula
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', fontSize: '13px', color: '#334155' }}>
          <div style={{ background: 'white', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <strong>1. Distance Charge:</strong><br />
            <code>ORS Road Distance (KM) × Rate per KM (₹)</code>
          </div>
          <div style={{ background: 'white', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <strong>2. Weight Charge:</strong><br />
            <code>(Cargo Weight KG / 1000) × Rate per Ton (₹)</code>
          </div>
          <div style={{ background: 'white', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <strong>3. Final Booking Fare:</strong><br />
            <code>MAX(Distance Charge + Weight Charge, Minimum Fare)</code>
          </div>
        </div>
      </div>

      {/* PRICING TABLE CARD */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '28px', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: '#1e293b' }}>
            Configured Vehicle Category Rates
          </h2>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Total Categories: {categories.length}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '14px 18px' }}>Vehicle Category</th>
                <th style={{ padding: '14px 18px' }}>Rate per KM (₹)</th>
                <th style={{ padding: '14px 18px' }}>Rate per Ton (₹)</th>
                <th style={{ padding: '14px 18px' }}>Minimum Fare (₹)</th>
                <th style={{ padding: '14px 18px' }}>Status</th>
                <th style={{ padding: '14px 18px' }}>Last Updated</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                    <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 8px', display: 'block' }} />
                    Loading category pricing configurations...
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                    No vehicle categories found.
                  </td>
                </tr>
              ) : (
                categories.map((c) => {
                  const hasRates = c.perKmRate != null;
                  return (
                    <tr key={c.type} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '15px' }}>
                          {c.label || c.type}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          {c.desc || `Type identifier: ${c.type}`}
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px', fontWeight: '700', color: hasRates ? '#0284c7' : '#94a3b8', fontSize: '15px' }}>
                        {hasRates ? `₹${c.perKmRate}` : '—'}
                      </td>

                      <td style={{ padding: '14px 18px', fontWeight: '700', color: hasRates ? '#059669' : '#94a3b8', fontSize: '15px' }}>
                        {hasRates ? `₹${c.perTonRate}` : '—'}
                      </td>

                      <td style={{ padding: '14px 18px', fontWeight: '700', color: hasRates ? '#334155' : '#94a3b8', fontSize: '15px' }}>
                        {hasRates ? `₹${c.minimumFare}` : '—'}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        {!hasRates ? (
                          <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: '#f1f5f9', color: '#64748b' }}>
                            Unconfigured
                          </span>
                        ) : (
                          <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: c.isActive ? '#dcfce7' : '#fee2e2', color: c.isActive ? '#15803d' : '#b91c1c' }}>
                            {c.isActive ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px', fontSize: '12px', color: '#64748b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} />
                          <span>{formatTimestamp(c.updatedAt, c.updatedBy)}</span>
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          {isSuperAdmin ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(c)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '7px 12px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  background: hasRates ? '#f8fafc' : '#0284c7',
                                  color: hasRates ? '#1e293b' : 'white',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: '600'
                                }}
                              >
                                {hasRates ? <><Edit3 size={13} /> Edit Rates</> : <><PlusCircle size={13} /> Set Pricing</>}
                              </button>

                              {hasRates && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(c)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '7px 12px',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    background: c.isActive ? '#fef2f2' : '#f0fdf4',
                                    color: c.isActive ? '#dc2626' : '#16a34a',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '600'
                                  }}
                                >
                                  <Power size={13} /> {c.isActive ? 'Disable' : 'Enable'}
                                </button>
                              )}
                            </>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                              Super Admin only
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT MODAL */}
      {editingTarget && !confirmData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '28px', width: '460px', maxWidth: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                  {editingTarget.hasFare || editingTarget.fare ? 'Edit Category Pricing' : 'Configure Category Pricing'}
                </h3>
                <span style={{ fontSize: '13px', color: '#0284c7', fontWeight: '600' }}>
                  {editingTarget.label || editingTarget.type || editingTarget.vehicleType}
                </span>
              </div>
            </div>

            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
              Define exactly three authoritative pricing rates. Base Fare and extra add-ons are strictly disabled.
            </p>

            <form onSubmit={handleReviewChanges}>
              {/* FIELD 1: Rate Per KM */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  1. Rate Per KM (₹) *
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#64748b', fontWeight: '600' }}>₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="e.g. 22.00"
                    value={editForm.perKmRate}
                    onChange={(e) => setEditForm({ ...editForm, perKmRate: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px 10px 28px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Applied to actual OpenRouteService (ORS) road distance.</span>
              </div>

              {/* FIELD 2: Rate Per Ton */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  2. Rate Per Ton (₹) *
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#64748b', fontWeight: '600' }}>₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="e.g. 80.00"
                    value={editForm.perTonRate}
                    onChange={(e) => setEditForm({ ...editForm, perTonRate: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px 10px 28px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Applied to cargo weight converted to tons (KG / 1000).</span>
              </div>

              {/* FIELD 3: Minimum Fare */}
              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  3. Minimum Fare (₹) *
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#64748b', fontWeight: '600' }}>₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="e.g. 350.00"
                    value={editForm.minimumFare}
                    onChange={(e) => setEditForm({ ...editForm, minimumFare: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px 10px 28px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Guaranteed floor fare applied if formula total is less.</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingTarget(null)}
                  style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#0284c7', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
                >
                  Review Changes <ArrowRight size={14} style={{ verticalAlign: 'middle', marginLeft: '4px' }} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL BEFORE SAVING */}
      {confirmData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '28px', width: '500px', maxWidth: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ background: '#e0f2fe', padding: '8px', borderRadius: '8px', color: '#0284c7' }}>
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                  Confirm Pricing Update
                </h3>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  Category: <strong>{confirmData.categoryLabel}</strong>
                </span>
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', marginBottom: '18px', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
              <strong>Important Notice:</strong> These updated rates will immediately take effect for all future bookings. Existing historical bookings retain their original locked pricing snapshots.
            </div>

            {/* COMPARISON TABLE */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '22px', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Pricing Parameter</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Current Rate</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', color: '#0284c7' }}>New Rate</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '600' }}>Rate Per KM</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>₹{confirmData.current.perKmRate}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#0284c7' }}>₹{confirmData.newRates.perKmRate}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '600' }}>Rate Per Ton</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>₹{confirmData.current.perTonRate}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#059669' }}>₹{confirmData.newRates.perTonRate}</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 12px', fontWeight: '600' }}>Minimum Fare</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>₹{confirmData.current.minimumFare}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#334155' }}>₹{confirmData.newRates.minimumFare}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={saving}
                onClick={() => setConfirmData(null)}
                style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
              >
                Back to Edit
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmSave}
                style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: '#059669', color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}
              >
                {saving ? 'Applying Rates...' : 'Confirm & Save Pricing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIVE INTERACTIVE FARE SIMULATOR */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ background: '#e0f2fe', padding: '6px', borderRadius: '8px', color: '#0284c7' }}>
            <Calculator size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
              Live Road Pricing Simulator & Verification
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Calculates authoritative fare using the active rates configured above and actual ORS road distance.
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
              Vehicle Category
            </label>
            <select
              value={calcCategory}
              onChange={(e) => setCalcCategory(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
            >
              {categories.map((c) => (
                <option key={c.type} value={c.type}>
                  {c.label || c.type} {c.perKmRate ? `(₹${c.perKmRate}/km)` : '(Unconfigured)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
              ORS Road Distance (KM)
            </label>
            <input
              type="number"
              min="0"
              value={calcDistance}
              onChange={(e) => setCalcDistance(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
              Cargo Weight
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number"
                min="0"
                value={calcWeight}
                onChange={(e) => setCalcWeight(e.target.value)}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              />
              <select
                value={calcWeightUnit}
                onChange={(e) => setCalcWeightUnit(e.target.value)}
                style={{ width: '80px', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              >
                <option value="kg">KG</option>
                <option value="ton">Tons</option>
              </select>
            </div>
          </div>
        </div>

        {/* CALCULATION BREAKDOWN */}
        <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
            <span>Distance Charge ({distanceKm} km × ₹{ratePerKm}/km):</span>
            <strong style={{ color: '#0284c7' }}>₹{distCharge.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
            <span>Weight Charge ({weightInTon.toFixed(2)} tons × ₹{ratePerTon}/ton):</span>
            <strong style={{ color: '#059669' }}>₹{wtCharge.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#64748b' }}>
            <span>Formula Subtotal (Distance + Weight):</span>
            <span>₹{formulaTotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#64748b' }}>
            <span>Minimum Fare Threshold:</span>
            <span>₹{minFare.toFixed(2)}</span>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid #cbd5e1', margin: '12px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>Authoritative Final Fare:</span>
              <div style={{ fontSize: '11px', color: '#64748b' }}>MAX(₹{formulaTotal.toFixed(2)}, ₹{minFare.toFixed(2)})</div>
            </div>
            <strong style={{ fontSize: '22px', fontWeight: '800', color: '#0284c7' }}>
              ₹{finalCalculatedFare.toFixed(2)}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}
