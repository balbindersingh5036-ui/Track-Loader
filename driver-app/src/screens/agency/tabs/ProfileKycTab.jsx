import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../components/AgencyTheme';
import StatusBadge from '../components/StatusBadge';

const AGENCY_DOCUMENTS = [
  {
    key: 'ownerAadhaar',
    title: 'Owner Identity Proof',
    subtitle: 'Aadhaar Card or Passport of the registered owner',
    icon: 'card-outline',
    required: true
  },
  {
    key: 'businessRegistration',
    title: 'Business Registration',
    subtitle: 'Certificate of Incorporation, MSME, or Partnership Deed',
    icon: 'business-outline',
    required: true
  },
  {
    key: 'tradeLicense',
    title: 'Trade Licence',
    subtitle: 'Municipal or Local Transport Commercial Licence',
    icon: 'document-text-outline',
    required: false
  },
  {
    key: 'gstCertificate',
    title: 'GST Certificate',
    subtitle: 'Goods and Services Tax Registration copy',
    icon: 'receipt-outline',
    required: false
  },
  {
    key: 'taxId',
    title: 'Tax ID / PAN Card',
    subtitle: 'Permanent Account Number of Agency / Proprietor',
    icon: 'ribbon-outline',
    required: false
  }
];

export default function ProfileKycTab({
  agency,
  user,
  saving = '',
  loading = false,
  refreshing = false,
  onRefresh,
  onUpdateProfile,
  onUploadDocument
}) {
  const [agencyName, setAgencyName] = useState(agency?.agencyName || '');
  const [address, setAddress] = useState(agency?.address || '');
  const [city, setCity] = useState(agency?.city || '');
  const [editMode, setEditMode] = useState(false);

  const handleSaveProfile = () => {
    if (onUpdateProfile) {
      onUpdateProfile({ agencyName, address, city });
      setEditMode(false);
    }
  };

  const isSavingProfile = saving === 'profile';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        ) : undefined
      }
    >
      {/* 1. AGENCY PROFILE OVERVIEW CARD */}
      <View style={styles.card}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarBubble}>
            <Text style={styles.avatarLetter}>
              {(agency?.agencyName || user?.name || 'A').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.agencyTitle} numberOfLines={1}>
              {agency?.agencyName || 'LoadBalbin Agency'}
            </Text>
            <Text style={styles.agencyOwnerText} numberOfLines={1}>
              Owner: {user?.name || agency?.ownerName || 'Registered Proprietor'}
            </Text>
            <StatusBadge
              status={agency?.approvalStatus}
              label={agency?.approvalStatus === 'approved' ? 'Verified Agency' : 'Verification Pending'}
              size="sm"
              style={{ marginTop: 4 }}
            />
          </View>
        </View>

        <View style={styles.divider} />

        {/* Read-only / Form Details */}
        {!editMode ? (
          <View style={styles.detailsList}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone Number</Text>
              <Text style={styles.detailValue}>{agency?.phone || user?.phone || '—'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email Address</Text>
              <Text style={styles.detailValue}>{agency?.email || user?.email || '—'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>City</Text>
              <Text style={styles.detailValue}>{agency?.city || '—'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Registered Address</Text>
              <Text style={styles.detailValue} numberOfLines={2}>
                {agency?.address || '—'}
              </Text>
            </View>

            <Pressable
              onPress={() => {
                setAgencyName(agency?.agencyName || '');
                setAddress(agency?.address || '');
                setCity(agency?.city || '');
                setEditMode(true);
              }}
              style={styles.editButton}
            >
              <Ionicons name="pencil-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.editButtonText}>Edit Agency Info</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Agency Name</Text>
              <TextInput
                value={agencyName}
                onChangeText={setAgencyName}
                placeholder="Enter Agency Name"
                placeholderTextColor={theme.colors.muted}
                style={styles.textInput}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>City</Text>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="Operational City"
                placeholderTextColor={theme.colors.muted}
                style={styles.textInput}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Registered Address</Text>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="Office or Parking Hub Address"
                placeholderTextColor={theme.colors.muted}
                multiline
                style={[styles.textInput, styles.multilineInput]}
              />
            </View>

            <View style={styles.formActionsRow}>
              <Pressable
                onPress={() => setEditMode(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleSaveProfile}
                disabled={isSavingProfile}
                style={styles.saveButton}
              >
                {isSavingProfile ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* 2. MASTER KYC APPROVAL BANNER */}
      <View style={styles.kycStatusCard}>
        <View style={styles.kycStatusHeader}>
          <Ionicons
            name={
              agency?.approvalStatus === 'approved'
                ? 'shield-checkmark'
                : agency?.approvalStatus === 'rejected'
                ? 'alert-circle'
                : 'time-outline'
            }
            size={24}
            color={
              agency?.approvalStatus === 'approved'
                ? theme.colors.green
                : agency?.approvalStatus === 'rejected'
                ? theme.colors.danger
                : theme.colors.accent
            }
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.kycStatusTitle}>
              {agency?.approvalStatus === 'approved'
                ? 'KYC Verification Approved'
                : agency?.approvalStatus === 'rejected'
                ? 'KYC Verification Rejected'
                : 'KYC Verification Under Review'}
            </Text>
            <Text style={styles.kycStatusSubtitle}>
              {agency?.approvalStatus === 'approved'
                ? 'Your commercial transport credentials have been verified by Super Admin.'
                : agency?.approvalStatus === 'rejected'
                ? agency?.rejectionReason || 'Please review and re-upload required credentials.'
                : 'Super Admin verifies submitted credentials before enabling trip dispatches.'}
            </Text>
          </View>
        </View>
      </View>

      {/* 3. COMPLIANCE DOCUMENTS LIST */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Compliance Documents</Text>
        <Text style={styles.sectionHint}>PDF, JPG, PNG (Max 5MB)</Text>
      </View>

      <View style={styles.docsList}>
        {AGENCY_DOCUMENTS.map((doc) => {
          const docData = agency?.documents?.[doc.key];
          const status = docData?.status || 'not_uploaded';
          const isUploading = saving === `agency-${doc.key}`;

          return (
            <View key={doc.key} style={styles.docCard}>
              <View style={styles.docHeader}>
                <View style={styles.docIconBox}>
                  <Ionicons name={doc.icon} size={22} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.docTitle}>{doc.title}</Text>
                    {doc.required && (
                      <View style={styles.requiredTag}>
                        <Text style={styles.requiredTagText}>Mandatory</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.docSubtitle}>{doc.subtitle}</Text>
                </View>
                <StatusBadge status={status} size="sm" />
              </View>

              {docData?.submittedAt ? (
                <Text style={styles.docDate}>
                  Submitted: {new Date(docData.submittedAt).toLocaleDateString()}
                </Text>
              ) : null}

              {docData?.rejectionReason ? (
                <View style={styles.rejectNotice}>
                  <Ionicons name="information-circle" size={14} color={theme.colors.danger} />
                  <Text style={styles.rejectNoticeText}>
                    {docData.rejectionReason}
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => onUploadDocument && onUploadDocument(doc.key, doc.title)}
                disabled={isUploading}
                style={({ pressed }) => [
                  styles.uploadBtn,
                  status === 'approved' && styles.uploadBtnApproved,
                  pressed && styles.uploadBtnPressed
                ]}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <>
                    <Ionicons
                      name={status === 'not_uploaded' ? 'cloud-upload-outline' : 'repeat-outline'}
                      size={16}
                      color={status === 'approved' ? theme.colors.muted : theme.colors.primary}
                    />
                    <Text
                      style={[
                        styles.uploadBtnText,
                        status === 'approved' && styles.uploadBtnTextApproved
                      ]}
                    >
                      {status === 'not_uploaded' ? 'Upload Document' : 'Replace Document'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: theme.colors.bg
  },
  contentContainer: {
    flexGrow: 1,
    padding: theme.spacing.md,
    paddingBottom: 120,
    gap: theme.spacing.md
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    ...theme.shadows.card
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md
  },
  avatarBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${theme.colors.primary}20`,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarLetter: {
    color: theme.colors.primary,
    fontSize: 22,
    fontWeight: theme.typography.weights.extrabold
  },
  agencyTitle: {
    color: theme.colors.ink,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold
  },
  agencyOwnerText: {
    color: theme.colors.muted,
    fontSize: theme.typography.sizes.xs
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border
  },
  detailsList: {
    gap: theme.spacing.sm
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  detailLabel: {
    color: theme.colors.muted,
    fontSize: theme.typography.sizes.xs
  },
  detailValue: {
    color: theme.colors.ink,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    maxWidth: '60%',
    textAlign: 'right'
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: theme.spacing.xs,
    paddingVertical: 9,
    borderRadius: theme.radius.sm,
    backgroundColor: `${theme.colors.primary}15`,
    borderWidth: 1,
    borderColor: `${theme.colors.primary}30`
  },
  editButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold
  },
  formContainer: {
    gap: theme.spacing.sm
  },
  inputGroup: {
    gap: 4
  },
  inputLabel: {
    color: theme.colors.ink,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold
  },
  textInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: theme.colors.ink,
    fontSize: theme.typography.sizes.sm
  },
  multilineInput: {
    minHeight: 64,
    textAlignVertical: 'top'
  },
  formActionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: 4
  },
  cancelButton: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    alignItems: 'center'
  },
  cancelButtonText: {
    color: theme.colors.muted,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold
  },
  saveButton: {
    flex: 2,
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    alignItems: 'center'
  },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold
  },
  kycStatusCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    ...theme.shadows.card
  },
  kycStatusHeader: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'flex-start'
  },
  kycStatusTitle: {
    color: theme.colors.ink,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    marginBottom: 2
  },
  kycStatusSubtitle: {
    color: theme.colors.muted,
    fontSize: theme.typography.sizes.xs,
    lineHeight: 18
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.xs
  },
  sectionTitle: {
    color: theme.colors.ink,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold
  },
  sectionHint: {
    color: theme.colors.muted,
    fontSize: theme.typography.sizes.xs
  },
  docsList: {
    gap: theme.spacing.sm
  },
  docCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.card
  },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm
  },
  docIconBox: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.sm,
    backgroundColor: `${theme.colors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center'
  },
  docTitle: {
    color: theme.colors.ink,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold
  },
  requiredTag: {
    backgroundColor: `${theme.colors.accent}20`,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radius.xs
  },
  requiredTagText: {
    color: theme.colors.accent,
    fontSize: 9,
    fontWeight: theme.typography.weights.bold
  },
  docSubtitle: {
    color: theme.colors.muted,
    fontSize: theme.typography.sizes.xs
  },
  docDate: {
    color: theme.colors.muted,
    fontSize: 11
  },
  rejectNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${theme.colors.danger}15`,
    padding: 8,
    borderRadius: theme.radius.xs
  },
  rejectNoticeText: {
    color: theme.colors.danger,
    fontSize: theme.typography.sizes.xs,
    flex: 1
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 9,
    borderRadius: theme.radius.sm,
    minHeight: 40
  },
  uploadBtnApproved: {
    borderColor: theme.colors.border,
    opacity: 0.8
  },
  uploadBtnPressed: {
    opacity: 0.8
  },
  uploadBtnText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold
  },
  uploadBtnTextApproved: {
    color: theme.colors.muted
  }
});
