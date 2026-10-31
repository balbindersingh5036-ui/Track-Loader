import React from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './AgencyTheme';

export default function ConfirmationModal({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  inputLabel,
  inputValue,
  onInputChange,
  inputPlaceholder,
  inputRequired = false
}) {
  const isInputInvalid = inputRequired && (!inputValue || !inputValue.trim());

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.dialog}>
          <View style={styles.header}>
            <View
              style={[
                styles.iconBubble,
                { backgroundColor: danger ? theme.colors.dangerGlow : theme.colors.primaryGlow }
              ]}
            >
              <Ionicons
                name={danger ? 'alert-circle' : 'information-circle'}
                size={24}
                color={danger ? theme.colors.danger : theme.colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={theme.colors.muted} />
            </Pressable>
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          {inputLabel ? (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{inputLabel}</Text>
              <TextInput
                value={inputValue}
                onChangeText={onInputChange}
                placeholder={inputPlaceholder || 'Enter details...'}
                placeholderTextColor={theme.colors.muted}
                multiline
                numberOfLines={3}
                style={styles.textInput}
              />
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              disabled={loading}
              style={[styles.button, styles.cancelButton]}
            >
              <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              disabled={loading || isInputInvalid}
              style={[
                styles.button,
                danger ? styles.dangerButton : styles.confirmButton,
                (loading || isInputInvalid) && styles.disabledButton
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject
  },
  dialog: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    gap: 14,
    elevation: 10,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.5)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.5,
          shadowRadius: 20
        })
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  iconBubble: {
    width: 42,
    height: 42,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    color: theme.colors.ink,
    fontSize: 17,
    fontWeight: '800'
  },
  closeButton: {
    padding: 6
  },
  message: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20
  },
  inputContainer: {
    gap: 6
  },
  inputLabel: {
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: '700'
  },
  textInput: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    color: theme.colors.ink,
    padding: 12,
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: 'top'
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700'
  },
  confirmButton: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  dangerButton: {
    backgroundColor: theme.colors.danger,
    borderColor: theme.colors.danger
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  },
  disabledButton: {
    opacity: 0.5
  }
});
