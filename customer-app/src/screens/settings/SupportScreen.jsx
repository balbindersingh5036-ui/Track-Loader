import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, View, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import complaintService from "../../services/complaintService";
import configService from "../../services/configService";
import { getErrorMessage } from "../../utils/errorMessage";
import { Button, Card, Empty, Field, Heading, Loading, Notice, Screen, Status } from "../../components/Phase12UI";
import { colors, shadows } from "../../theme/theme";

export default function SupportScreen({ route }) {
  const [supportPhone, setSupportPhone] = useState(route?.params?.supportPhone || "");
  const [supportEmail, setSupportEmail] = useState(route?.params?.supportEmail || "");
  const [bookingId, setBookingId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadComplaints = useCallback(async () => {
    setError("");
    try {
      const result = await complaintService.getMyComplaints({ page: 1, limit: 30 });
      setComplaints(result.complaints || []);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    configService
      .getPublicConfig()
      .then((config) => {
        setSupportPhone((current) => current || config["system.supportPhone"] || "+91 99999 99999");
        setSupportEmail((current) => current || config["system.supportEmail"] || "support@loadbalbin.com");
      })
      .catch((requestError) => setError(getErrorMessage(requestError)));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadComplaints();
    }, [loadComplaints])
  );

  const submitComplaint = async () => {
    if (submitting) return;
    setError("");
    setNotice("");
    if (!subject.trim() || !description.trim()) {
      setError("Please fill out both the subject and issue description.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        subject: subject.trim(),
        description: description.trim()
      };
      if (bookingId.trim()) payload.bookingId = bookingId.trim();

      await complaintService.createComplaint(payload);
      setSubject("");
      setDescription("");
      setBookingId("");
      setNotice("Your complaint ticket has been submitted. Our support team will review it.");
      await loadComplaints();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const showDetails = (complaint) => {
    Alert.alert(
      complaint.subject,
      `Status: ${complaint.status.toUpperCase()}\n\nDescription:\n${complaint.description}${
        complaint.adminResponse ? `\n\nSupport Response:\n${complaint.adminResponse}` : "\n\n(Awaiting review)"
      }`
    );
  };

  return (
    <Screen>
      <Heading
        title="Support & Inquiries"
        subtitle="Contact our customer service team or file a complaint ticket."
      />

      {/* SUPPORT DIRECT CONTACT */}
      <Card>
        <Text style={styles.cardHeaderTitle}>Contact Customer Support</Text>
        <View style={styles.contactRow}>
          <View style={styles.contactItem}>
            <Ionicons name="call-outline" size={18} color={colors.primary} />
            <View>
              <Text style={styles.contactLabel}>Helpline</Text>
              <Text style={styles.contactVal}>{supportPhone || "+91 99999 99999"}</Text>
            </View>
          </View>

          <View style={styles.contactItem}>
            <Ionicons name="mail-outline" size={18} color={colors.primary} />
            <View>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactVal}>{supportEmail || "support@loadbalbin.com"}</Text>
            </View>
          </View>
        </View>
      </Card>

      {/* COMPLAINT SUBMISSION FORM */}
      <Card>
        <Text style={styles.cardHeaderTitle}>Submit a Complaint Ticket</Text>
        <Text style={styles.cardHeaderSub}>
          Experiencing an issue with a delivery or driver? Let us know.
        </Text>

        <Field
          label="Booking Reference (Optional)"
          value={bookingId}
          onChangeText={setBookingId}
          placeholder="e.g. BK-12345"
          icon={<Ionicons name="barcode-outline" size={18} color={colors.textMuted} />}
        />

        <Field
          label="Subject / Topic"
          value={subject}
          onChangeText={setSubject}
          placeholder="Brief summary of the issue"
          icon={<Ionicons name="alert-circle-outline" size={18} color={colors.textMuted} />}
        />

        <Field
          label="Detailed Description"
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Describe what happened with as much detail as possible..."
          icon={<Ionicons name="document-text-outline" size={18} color={colors.textMuted} />}
        />

        {error ? <Notice message={error} /> : null}
        {notice ? <Notice message={notice} tone="success" /> : null}

        <Button
          title="Submit Complaint Ticket"
          loading={submitting}
          disabled={!subject.trim() || !description.trim()}
          onPress={submitComplaint}
          style={{ marginTop: 4 }}
        />
      </Card>

      {/* PAST COMPLAINTS HISTORY */}
      <Heading
        title="My Tickets"
        subtitle="Recent complaints and support responses."
        style={{ marginTop: 6 }}
      />

      {loading ? (
        <Loading label="Loading complaints..." />
      ) : complaints.length === 0 ? (
        <Empty
          icon="checkmark-circle-outline"
          title="No Active Complaints"
          detail="You haven't filed any support complaints."
        />
      ) : (
        <View style={styles.complaintList}>
          {complaints.map((item) => (
            <Pressable
              key={item._id}
              style={[styles.complaintCard, shadows.soft]}
              onPress={() => showDetails(item)}
            >
              <View style={styles.complaintTopRow}>
                <Text style={styles.complaintSubject} numberOfLines={1}>
                  {item.subject}
                </Text>
                <Status value={item.status} />
              </View>

              <Text style={styles.complaintDesc} numberOfLines={2}>
                {item.description}
              </Text>

              {item.adminResponse ? (
                <View style={styles.responseBox}>
                  <Text style={styles.responseLabel}>Support response received</Text>
                  <Text style={styles.responseText} numberOfLines={2}>
                    {item.adminResponse}
                  </Text>
                </View>
              ) : null}

              <View style={styles.complaintFooter}>
                <Text style={styles.complaintDate}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                </Text>
                <Text style={styles.viewDetailsLink}>View Details →</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardHeaderTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  cardHeaderSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: -4,
    marginBottom: 4
  },
  contactRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4
  },
  contactItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 10,
    gap: 10
  },
  contactLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "500"
  },
  contactVal: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700"
  },
  complaintList: {
    gap: 12
  },
  complaintCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 8
  },
  complaintTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  complaintSubject: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  complaintDesc: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  responseBox: {
    backgroundColor: colors.successBg,
    borderRadius: 8,
    padding: 10,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.successBorder
  },
  responseLabel: {
    color: colors.successText,
    fontSize: 11,
    fontWeight: "700"
  },
  responseText: {
    color: colors.successText,
    fontSize: 12,
    lineHeight: 16
  },
  complaintFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
    paddingTop: 8,
    marginTop: 2
  },
  complaintDate: {
    color: colors.textMuted,
    fontSize: 11
  },
  viewDetailsLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700"
  }
});
