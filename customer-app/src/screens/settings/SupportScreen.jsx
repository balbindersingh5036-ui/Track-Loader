import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import complaintService from "../../services/complaintService";
import configService from "../../services/configService";
import { getErrorMessage } from "../../utils/errorMessage";
import { Button, Card, Empty, Field, Heading, Loading, Notice, Screen, styles } from "../../components/Phase12UI";

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
    configService.getPublicConfig().then((config) => {
      setSupportPhone((current) => current || config["system.supportPhone"] || "");
      setSupportEmail((current) => current || config["system.supportEmail"] || "");
    }).catch((requestError) => setError(getErrorMessage(requestError)));
  }, []);

  useFocusEffect(useCallback(() => {
    loadComplaints();
  }, [loadComplaints]));

  const submitComplaint = async () => {
    if (submitting) return;
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      const payload = { subject: subject.trim(), description: description.trim() };
      if (bookingId.trim()) payload.bookingId = bookingId.trim();
      await complaintService.createComplaint(payload);
      setSubject("");
      setDescription("");
      setBookingId("");
      setNotice("Your complaint was submitted.");
      await loadComplaints();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const showDetails = async (id) => {
    setError("");
    try {
      const complaint = await complaintService.getComplaint(id);
      Alert.alert(
        complaint.subject,
        `Status: ${complaint.status}\n\n${complaint.description}${complaint.adminResponse ? `\n\nSupport response:\n${complaint.adminResponse}` : ""}`
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  return (
    <Screen>
      <Heading title="Support and complaints" subtitle="Get in touch or send a complaint about your experience." />
      <Card>
        <Text style={styles.cardTitle}>Contact support</Text>
        <Text style={styles.muted}>Phone: {supportPhone || "Not provided"}</Text>
        <Text style={styles.muted}>Email: {supportEmail || "Not provided"}</Text>
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Submit a complaint</Text>
        <Field label="Booking ID (optional)" value={bookingId} onChangeText={setBookingId} placeholder="Booking ID" />
        <Field label="Subject" value={subject} onChangeText={setSubject} placeholder="What is the issue?" />
        <Field label="Description" value={description} onChangeText={setDescription} multiline placeholder="Tell us what happened" />
        {error ? <Notice message={error} /> : null}
        {notice ? <Notice message={notice} tone="success" /> : null}
        <Button title="Submit complaint" loading={submitting} disabled={!subject.trim() || !description.trim()} onPress={submitComplaint} />
      </Card>
      <Text style={styles.cardTitle}>My complaints</Text>
      {loading ? <Loading label="Loading complaints..." /> : complaints.length ? complaints.map((complaint) => (
        <Pressable key={complaint._id} onPress={() => showDetails(complaint._id)}>
          <Card>
            <Text style={styles.cardTitle}>{complaint.subject}</Text>
            <Text style={styles.muted}>Status: {complaint.status}</Text>
            <Text style={styles.muted}>{complaint.description}</Text>
            {complaint.adminResponse ? <Text style={styles.muted}>Response: {complaint.adminResponse}</Text> : null}
            <Text style={styles.link}>View details</Text>
          </Card>
        </Pressable>
      )) : <Empty title="No complaints yet" detail="Complaints you submit will appear here." />}
      {!loading ? <Button title="Refresh complaints" secondary onPress={loadComplaints} /> : null}
    </Screen>
  );
}
