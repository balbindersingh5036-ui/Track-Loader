import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View
} from 'react-native';
import authService from '../../services/authService';

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
  fontSize: 16
};

const errorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'The request could not be completed.';

export default function RegisterScreen({ onCancel, onRegistered }) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [agencies, setAgencies] = useState([]);
  const [agencyStatus, setAgencyStatus] = useState('loading');
  const [agencyError, setAgencyError] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [agencyPickerOpen, setAgencyPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadAgencies = async () => {
    setAgencyStatus('loading');
    setAgencyError('');
    try {
      const response = await authService.getVerifiedAgencies();
      const records = response.data?.data?.agencies;
      if (!Array.isArray(records)) throw new Error('Verified agencies were not returned by the service.');
      setAgencies(records);
      setAgencyStatus('loaded');
    } catch (requestError) {
      setAgencyError(errorMessage(requestError));
      setAgencyStatus('error');
    }
  };

  useEffect(() => {
    loadAgencies();
  }, []);

  const selectedAgency = agencies.find((agency) => String(agency._id) === agencyId);
  const agencyLabel = selectedAgency
    ? `${selectedAgency.agencyName}${selectedAgency.city ? ` · ${selectedAgency.city}` : ''}`
    : 'Independent Driver / No Agency';

  const submit = async () => {
    if (submitting) return;
    setError('');
    if (!fullName.trim() || !phone.trim() || password.length < 6) {
      setError('Enter your full name and phone number, and use a password of at least 6 characters.');
      return;
    }
    if (agencyStatus !== 'loaded') {
      setError('Load the verified agency list before submitting. You can retry below.');
      return;
    }

    setSubmitting(true);
    try {
      const details = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        password,
        address: address.trim()
      };
      if (email.trim()) details.email = email.trim();
      if (agencyId) details.agencyId = agencyId;
      await authService.register(details);
      onRegistered();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.surface, padding: 24, borderRadius: 16, gap: 14, borderColor: colors.border, borderWidth: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: '800', color: colors.ink }}>Driver registration</Text>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
              New driver accounts remain pending until reviewed by the Super Admin.
            </Text>

            <Text style={{ color: colors.ink, fontWeight: '700' }}>Full Name</Text>
            <TextInput value={fullName} onChangeText={setFullName} placeholder="Your full name" placeholderTextColor={colors.muted} autoComplete="name" style={inputStyle} />

            <Text style={{ color: colors.ink, fontWeight: '700' }}>Phone Number</Text>
            <TextInput value={phone} onChangeText={setPhone} placeholder="Phone number" placeholderTextColor={colors.muted} keyboardType="phone-pad" autoComplete="tel" style={inputStyle} />

            <Text style={{ color: colors.ink, fontWeight: '700' }}>Email Address (Optional)</Text>
            <TextInput value={email} onChangeText={setEmail} placeholder="name@example.com" placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" autoComplete="email" style={inputStyle} />

            <Text style={{ color: colors.ink, fontWeight: '700' }}>Password</Text>
            <TextInput value={password} onChangeText={setPassword} placeholder="At least 6 characters" placeholderTextColor={colors.muted} secureTextEntry autoCapitalize="none" autoComplete="new-password" style={inputStyle} />

            <Text style={{ color: colors.ink, fontWeight: '700' }}>Address (Optional)</Text>
            <TextInput value={address} onChangeText={setAddress} placeholder="Your address" placeholderTextColor={colors.muted} multiline style={[inputStyle, { minHeight: 54 }]} />

            <Text style={{ color: colors.ink, fontWeight: '700' }}>Select Transport Agency</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAgencyPickerOpen(true)}
              style={[inputStyle, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
            >
              <Text style={{ color: colors.ink, flex: 1 }}>{agencyLabel}</Text>
              <Text style={{ color: colors.muted }}>Choose</Text>
            </Pressable>
            {agencyStatus === 'loading' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ color: colors.muted }}>Loading verified agencies…</Text>
              </View>
            ) : null}
            {agencyStatus === 'error' ? (
              <View style={{ gap: 8 }}>
                <Text accessibilityRole="alert" style={{ color: colors.danger }}>{agencyError}</Text>
                <Pressable accessibilityRole="button" onPress={loadAgencies} style={{ paddingVertical: 8 }}>
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>Retry agency list</Text>
                </Pressable>
              </View>
            ) : null}
            {agencyStatus === 'loaded' && agencies.length === 0 ? (
              <Text style={{ color: colors.muted }}>No verified agencies are currently available. You may register as an independent driver.</Text>
            ) : null}
            {agencyStatus === 'loaded' && agencies.length > 0 ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>Choose an approved agency or keep the independent-driver option.</Text>
            ) : null}

            {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              onPress={submit}
              disabled={submitting || agencyStatus !== 'loaded'}
              style={{ backgroundColor: colors.accent, borderRadius: 12, padding: 14, alignItems: 'center', opacity: submitting || agencyStatus !== 'loaded' ? 0.55 : 1 }}
            >
              <Text style={{ color: colors.ink, fontWeight: '800' }}>{submitting ? 'Submitting…' : 'Submit registration'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onCancel} disabled={submitting} style={{ padding: 10, alignItems: 'center' }}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Back to sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={agencyPickerOpen} transparent animationType="fade" onRequestClose={() => setAgencyPickerOpen(false)}>
        <Pressable onPress={() => setAgencyPickerOpen(false)} style={{ flex: 1, backgroundColor: '#0009', justifyContent: 'center', padding: 24 }}>
          <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 18, maxHeight: '75%', borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800', marginBottom: 12 }}>Select Transport Agency</Text>
            <ScrollView>
              <Pressable
                onPress={() => { setAgencyId(''); setAgencyPickerOpen(false); }}
                style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
              >
                <Text style={{ color: colors.ink, fontWeight: '700' }}>Independent Driver / No Agency</Text>
              </Pressable>
              {agencies.map((agency) => (
                <Pressable
                  key={agency._id}
                  onPress={() => { setAgencyId(String(agency._id)); setAgencyPickerOpen(false); }}
                  style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
                >
                  <Text style={{ color: colors.ink, fontWeight: '700' }}>{agency.agencyName}</Text>
                  {agency.city ? <Text style={{ color: colors.muted, marginTop: 3 }}>{agency.city}</Text> : null}
                </Pressable>
              ))}
              {agencyStatus === 'loading' ? <Text style={{ color: colors.muted, paddingVertical: 14 }}>Loading agency options…</Text> : null}
              {agencyStatus === 'error' ? <Text style={{ color: colors.danger, paddingVertical: 14 }}>Agency options could not be loaded. Close this list and retry.</Text> : null}
              {agencyStatus === 'loaded' && agencies.length === 0 ? <Text style={{ color: colors.muted, paddingVertical: 14 }}>No verified agencies available.</Text> : null}
            </ScrollView>
            <Pressable onPress={() => setAgencyPickerOpen(false)} style={{ padding: 12, alignItems: 'center' }}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
