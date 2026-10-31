import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import authService from '../../services/authService';
import agencyService from '../../services/agencyService';

const colors = {
  ink: '#FFFFFF',
  muted: '#8A98A8',
  border: '#25364A',
  bg: '#08111F',
  danger: '#EF4444',
  primary: '#08A9F5',
  accent: '#FF7A00',
  surface: '#0F1B29',
  card: '#142334'
};

const inputStyle = {
  borderColor: colors.border,
  borderWidth: 1,
  borderRadius: 10,
  padding: 14,
  color: colors.ink,
  backgroundColor: colors.card,
  fontSize: 15
};

const agencyDocuments = [
  { key: 'ownerAadhaar', label: 'Owner Aadhaar', required: true },
  { key: 'businessRegistration', label: 'Business Registration' },
  { key: 'tradeLicense', label: 'Trade Licence' },
  { key: 'gstCertificate', label: 'GST Certificate' },
  { key: 'taxId', label: 'Tax ID / PAN' }
];

const errorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'The request could not be completed.';

export default function AgencyRegistrationScreen({ onCancel, onRegistered }) {
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [agencyPhone, setAgencyPhone] = useState('');
  const [agencyEmail, setAgencyEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [documents, setDocuments] = useState({});
  const [accountToken, setAccountToken] = useState('');
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const chooseDocument = async (document) => {
    setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false
      });
      if (result.canceled) return;
      const file = result.assets?.[0];
      if (!file) throw new Error('The file picker did not return a document.');
      if (file.size > 5 * 1024 * 1024) throw new Error('Choose a file smaller than 5 MB.');
      const extension = file.name?.split('.').pop()?.toLowerCase();
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      const mimeType = file.mimeType?.toLowerCase() === 'image/jpg' ? 'image/jpeg' : file.mimeType?.toLowerCase();
      if ((extension && !allowedExtensions.includes(extension)) || (mimeType && !allowedMimeTypes.includes(mimeType))) {
        throw new Error('Choose a JPEG, PNG, WebP, or PDF document.');
      }
      setDocuments((current) => ({ ...current, [document.key]: file }));
    } catch (pickerError) {
      setError(errorMessage(pickerError));
    }
  };

  const submit = async () => {
    if (submitting) return;
    setError('');
    if (!accountToken && (!ownerName.trim() || !ownerPhone.trim() || password.length < 6)) {
      setError('Enter the owner name and phone number, and use a password of at least 6 characters.');
      return;
    }
    if (!agencyName.trim() || !agencyPhone.trim()) {
      setError('Agency name and agency contact phone are required.');
      return;
    }
    if (!documents.ownerAadhaar) {
      setError('Owner Aadhaar is required to register an agency.');
      return;
    }

    setSubmitting(true);
    let agencyCreated = false;
    try {
      let token = accountToken;
      if (!token) {
        const accountResponse = await authService.registerCustomer({
          name: ownerName.trim(),
          phone: ownerPhone.trim(),
          email: ownerEmail.trim() || undefined,
          password
        });
        token = accountResponse.data?.data?.token;
        if (!token) throw new Error('The owner account response did not include a session token.');
        setAccountToken(token);
      }

      await agencyService.registerAgency({
        agencyName: agencyName.trim(),
        phone: agencyPhone.trim(),
        email: agencyEmail.trim() || ownerEmail.trim(),
        address: address.trim(),
        city: city.trim()
      }, documents, token);
      agencyCreated = true;
      setRegistrationComplete(true);
      try {
        await onRegistered(token);
      } catch {
        setError('Agency registration succeeded, but the profile could not be loaded. Return to sign in and log in as an Agency Owner.');
      }
    } catch (submitError) {
      setError(agencyCreated
        ? 'Agency registration succeeded, but automatic sign in failed. Return to sign in and log in as an Agency Owner.'
        : accountToken
        ? errorMessage(submitError)
        : `${errorMessage(submitError)} If the owner account was created, keep this screen open and retry the agency application.`);
    } finally {
      setSubmitting(false);
    }
  };

  const field = (label, value, setValue, options = {}) => (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.ink, fontWeight: '700' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={options.placeholder || label}
        placeholderTextColor={colors.muted}
        keyboardType={options.keyboardType || 'default'}
        autoCapitalize={options.autoCapitalize || 'sentences'}
        secureTextEntry={Boolean(options.secureTextEntry)}
        multiline={Boolean(options.multiline)}
        style={[inputStyle, options.multiline ? { minHeight: 76, textAlignVertical: 'top' } : null]}
      />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
          <View style={{ backgroundColor: colors.surface, padding: 20, borderRadius: 16, gap: 14, borderColor: colors.border, borderWidth: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: '800', color: colors.ink }}>Agency Owner registration</Text>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
              The owner account and agency will be registered separately. Owner Aadhaar is required; other agency documents are optional. All submitted documents remain pending Super Admin review.
            </Text>

            <Text style={{ color: colors.primary, fontWeight: '800', marginTop: 4 }}>OWNER ACCOUNT</Text>
            {field('Owner full name', ownerName, setOwnerName)}
            {field('Owner phone', ownerPhone, setOwnerPhone, { keyboardType: 'phone-pad' })}
            {field('Owner email (optional)', ownerEmail, setOwnerEmail, { keyboardType: 'email-address', autoCapitalize: 'none' })}
            {!accountToken ? field('Password (minimum 6 characters)', password, setPassword, { secureTextEntry: true, autoCapitalize: 'none' }) : (
              <Text style={{ color: colors.primary, fontSize: 12 }}>Owner account created. Complete the agency application to finish registration.</Text>
            )}

            <Text style={{ color: colors.primary, fontWeight: '800', marginTop: 4 }}>AGENCY DETAILS</Text>
            {field('Agency / business name', agencyName, setAgencyName)}
            {field('Agency contact phone', agencyPhone, setAgencyPhone, { keyboardType: 'phone-pad' })}
            {field('Agency email (optional)', agencyEmail, setAgencyEmail, { keyboardType: 'email-address', autoCapitalize: 'none' })}
            {field('Business address', address, setAddress, { multiline: true })}
            {field('City', city, setCity)}

            <Text style={{ color: colors.primary, fontWeight: '800', marginTop: 4 }}>AGENCY KYC</Text>
            {agencyDocuments.map((document) => (
              <View key={document.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontWeight: '700' }}>{document.label}{document.required ? ' *' : ' (optional)'}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }} numberOfLines={1}>
                    {documents[document.key]?.name || 'No document selected'}
                  </Text>
                </View>
                <Pressable onPress={() => chooseDocument(document)} style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, padding: 10, borderRadius: 8 }}>
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>{documents[document.key] ? 'Replace' : 'Choose'}</Text>
                </Pressable>
              </View>
            ))}

            {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, lineHeight: 18 }}>{error}</Text> : null}
            {submitting ? <ActivityIndicator color={colors.primary} /> : null}
            <Pressable onPress={submit} disabled={submitting || registrationComplete} style={{ backgroundColor: colors.accent, borderRadius: 12, padding: 15, alignItems: 'center', opacity: submitting || registrationComplete ? 0.6 : 1 }}>
              <Text style={{ color: colors.ink, fontWeight: '800' }}>{submitting ? 'Submitting...' : registrationComplete ? 'Registration submitted' : 'Submit agency registration'}</Text>
            </Pressable>
            <Pressable onPress={onCancel} disabled={submitting} style={{ padding: 10, alignItems: 'center' }}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>{registrationComplete ? 'Continue to sign in' : 'Back to sign in'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
