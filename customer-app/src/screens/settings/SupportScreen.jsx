import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import complaintService from "../../services/complaintService";
import bookingService from "../../services/bookingService";
import configService from "../../services/configService";
import { getErrorMessage } from "../../utils/errorMessage";
import {
  Button,
  Card,
  Empty,
  Field,
  Heading,
  Loading,
  Notice,
  Screen,
  Status
} from "../../components/Phase12UI";
import { colors, shadows } from "../../theme/theme";

export default function SupportScreen({ route }) {
  const [supportPhone, setSupportPhone] = useState(route?.params?.supportPhone || "");
  const [supportEmail, setSupportEmail] = useState(route?.params?.supportEmail || "");
  const [bookingId, setBookingId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [complaints, setComplaints] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [bookingPickerVisible, setBookingPickerVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadComplaints = useCallback(async () => {
    setError("");
    try {
      const result = await complaintService.getMyComplaints({ page: 1, limit: 50 });
      setComplaints(result.complaints || []);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCustomerBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const res = await bookingService.getMyBookings({ page: 1, limit: 30 });
      const list = res.bookings || res || [];
      setMyBookings(Array.isArray(list) ? list : []);
    } catch (err) {
      // Non-blocking: manual input is still supported
      console.warn("Failed to load customer bookings for dropdown:", err);
    } finally {
      setLoadingBookings(false);
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
      loadCustomerBookings();
    }, [loadComplaints, loadCustomerBookings])
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
      const trimmedRef = bookingId.trim();
      if (trimmedRef) {
        payload.bookingId = trimmedRef;
        payload.bookingReference = trimmedRef;
      }

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

  const openDetails = (complaint) => {
    setSelectedTicket(complaint);
    setDetailModalVisible(true);
  };

  const getTicketDisplayId = (item) => {
    if (item.ticketId) return item.ticketId;
    if (item._id) return `TKT-${String(item._id).slice(-5).toUpperCase()}`;
    return "TKT-NEW";
  };

  const getBookingDisplayNumber = (item) => {
    return item.bookingReference || item.bookingNumber || item.booking?.bookingId || null;
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

        {/* BOOKING SELECTION HELPER */}
        <View style={styles.bookingSelectSection}>
          <View style={styles.bookingHeaderRow}>
            <Text style={styles.fieldLabel}>Booking Number (Optional)</Text>
            {myBookings.length > 0 && (
              <Pressable
                style={styles.pickBookingButton}
                onPress={() => setBookingPickerVisible(true)}
              >
                <Ionicons name="list-outline" size={14} color={colors.primary} />
                <Text style={styles.pickBookingText}>Select from My Bookings</Text>
              </Pressable>
            )}
          </View>

          <Field
            value={bookingId}
            onChangeText={setBookingId}
            placeholder="e.g. BOOKING-0026 or leave blank"
            icon={<Ionicons name="barcode-outline" size={18} color={colors.textMuted} />}
          />

          {bookingId.trim() ? (
            <View style={styles.selectedBookingBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.selectedBookingText}>
                Linked to: <Text style={{ fontWeight: "700" }}>{bookingId.trim()}</Text>
              </Text>
              <Pressable onPress={() => setBookingId("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : (
            <Text style={styles.unlinkedHint}>
              No booking selected — this ticket will be filed as a general inquiry.
            </Text>
          )}
        </View>

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
          {complaints.map((item) => {
            const ticketIdText = getTicketDisplayId(item);
            const bookingNumber = getBookingDisplayNumber(item);

            return (
              <Pressable
                key={item._id}
                style={[styles.complaintCard, shadows.soft]}
                onPress={() => openDetails(item)}
              >
                {/* TICKET ID & STATUS HEADER */}
                <View style={styles.complaintTopRow}>
                  <View style={styles.ticketIdBadge}>
                    <Ionicons name="pricetag-outline" size={13} color={colors.textMuted} />
                    <Text style={styles.ticketIdText}>Ticket ID: {ticketIdText}</Text>
                  </View>
                  <Status value={item.status} />
                </View>

                {/* BOOKING NUMBER ROW */}
                <View style={styles.bookingNumberRow}>
                  <Ionicons
                    name={bookingNumber ? "cube-outline" : "information-circle-outline"}
                    size={14}
                    color={bookingNumber ? colors.primary : colors.textMuted}
                  />
                  {bookingNumber ? (
                    <Text style={styles.bookingNumberActive}>
                      Booking Number: <Text style={styles.bookingNumberBold}>{bookingNumber}</Text>
                    </Text>
                  ) : (
                    <Text style={styles.bookingNumberUnlinked}>Not linked to a booking</Text>
                  )}
                </View>

                {/* SUBJECT */}
                <Text style={styles.complaintSubject} numberOfLines={1}>
                  {item.subject}
                </Text>

                {/* DESCRIPTION */}
                <Text style={styles.complaintDesc} numberOfLines={2}>
                  {item.description}
                </Text>

                {/* ADMIN RESPONSE (IF ANY) */}
                {item.adminResponse ? (
                  <View style={styles.responseBox}>
                    <Text style={styles.responseLabel}>Support response received</Text>
                    <Text style={styles.responseText} numberOfLines={2}>
                      {item.adminResponse}
                    </Text>
                  </View>
                ) : null}

                {/* FOOTER */}
                <View style={styles.complaintFooter}>
                  <Text style={styles.complaintDate}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                  </Text>
                  <Text style={styles.viewDetailsLink}>View Details →</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* BOOKING PICKER MODAL */}
      <Modal
        visible={bookingPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBookingPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadows.medium]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select a Booking</Text>
              <Pressable
                onPress={() => setBookingPickerVisible(false)}
                hitSlop={12}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
            <Text style={styles.modalSubtitle}>
              Link your complaint directly to one of your recent deliveries.
            </Text>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* CLEAR SELECTION OPTION */}
              <Pressable
                style={[
                  styles.bookingItem,
                  !bookingId.trim() && styles.bookingItemSelected
                ]}
                onPress={() => {
                  setBookingId("");
                  setBookingPickerVisible(false);
                }}
              >
                <View style={styles.bookingItemContent}>
                  <Text style={styles.bookingItemTitle}>General Inquiry / No Booking</Text>
                  <Text style={styles.bookingItemSub}>
                    File ticket without linking to a specific delivery
                  </Text>
                </View>
                {!bookingId.trim() && (
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                )}
              </Pressable>

              {/* BOOKINGS LIST */}
              {myBookings.map((b) => {
                const bId = b.bookingId || b._id;
                const isSelected = bookingId.trim().toUpperCase() === String(bId).trim().toUpperCase();
                return (
                  <Pressable
                    key={b._id}
                    style={[styles.bookingItem, isSelected && styles.bookingItemSelected]}
                    onPress={() => {
                      setBookingId(b.bookingId || String(b._id));
                      setBookingPickerVisible(false);
                    }}
                  >
                    <View style={styles.bookingItemContent}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.bookingItemCode}>{b.bookingId || b._id}</Text>
                        <Text style={styles.bookingItemStatus}>({b.bookingStatus || "pending"})</Text>
                      </View>
                      <Text style={styles.bookingItemSub} numberOfLines={1}>
                        {b.vehicleType ? b.vehicleType.toUpperCase() : "Delivery"} • {b.createdAt ? new Date(b.createdAt).toLocaleDateString() : ""}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* TICKET DETAILS MODAL */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.detailModalCard, shadows.medium]}>
            {selectedTicket && (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>Ticket Details</Text>
                    <Text style={styles.detailTicketId}>
                      Ticket ID: {getTicketDisplayId(selectedTicket)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setDetailModalVisible(false)}
                    hitSlop={12}
                    style={styles.modalCloseBtn}
                  >
                    <Ionicons name="close" size={20} color={colors.text} />
                  </Pressable>
                </View>

                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                  {/* BOOKING NUMBER BADGE */}
                  <View style={styles.detailSectionBox}>
                    <Text style={styles.detailSectionLabel}>Associated Delivery</Text>
                    {getBookingDisplayNumber(selectedTicket) ? (
                      <View style={styles.detailBookingRow}>
                        <Ionicons name="cube-outline" size={16} color={colors.primary} />
                        <Text style={styles.detailBookingVal}>
                          Booking Number: <Text style={{ fontWeight: "700" }}>{getBookingDisplayNumber(selectedTicket)}</Text>
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.bookingNumberUnlinked}>Not linked to a booking</Text>
                    )}
                  </View>

                  {/* STATUS & DATE */}
                  <View style={styles.detailMetaGrid}>
                    <View style={styles.detailMetaItem}>
                      <Text style={styles.detailSectionLabel}>Status</Text>
                      <Status value={selectedTicket.status} />
                    </View>
                    <View style={styles.detailMetaItem}>
                      <Text style={styles.detailSectionLabel}>Submitted On</Text>
                      <Text style={styles.detailMetaValue}>
                        {selectedTicket.createdAt ? new Date(selectedTicket.createdAt).toLocaleString() : "—"}
                      </Text>
                    </View>
                  </View>

                  {/* SUBJECT */}
                  <View style={styles.detailSectionBox}>
                    <Text style={styles.detailSectionLabel}>Subject</Text>
                    <Text style={styles.detailSubjectText}>{selectedTicket.subject}</Text>
                  </View>

                  {/* DESCRIPTION */}
                  <View style={styles.detailSectionBox}>
                    <Text style={styles.detailSectionLabel}>Description</Text>
                    <Text style={styles.detailDescText}>{selectedTicket.description}</Text>
                  </View>

                  {/* SUPPORT RESPONSE */}
                  <View style={styles.detailSectionBox}>
                    <Text style={styles.detailSectionLabel}>Support Response</Text>
                    {selectedTicket.adminResponse ? (
                      <View style={styles.responseBox}>
                        <Text style={styles.responseText}>{selectedTicket.adminResponse}</Text>
                      </View>
                    ) : (
                      <Text style={styles.detailAwaitingText}>(Awaiting review by customer support)</Text>
                    )}
                  </View>
                </ScrollView>

                <Button
                  title="Close"
                  onPress={() => setDetailModalVisible(false)}
                  style={{ marginTop: 14 }}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
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
  bookingSelectSection: {
    marginBottom: 4
  },
  bookingHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600"
  },
  pickBookingButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.surfaceAlt
  },
  pickBookingText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600"
  },
  selectedBookingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 6
  },
  selectedBookingText: {
    flex: 1,
    color: colors.text,
    fontSize: 12
  },
  unlinkedHint: {
    color: colors.textMuted,
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 2,
    marginBottom: 6
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
  ticketIdBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  ticketIdText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  bookingNumberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2
  },
  bookingNumberActive: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "500"
  },
  bookingNumberBold: {
    fontWeight: "700",
    color: colors.primary
  },
  bookingNumberUnlinked: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: "italic"
  },
  complaintSubject: {
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16
  },
  modalCard: {
    width: "100%",
    maxHeight: "80%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16
  },
  detailModalCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text
  },
  detailTicketId: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
    marginTop: 2
  },
  modalCloseBtn: {
    padding: 4
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12
  },
  modalScroll: {
    maxHeight: 320
  },
  bookingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "transparent"
  },
  bookingItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surface
  },
  bookingItemContent: {
    flex: 1,
    gap: 2
  },
  bookingItemTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text
  },
  bookingItemCode: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary
  },
  bookingItemStatus: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: "uppercase"
  },
  bookingItemSub: {
    fontSize: 11,
    color: colors.textMuted
  },
  detailSectionBox: {
    marginTop: 10
  },
  detailSectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 4
  },
  detailBookingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  detailBookingVal: {
    fontSize: 13,
    color: colors.primary
  },
  detailMetaGrid: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10
  },
  detailMetaItem: {
    flex: 1
  },
  detailMetaValue: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "500"
  },
  detailSubjectText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text
  },
  detailDescText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18
  },
  detailAwaitingText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: "italic"
  }
});
