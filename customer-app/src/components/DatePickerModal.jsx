import React, { useState, useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/theme";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const getLocalDateString = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function DatePickerModal({
  visible,
  onClose,
  selectedDate,
  onSelectDate
}) {
  const todayStr = getLocalDateString();
  const today = new Date();

  // Initialize view to selectedDate or today
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  useEffect(() => {
    if (visible) {
      if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
        const [y, m] = selectedDate.split("-").map(Number);
        setViewYear(y);
        setViewMonth(m - 1);
      } else {
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth());
      }
    }
  }, [visible, selectedDate]);

  const isCurrentMonthOrPast =
    viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth <= today.getMonth());

  const handlePrevMonth = () => {
    if (isCurrentMonthOrPast) return;
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Calendar calculations
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const handleDayPress = (day) => {
    const formattedMonth = String(viewMonth + 1).padStart(2, "0");
    const formattedDay = String(day).padStart(2, "0");
    const dateStr = `${viewYear}-${formattedMonth}-${formattedDay}`;

    if (dateStr < todayStr) return; // Prevent selecting past dates

    onSelectDate(dateStr);
    onClose();
  };

  const handleSelectToday = () => {
    onSelectDate(todayStr);
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
              <Ionicons name="calendar" size={20} color={colors.primary} />
              <Text style={styles.headerTitle}>Select Pickup Date</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close date picker"
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Month & Year Navigation */}
          <View style={styles.navRow}>
            <Pressable
              onPress={handlePrevMonth}
              disabled={isCurrentMonthOrPast}
              style={[
                styles.navBtn,
                isCurrentMonthOrPast && styles.navBtnDisabled
              ]}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
            >
              <Ionicons
                name="chevron-back"
                size={18}
                color={isCurrentMonthOrPast ? colors.line : colors.text}
              />
            </Pressable>

            <Text style={styles.monthLabel}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </Text>

            <Pressable
              onPress={handleNextMonth}
              style={styles.navBtn}
              accessibilityRole="button"
              accessibilityLabel="Next month"
            >
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* Day of Week Headers */}
          <View style={styles.dayLabelsRow}>
            {DAY_LABELS.map((label, idx) => (
              <View key={idx} style={styles.dayLabelCell}>
                <Text style={styles.dayLabelText}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.daysGrid}>
            {/* Blank leading cells */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <View key={`empty-${idx}`} style={styles.dayCell} />
            ))}

            {/* Days of month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const formattedMonth = String(viewMonth + 1).padStart(2, "0");
              const formattedDay = String(day).padStart(2, "0");
              const dateStr = `${viewYear}-${formattedMonth}-${formattedDay}`;
              const isPast = dateStr < todayStr;
              const isSelected = selectedDate === dateStr;
              const isToday = dateStr === todayStr;

              return (
                <Pressable
                  key={`day-${day}`}
                  onPress={() => handleDayPress(day)}
                  disabled={isPast}
                  style={[
                    styles.dayCell,
                    isPast && styles.dayCellDisabled,
                    isToday && !isSelected && styles.dayCellToday,
                    isSelected && styles.dayCellSelected
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${dateStr}${isPast ? " (Unavailable, past date)" : ""}`}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isPast && styles.dayTextDisabled,
                      isToday && !isSelected && styles.dayTextToday,
                      isSelected && styles.dayTextSelected
                    ]}
                  >
                    {day}
                  </Text>
                  {isToday && !isSelected && <View style={styles.todayDot} />}
                </Pressable>
              );
            })}
          </View>

          {/* Footer Controls */}
          <View style={styles.footerRow}>
            <Pressable
              onPress={handleSelectToday}
              style={styles.todayBtn}
              accessibilityRole="button"
            >
              <Text style={styles.todayBtnText}>Today</Text>
            </Pressable>

            <Pressable
              onPress={onClose}
              style={styles.cancelBtn}
              accessibilityRole="button"
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
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
    maxWidth: 360,
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
    marginBottom: 16
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
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 14
  },
  navBtn: {
    padding: 6,
    borderRadius: 6
  },
  navBtnDisabled: {
    opacity: 0.3
  },
  monthLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  dayLabelsRow: {
    flexDirection: "row",
    marginBottom: 8
  },
  dayLabelCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  dayLabelText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16
  },
  dayCell: {
    width: "14.28%",
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    position: "relative"
  },
  dayCellDisabled: {
    opacity: 0.25
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: colors.primary
  },
  dayCellSelected: {
    backgroundColor: colors.primary
  },
  dayText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600"
  },
  dayTextDisabled: {
    color: colors.textMuted
  },
  dayTextToday: {
    color: colors.primary,
    fontWeight: "700"
  },
  dayTextSelected: {
    color: colors.white,
    fontWeight: "800"
  },
  todayDot: {
    position: "absolute",
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12
  },
  todayBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt
  },
  todayBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8
  },
  cancelBtnText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600"
  }
});
