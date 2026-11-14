import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const statusColor = (status, colors) => {
  if (status === 'approved') return colors.green;
  if (status === 'pending') return colors.warning;
  if (status === 'rejected') return colors.danger;
  if (status === 'eligible' || status === 'assigned') return colors.primary;
  return colors.muted;
};

const statusLabel = (status, pendingLabel = 'Pending') => {
  if (status === 'not_uploaded' || status === 'missing' || status === 'none') return 'Not Submitted';
  if (status === 'pending') return pendingLabel;
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  if (status === 'suspended') return 'Suspended';
  if (status === 'assigned') return 'Assigned';
  if (status === 'eligible') return 'Eligible';
  return 'Not Submitted';
};

function StatusBadge({ status, colors, pendingLabel }) {
  const color = statusColor(status, colors);
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: `${color}20`, borderWidth: 1, borderColor: `${color}80` }}>
      <Text style={{ color, fontSize: 11, fontWeight: '800' }}>
        {statusLabel(status, pendingLabel)}
      </Text>
    </View>
  );
}

function SectionTitle({ icon, title, colors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14 }}>
      <Ionicons name={icon} size={19} color={colors.primary} />
      <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '800', flex: 1 }}>{title}</Text>
    </View>
  );
}

function StatusRow({ label, status, reason, colors, pendingLabel }) {
  return (
    <View style={{ padding: 12, borderRadius: 10, backgroundColor: colors.card2, borderWidth: 1, borderColor: colors.border, gap: 7 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '700', flex: 1 }}>{label}</Text>
        <StatusBadge status={status} colors={colors} pendingLabel={pendingLabel} />
      </View>
      {status === 'rejected' && reason ? (
        <Text style={{ color: colors.danger, fontSize: 12, lineHeight: 17 }}>
          Rejection reason: {reason}
        </Text>
      ) : null}
    </View>
  );
}

function dateLabel(label, date, colors) {
  if (!date) return null;
  const formattedDate = new Date(date).toLocaleDateString();
  return (
    <Text style={{ color: colors.muted, fontSize: 11 }}>
      {label}: {formattedDate}
    </Text>
  );
}

export default function DriverKycSection({
  profile,
  colors,
  onUploadDocument,
  onViewDocument,
  uploadDisabled
}) {
  const agency = profile?.agency;
  const agencyKyc = profile?.agencyKyc;
  const associationStatus = agency
    ? profile?.agencyAssociation?.status || 'pending'
    : 'none';
  const driverDocuments = [
    { label: 'Aadhaar / Identity Proof', key: 'idProof' },
    { label: 'Driving Licence', key: 'drivingLicense' }
  ];
  const vehicles = profile?.vehicles || [];

  return (
    <View style={{ gap: 14, marginTop: 18 }}>
      <View style={{ marginBottom: 2 }}>
        <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }}>
          Verification
        </Text>
        <Text style={{ color: colors.ink, fontSize: 19, fontWeight: '800', marginTop: 3 }}>
          KYC &amp; Verification
        </Text>
      </View>

      <View style={{ padding: 14, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, gap: 9 }}>
        <SectionTitle icon="business-outline" title="Agency KYC Status" colors={colors} />
        <StatusRow
          label="Agency Association"
          status={associationStatus}
          reason={profile?.agencyAssociation?.rejectionReason}
          colors={colors}
        />
        {agency ? (
          <>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
              {agency.agencyName || 'Your linked agency'} · documents are view-only here.
            </Text>
            {[
              { label: 'Agency Owner Identity Proof (Aadhaar)', key: 'ownerAadhaar' },
              { label: 'Business Registration', key: 'businessRegistration' },
              { label: 'Trade Licence', key: 'tradeLicense' },
              { label: 'GST Certificate', key: 'gstCertificate' },
              { label: 'Tax ID', key: 'taxId' }
            ].map(({ label, key }) => {
              const document = agencyKyc?.documents?.[key];
              return (
                <StatusRow
                  key={key}
                  label={label}
                  status={document?.status || 'not_uploaded'}
                  reason={document?.rejectionReason}
                  colors={colors}
                />
              );
            })}
            <StatusRow
              label="Agency Super Admin Approval"
              status={agencyKyc?.approvalStatus || agency.approvalStatus || 'pending'}
              reason={agencyKyc?.rejectionReason}
              colors={colors}
            />
          </>
        ) : (
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            No agency is linked. Agency documents are not applicable until you join an agency.
          </Text>
        )}
      </View>

      <View style={{ padding: 14, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, gap: 9 }}>
        <SectionTitle icon="shield-checkmark-outline" title="Driver KYC Status" colors={colors} />
        {driverDocuments.map(({ label, key }) => {
          const document = profile?.documents?.[key] || {};
          const status = document.status || 'not_uploaded';
          const canView = !['not_uploaded', 'missing'].includes(status);
          const uploadLabel = status === 'rejected'
            ? 'Re-upload Document'
            : status === 'approved'
              ? 'Update Document'
              : 'Upload Document';

          return (
            <View key={key} style={{ padding: 12, borderRadius: 10, backgroundColor: colors.card2, borderWidth: 1, borderColor: colors.border, gap: 9 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '700', flex: 1 }}>{label}</Text>
                <StatusBadge status={status} colors={colors} pendingLabel="Under Review" />
              </View>
              {dateLabel('Submitted', document.submittedAt, colors)}
              {dateLabel('Last reviewed', document.reviewedAt, colors)}
              {status === 'rejected' && document.rejectionReason ? (
                <Text style={{ color: colors.danger, fontSize: 12, lineHeight: 17 }}>
                  Rejection reason: {document.rejectionReason}
                </Text>
              ) : null}
              {canView ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${label} document securely`}
                  onPress={() => onViewDocument({ docType: key, key })}
                  style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5 }}
                >
                  <Ionicons name="eye-outline" size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>View Document</Text>
                </Pressable>
              ) : null}
              {status !== 'pending' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={uploadLabel + ' for ' + label}
                  disabled={uploadDisabled}
                  onPress={() => onUploadDocument({ docType: key, label, status })}
                  style={{ alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.primary, opacity: uploadDisabled ? 0.55 : 1 }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>{uploadLabel}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        <StatusRow
          label="Driver Account Approval"
          status={profile?.approvalStatus || 'pending'}
          reason={profile?.rejectionReason}
          colors={colors}
        />
        <StatusRow
          label={`Vehicle Assignment${vehicles.length ? ` · ${vehicles.length}` : ''}`}
          status={vehicles.length ? 'assigned' : 'not_uploaded'}
          colors={colors}
        />
        {vehicles.length ? (
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            {vehicles.map((vehicle) => vehicle.vehicleNumber).filter(Boolean).join(', ') || 'Vehicle assigned'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
