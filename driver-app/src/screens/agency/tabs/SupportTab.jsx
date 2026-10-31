import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../components/AgencyTheme';

const FAQS = [
  {
    q: 'How does Driver Dual-Approval work?',
    a: 'When a driver requests to join your agency or you register them, you first approve their joining request. Subsequently, Super Admin performs KYC and document verification (Aadhaar & DL). Only drivers with both approvals can be assigned to trips.'
  },
  {
    q: 'Why is a driver ineligible for vehicle assignment?',
    a: 'To be assigned to a vehicle, a driver must: 1) Have their joining accepted by you, 2) Have Super Admin final approval, 3) Have approved Aadhaar & Driving Licence, 4) Be active and not assigned to another vehicle.'
  },
  {
    q: 'Can Agency Admins start or complete trips?',
    a: 'No. To ensure safety and audit compliance, the Agency Owner assigns the driver and vehicle to the booking. The assigned driver must independently accept the trip, collect the pickup OTP from the customer, and complete delivery.'
  },
  {
    q: 'What vehicle documents are required?',
    a: 'Every vehicle in your fleet must have an approved Registration Certificate (RC) and valid Commercial Insurance. You can upload or renew them directly under the Fleet Vehicles tab.'
  },
  {
    q: 'How are booking payouts processed?',
    a: 'Gross booking volumes reflect completed trips. Official disbursements and commission settlements follow your contracted weekly settlement cycle directly to your registered agency bank account.'
  }
];

export default function SupportTab() {
  const [expandedFaq, setExpandedFaq] = useState(null);

  const toggleFaq = (index) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const handleCallSupport = () => {
    Linking.openURL('tel:18001234567').catch(() => {});
  };

  const handleEmailSupport = () => {
    Linking.openURL('mailto:support@loadbalbin.com?subject=LoadBalbin%20Agency%20Support').catch(() => {});
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. SUPPORT BANNER */}
      <View style={styles.heroCard}>
        <View style={styles.heroIconBox}>
          <Ionicons name="headset" size={28} color={theme.colors.teal} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.heroTitle}>Fleet Partner Support</Text>
          <Text style={styles.heroSubtitle}>
            Dedicated 24/7 assistance for fleet dispatch, driver KYC verification, and operations.
          </Text>
        </View>
      </View>

      {/* 2. DIRECT CONTACT BUTTONS */}
      <View style={styles.contactRow}>
        <Pressable
          onPress={handleCallSupport}
          style={({ pressed }) => [styles.contactCard, pressed && styles.cardPressed]}
        >
          <View style={[styles.contactIconCircle, { backgroundColor: `${theme.colors.green}18` }]}>
            <Ionicons name="call-outline" size={20} color={theme.colors.green} />
          </View>
          <Text style={styles.contactTitle}>Toll Free</Text>
          <Text style={styles.contactDetail}>1800-123-4567</Text>
        </Pressable>

        <Pressable
          onPress={handleEmailSupport}
          style={({ pressed }) => [styles.contactCard, pressed && styles.cardPressed]}
        >
          <View style={[styles.contactIconCircle, { backgroundColor: `${theme.colors.primary}18` }]}>
            <Ionicons name="mail-outline" size={20} color={theme.colors.primary} />
          </View>
          <Text style={styles.contactTitle}>Email Us</Text>
          <Text style={styles.contactDetail}>support@loadbalbin.com</Text>
        </Pressable>
      </View>

      {/* 3. PLATFORM OPERATIONAL PROTOCOL */}
      <View style={styles.protocolCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="shield-outline" size={18} color={theme.colors.accent} />
          <Text style={styles.protocolTitle}>Fleet Dispatch Protocol</Text>
        </View>
        <Text style={styles.protocolText}>
          LoadBalbin enforces strict separation of agency dispatch and driver trip execution. Vehicle assignment must adhere to load capacity limits. Drivers are strictly prohibited from sharing credentials or operating unassigned vehicles.
        </Text>
      </View>

      {/* 4. FREQUENTLY ASKED QUESTIONS */}
      <Text style={styles.sectionHeading}>Frequently Asked Questions</Text>

      <View style={styles.faqList}>
        {FAQS.map((faq, index) => {
          const isExpanded = expandedFaq === index;
          return (
            <Pressable
              key={index}
              onPress={() => toggleFaq(index)}
              style={styles.faqCard}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQuestion}>{faq.q}</Text>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.colors.muted}
                />
              </View>
              {isExpanded && (
                <Text style={styles.faqAnswer}>{faq.a}</Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* 5. APP METADATA FOOTER */}
      <View style={styles.footer}>
        <Text style={styles.footerBrand}>LoadBalbin Logistics Partner App</Text>
        <Text style={styles.footerVersion}>Version 2.4.0 • Enterprise Fleet Build</Text>
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
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    ...theme.shadows.card
  },
  heroIconBox: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: `${theme.colors.teal}18`,
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroTitle: {
    color: theme.colors.ink,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold
  },
  heroSubtitle: {
    color: theme.colors.muted,
    fontSize: theme.typography.sizes.xs,
    lineHeight: 18
  },
  contactRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm
  },
  contactCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    alignItems: 'center',
    gap: 6,
    ...theme.shadows.card
  },
  cardPressed: {
    opacity: 0.8
  },
  contactIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2
  },
  contactTitle: {
    color: theme.colors.ink,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold
  },
  contactDetail: {
    color: theme.colors.muted,
    fontSize: 11
  },
  protocolCard: {
    backgroundColor: `${theme.colors.surface}`,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.xs
  },
  protocolTitle: {
    color: theme.colors.ink,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold
  },
  protocolText: {
    color: theme.colors.muted,
    fontSize: theme.typography.sizes.xs,
    lineHeight: 18
  },
  sectionHeading: {
    color: theme.colors.ink,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    marginTop: theme.spacing.xs
  },
  faqList: {
    gap: theme.spacing.sm
  },
  faqCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
    ...theme.shadows.card
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm
  },
  faqQuestion: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold
  },
  faqAnswer: {
    color: theme.colors.muted,
    fontSize: theme.typography.sizes.xs,
    lineHeight: 18,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border
  },
  footer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    gap: 4
  },
  footerBrand: {
    color: theme.colors.muted,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold
  },
  footerVersion: {
    color: `${theme.colors.muted}99`,
    fontSize: 11
  }
});
