import React, { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function DriverProfileAvatar({
  imageUri,
  size,
  colors,
  iconColor = colors.muted,
  onPress,
  editable = false
}) {
  const [failedUri, setFailedUri] = useState('');
  const showImage = Boolean(imageUri && failedUri !== imageUri);

  useEffect(() => {
    setFailedUri('');
  }, [imageUri]);

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={editable ? 'Update profile photo' : 'Driver profile photo'}
      onPress={onPress}
      disabled={!onPress}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border
      }}
    >
      {showImage ? (
        <Image
          key={imageUri}
          source={{ uri: imageUri }}
          onError={() => setFailedUri(imageUri)}
          resizeMode="cover"
          style={{ width: size - 2, height: size - 2, borderRadius: (size - 2) / 2 }}
        />
      ) : (
        <Ionicons name="person" size={size * 0.44} color={iconColor} />
      )}
      {editable ? (
        <View
          style={{
            position: 'absolute',
            right: -3,
            bottom: -3,
            width: 23,
            height: 23,
            borderRadius: 12,
            backgroundColor: colors.primary,
            borderWidth: 2,
            borderColor: colors.bg,
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Ionicons name="camera" size={12} color="#FFFFFF" />
        </View>
      ) : null}
    </Pressable>
  );
}
