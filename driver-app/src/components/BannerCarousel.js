import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ImageBackground,
  FlatList,
  ActivityIndicator
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import api from "../../services/api";
import colors from "../../constants/colors";

const { width } = Dimensions.get("window");

export default function BannerCarousel({ audience = "driver" }) {
  const navigation = useNavigation();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/banners?audience=${audience}`);
      if (res.data?.success) {
        setBanners(res.data.data);
      }
    } catch (err) {
      console.warn("Failed to fetch banners", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePress = (action) => {
    if (!action) return;
    try {
      navigation.navigate(action);
    } catch (err) {
      console.warn("Navigation failed for action:", action);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  if (loading) {
    return (
      <View style={styles.skeletonContainer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (banners.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={banners}
        keyExtractor={(item) => item._id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item }) => (
          <Pressable 
            style={styles.bannerWrapper} 
            onPress={() => handlePress(item.ctaAction)}
          >
            <ImageBackground
              source={{ uri: item.imageUrl }}
              style={styles.bannerImage}
              imageStyle={{ borderRadius: 16 }}
            >
              <View style={styles.overlay}>
                <View style={styles.content}>
                  <Text style={styles.title} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.subtitle ? (
                    <Text style={styles.subtitle} numberOfLines={2}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                  {item.ctaText ? (
                    <View style={styles.ctaButton}>
                      <Text style={styles.ctaText}>{item.ctaText}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </ImageBackground>
          </Pressable>
        )}
      />

      {banners.length > 1 && (
        <View style={styles.pagination}>
          {banners.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentIndex === index && styles.activeDot
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  skeletonContainer: {
    height: 160,
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderColor: colors.line,
    borderWidth: 1,
  },
  bannerWrapper: {
    width: width,
    paddingHorizontal: 16,
  },
  bannerImage: {
    width: "100%",
    height: 160,
    borderRadius: 16,
    overflow: "hidden",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(8, 17, 31, 0.4)",
    padding: 16,
    justifyContent: "center",
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    color: colors.secondary || "#B8C4D1",
    fontSize: 13,
    marginBottom: 12,
  },
  ctaButton: {
    backgroundColor: colors.accent || "#FF7A00",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  ctaText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "bold",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
    marginHorizontal: 4,
    opacity: 0.5,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    opacity: 1,
  },
});
