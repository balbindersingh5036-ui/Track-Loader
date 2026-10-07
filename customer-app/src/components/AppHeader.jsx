import React from "react";
import { Text, View } from "react-native";
import { colors } from "./Phase12UI";

export default function AppHeader({ title, subtitle, right }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, gap: 12 }}>
      <View style={{ flex: 1 }}>
        {title ? <Text style={{ color: colors.textLight, fontSize: 24, fontWeight: "700" }}>{title}</Text> : null}
        {subtitle ? <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>{subtitle}</Text> : null}
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

