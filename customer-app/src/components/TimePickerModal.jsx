import React, { useState, useEffect } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/theme";
import { getLocalDateString } from "./DatePickerModal";

const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES_5 = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

export const formatTime12h = (hhmm) => {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return hhmm || "";
  const [hStr, mStr] = hhmm.split(":");
  let hours = parseInt(hStr, 10);
  const meridian = hours >= 12 ? "PM" : "AM";
  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;
  return `${String(hours).padStart(2, "0")}:${mStr} ${meridian}`;
};

export default function TimePickerModal({
  visible,
  onClose,
  selectedTime,
  selectedDate,
  onSelectTime
}) {
  const [tempHour, setTempHour] = useState("12");
  const [tempMinute, setTempMinute] = useState("00");
  const [validationError, setValidationError] = useState("");

  const todayStr = getLocalDateString();
  const isSelectedDateToday = selectedDate === todayStr;

  // Determine earliest valid time for today
  const getEarliestValidTimeToday = () => {
    const now = new Date();
    const curH = now.getHours();
    const curM = now.getMinutes();

    // Find first minute slot in MINUTES_5 that is strictly > curM
    const validMin = MINUTES_5.find((m) => Number(m) > curM);
    if (validMin && curH < 24) {
      return { hour: String(curH).padStart(2, "0"), minute: validMin };
    }
    // Otherwise advance to next hour
    const nextH = Math.min(23, curH + 1);
    return { hour: String(nextH).padStart(2, "0"), minute: "00" };
  };

  useEffect(() => {
    if (visible) {
      setValidationError("");
      const now = new Date();
      const curH = now.getHours();
      const curM = now.getMinutes();

      let initialH = "12";
      let initialM = "00";

      if (selectedTime && /^\d{2}:\d{2}$/.test(selectedTime)) {
        const [h, m] = selectedTime.split(":");
        initialH = h;
        // Snap minute to nearest 5-minute slot
        const mNum = Math.round(Number(m) / 5) * 5;
        initialM = String(mNum >= 60 ? 55 : mNum).padStart(2, "0");
      } else if (isSelectedDateToday) {
        const earliest = getEarliestValidTimeToday();
        initialH = earliest.hour;
        initialM = earliest.minute;
      }

      // Check if initial time is in the past for today
      if (isSelectedDateToday) {
        const isPast =
          Number(initialH) < curH ||
          (Number(initialH) === curH && Number(initialM) <= curM);
        if (isPast) {
          const earliest = getEarliestValidTimeToday();
          initialH = earliest.hour;
          initialM = earliest.minute;
        }
      }

      setTempHour(initialH);
      setTempMinute(initialM);
    }
  }, [visible, selectedTime, selectedDate]);

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const isHourDisabled = (hStr) => {
    if (!isSelectedDateToday) return false;
    const h = Number(hStr);
    if (h < currentHour) return true;
    // If it's currentHour, disabled only if all minutes in that hour are past
    if (h === currentHour && currentMinute >= 55) return true;
    return false;
  };

  const isMinuteDisabled = (mStr) => {
    if (!isSelectedDateToday) return false;
    const h = Number(tempHour);
    const m = Number(mStr);
    if (h < currentHour) return true;
    if (h === currentHour && m <= currentMinute) return true;
    return false;
  };

  const handleSelectHour = (hStr) => {
    if (isHourDisabled(hStr)) return;
    setValidationError("");
    setTempHour(hStr);

    // If switching to current hour and current tempMinute is invalid, snap to valid minute
    if (isSelectedDateToday && Number(hStr) === currentHour) {
      if (Number(tempMinute) <= currentMinute) {
        const validMin = MINUTES_5.find((m) => Number(m) > currentMinute);
        if (validMin) setTempMinute(validMin);
      }
    }
  };

  const handleSelectMinute = (mStr) => {
    if (isMinuteDisabled(mStr)) return;
    setValidationError("");
    setTempMinute(mStr);
  };

  const handleConfirm = () => {
    const h = Number(tempHour);
    const m = Number(tempMinute);

    if (isSelectedDateToday) {
      const nowFresh = new Date();
      const freshHour = nowFresh.getHours();
      const freshMin = nowFresh.getMinutes();

      if (h < freshHour || (h === freshHour && m <= freshMin)) {
        setValidationError("Selected time has already passed. Please select a future time.");
        return;
      }
    }

    const finalTime = `${tempHour}:${tempMinute}`;
    onSelectTime(finalTime);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />

        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleWrap}>
              <Ionicons name="time" size={20} color={colors.primary} />
              <Text style={styles.headerTitle}>Select Pickup Time</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close time picker"
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Today Indicator Pill */}
          {isSelectedDateToday && (
            <View style={styles.todayNotice}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
              <Text style={styles.todayNoticeText}>
                Scheduled for today: Past times are disabled.
              </Text>
            </View>
          )}

          {/* Time Preview Display */}
          <View style={styles.previewBox}>
            <View style={styles.previewTimeRow}>
              <View style={styles.previewBadge}>
                <Text style={styles.previewDigitText}>{tempHour}</Text>
                <Text style={styles.previewUnitLabel}>HR</Text>
              </View>
              <Text style={styles.previewColon}>:</Text>
              <View style={styles.previewBadge}>
                <Text style={styles.previewDigitText}>{tempMinute}</Text>
                <Text style={styles.previewUnitLabel}>MIN</Text>
              </View>
            </View>
            <Text style={styles.preview12h}>
              {formatTime12h(`${tempHour}:${tempMinute}`)} (24-Hour Format: {tempHour}:{tempMinute})
            </Text>
          </View>

          {/* Error Message */}
          {validationError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="warning-outline" size={14} color={colors.danger} />
              <Text style={styles.errorText}>{validationError}</Text>
            </View>
          ) : null}

          {/* Columns: Hour & Minute */}
          <View style={styles.columnsRow}>
            {/* Hour Column */}
            <View style={styles.columnWrap}>
              <Text style={styles.columnHeader}>HOUR (00 - 23)</Text>
              <ScrollView
                style={styles.columnScroll}
                contentContainerStyle={styles.columnScrollContent}
                showsVerticalScrollIndicator={true}
              >
                {HOURS_24.map((hStr) => {
                  const disabled = isHourDisabled(hStr);
                  const selected = tempHour === hStr;
                  return (
                    <Pressable
                      key={`hour-${hStr}`}
                      onPress={() => handleSelectHour(hStr)}
                      disabled={disabled}
                      style={[
                        styles.timePill,
                        selected && styles.timePillSelected,
                        disabled && styles.timePillDisabled
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Hour ${hStr}${disabled ? " (Past hour, disabled)" : ""}`}
                    >
                      <Text
                        style={[
                          styles.timePillText,
                          selected && styles.timePillTextSelected,
                          disabled && styles.timePillTextDisabled
                        ]}
                      >
                        {hStr}:00
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Minute Column */}
            <View style={styles.columnWrap}>
              <Text style={styles.columnHeader}>MINUTE</Text>
              <ScrollView
                style={styles.columnScroll}
                contentContainerStyle={styles.columnScrollContent}
                showsVerticalScrollIndicator={true}
              >
                {MINUTES_5.map((mStr) => {
                  const disabled = isMinuteDisabled(mStr);
                  const selected = tempMinute === mStr;
                  return (
                    <Pressable
                      key={`min-${mStr}`}
                      onPress={() => handleSelectMinute(mStr)}
                      disabled={disabled}
                      style={[
                        styles.timePill,
                        selected && styles.timePillSelected,
                        disabled && styles.timePillDisabled
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Minute ${mStr}${disabled ? " (Past minute, disabled)" : ""}`}
                    >
                      <Text
                        style={[
                          styles.timePillText,
                          selected && styles.timePillTextSelected,
                          disabled && styles.timePillTextDisabled
                        ]}
                      >
                        :{mStr}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* Footer Buttons */}
          <View style={styles.footerRow}>
            <Pressable
              onPress={onClose}
              style={styles.cancelBtn}
              accessibilityRole="button"
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleConfirm}
              style={styles.confirmBtn}
              accessibilityRole="button"
              accessibilityLabel="Confirm pickup time"
            >
              <Ionicons name="checkmark" size={16} color={colors.white} />
              <Text style={styles.confirmBtnText}>Confirm Time</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "90%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  headerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  closeBtn: {
    padding: 4,
    borderRadius: 8
  },
  todayNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary
  },
  todayNoticeText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "500",
    flex: 1
  },
  previewBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 12
  },
  previewTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  previewBadge: {
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line
  },
  previewDigitText: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 1
  },
  previewUnitLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2
  },
  previewColon: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800"
  },
  preview12h: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "600",
    flex: 1
  },
  columnsRow: {
    flexDirection: "row",
    gap: 12,
    height: 190,
    marginBottom: 14
  },
  columnWrap: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 8
  },
  columnHeader: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: 0.5
  },
  columnScroll: {
    flex: 1
  },
  columnScrollContent: {
    gap: 6,
    paddingBottom: 6
  },
  timePill: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center"
  },
  timePillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  timePillDisabled: {
    opacity: 0.25,
    backgroundColor: "transparent"
  },
  timePillText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600"
  },
  timePillTextSelected: {
    color: colors.white,
    fontWeight: "800"
  },
  timePillTextDisabled: {
    color: colors.textMuted
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8
  },
  cancelBtnText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600"
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8
  },
  confirmBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700"
  }
});
