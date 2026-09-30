import React from "react";
import { Text, TextInput, View } from "react-native";
import { colors } from "./Phase12UI";

export default function CustomInput({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, style, ...props }) {
  return (
    <View style={[{ gap: 6, marginBottom: 12 }, style]}>
      {label ? <Text style={{ color: colors.ink, fontWeight: "600", fontSize: 14 }}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        placeholderTextColor="#8A9995"
        style={{
          minHeight: 46,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: "#FFFFFF",
          paddingHorizontal: 12,
          color: colors.ink,
          fontSize: 15
        }}
        {...props}
      />
    </View>
  );
}

