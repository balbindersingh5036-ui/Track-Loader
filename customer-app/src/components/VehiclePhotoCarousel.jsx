import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "../theme/theme";
import { getOptimizedImageUrl } from "../utils/imageOptimizer";
import { isEVVehicle } from "../utils/vehicleDisplay";
import {
  extractVehiclePhotoUrls,
  createInfinitePhotoBuffer,
  getNextPhotoIndex,
  getPrevPhotoIndex
} from "../utils/vehiclePhotos";

export { extractVehiclePhotoUrls };

export default function VehiclePhotoCarousel({
  vehicle,
  height = 220,
  autoPlayInterval = 3500,
  overlayBadge = null,
  onPhotoPress = null
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [failedUrls, setFailedUrls] = useState(() => new Set());
  const [imageLoading, setImageLoading] = useState({});

  const flatListRef = useRef(null);
  const autoPlayTimerRef = useRef(null);
  const isTransitioningRef = useRef(false);
  const activeIndexRef = useRef(0);
  activeIndexRef.current = activeIndex;

  const isEV = isEVVehicle(vehicle);
  const isTaxi = vehicle?.serviceCategory === "GOODS_TAXI";

  const rawPhotos = useMemo(() => extractVehiclePhotoUrls(vehicle), [vehicle]);
  const photoCount = rawPhotos.length;

  // Infinite loop buffer: [last, ...items, first] when multiple photos
  const bufferedPhotos = useMemo(() => {
    if (photoCount <= 1) return rawPhotos;
    return [rawPhotos[photoCount - 1], ...rawPhotos, rawPhotos[0]];
  }, [rawPhotos, photoCount]);

  // Handle image load error
  const handleImageError = useCallback((url) => {
    setFailedUrls((prev) => {
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  // Jump smoothly to a specific real photo index
  const scrollToIndex = useCallback(
    (targetRealIndex, animated = true) => {
      if (!flatListRef.current || containerWidth <= 0 || photoCount <= 1) return;
      const bufferTarget = targetRealIndex + 1;
      isTransitioningRef.current = true;
      flatListRef.current.scrollToOffset({
        offset: bufferTarget * containerWidth,
        animated
      });
      setActiveIndex(targetRealIndex);
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 400);
    },
    [containerWidth, photoCount]
  );

  // Navigate to next photo
  const goToNext = useCallback(() => {
    if (photoCount <= 1 || containerWidth <= 0 || !flatListRef.current) return;
    const current = activeIndexRef.current;
    const nextReal = (current + 1) % photoCount;

    if (current === photoCount - 1) {
      // Animate to buffer end (cloned item 0)
      isTransitioningRef.current = true;
      flatListRef.current.scrollToOffset({
        offset: (photoCount + 1) * containerWidth,
        animated: true
      });
      setActiveIndex(0);

      // Silent jump back to buffer index 1 after animation completes
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: 1 * containerWidth,
          animated: false
        });
        isTransitioningRef.current = false;
      }, 350);
    } else {
      scrollToIndex(nextReal, true);
    }
  }, [photoCount, containerWidth, scrollToIndex]);

  // Navigate to previous photo
  const goToPrev = useCallback(() => {
    if (photoCount <= 1 || containerWidth <= 0 || !flatListRef.current) return;
    const current = activeIndexRef.current;
    const prevReal = (current - 1 + photoCount) % photoCount;

    if (current === 0) {
      // Animate backward to buffer index 0 (cloned last item)
      isTransitioningRef.current = true;
      flatListRef.current.scrollToOffset({
        offset: 0,
        animated: true
      });
      setActiveIndex(photoCount - 1);

      // Silent jump to real last item buffer index
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: photoCount * containerWidth,
          animated: false
        });
        isTransitioningRef.current = false;
      }, 350);
    } else {
      scrollToIndex(prevReal, true);
    }
  }, [photoCount, containerWidth, scrollToIndex]);

  // Initial positioning to buffer index 1 (the first real photo)
  useEffect(() => {
    if (photoCount > 1 && containerWidth > 0 && flatListRef.current) {
      flatListRef.current.scrollToOffset({
        offset: 1 * containerWidth,
        animated: false
      });
      setActiveIndex(0);
    }
  }, [containerWidth, photoCount]);

  // Auto-slide effect with pause handling
  useEffect(() => {
    if (photoCount <= 1 || isInteracting || isHovered) {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      return;
    }

    autoPlayTimerRef.current = setInterval(() => {
      goToNext();
    }, autoPlayInterval);

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [photoCount, isInteracting, isHovered, autoPlayInterval, goToNext]);

  // Handle scroll events (manual swipe on touch or trackpad)
  const handleScrollEnd = useCallback(
    (e) => {
      if (containerWidth <= 0 || photoCount <= 1 || isTransitioningRef.current) return;
      const offsetX = e.nativeEvent.contentOffset.x;
      const bufferIndex = Math.round(offsetX / containerWidth);

      if (bufferIndex === 0) {
        // Swiped left to cloned last photo -> silent jump to real last photo
        flatListRef.current?.scrollToOffset({
          offset: photoCount * containerWidth,
          animated: false
        });
        setActiveIndex(photoCount - 1);
      } else if (bufferIndex === photoCount + 1) {
        // Swiped right to cloned first photo -> silent jump to real first photo
        flatListRef.current?.scrollToOffset({
          offset: 1 * containerWidth,
          animated: false
        });
        setActiveIndex(0);
      } else {
        setActiveIndex(bufferIndex - 1);
      }
      setIsInteracting(false);
    },
    [containerWidth, photoCount]
  );

  const onLayout = useCallback((e) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - containerWidth) > 1) {
      setContainerWidth(width);
    }
  }, [containerWidth]);

  // RENDER: Zero photos available placeholder
  if (photoCount === 0) {
    return (
      <View
        style={[
          styles.container,
          { height },
          isEV && styles.containerEV,
          isTaxi && styles.containerTaxi
        ]}
        onLayout={onLayout}
      >
        <View style={styles.placeholderBox}>
          <MaterialCommunityIcons
            name={
              isEV
                ? "lightning-bolt-outline"
                : isTaxi
                  ? "truck-delivery-outline"
                  : "truck-outline"
            }
            size={56}
            color={isEV ? "#10B981" : isTaxi ? "#F59E0B" : colors.textLight}
          />
          <Text style={styles.placeholderTitle}>
            {vehicle?.vehicleModel || "Vehicle Details"}
          </Text>
          <Text style={styles.placeholderSubtitle}>No photos uploaded yet</Text>
        </View>
        {overlayBadge}
      </View>
    );
  }

  // RENDER: Single photo (static banner without carousel controls)
  if (photoCount === 1) {
    const photoUrl = rawPhotos[0];
    const isFailed = failedUrls.has(photoUrl);

    return (
      <View style={[styles.container, { height }]} onLayout={onLayout}>
        {isFailed ? (
          <View style={styles.failedBox}>
            <Ionicons name="image-outline" size={48} color={colors.textMuted} />
            <Text style={styles.failedText}>Photo unavailable</Text>
          </View>
        ) : (
          <Pressable
            style={styles.imagePressable}
            onPress={() => onPhotoPress?.(photoUrl, 0)}
            disabled={!onPhotoPress}
          >
            <Image
              source={{ uri: getOptimizedImageUrl(photoUrl, { width: 900 }) }}
              style={styles.fullImage}
              resizeMode="cover"
              onError={() => handleImageError(photoUrl)}
            />
          </Pressable>
        )}
        {overlayBadge}
      </View>
    );
  }

  // RENDER: Multiple photos (Infinite Scroll Carousel)
  const isWeb = Platform.OS === "web";
  const activeAccentColor = isEV ? "#10B981" : colors.primary;

  return (
    <View
      style={[styles.container, { height }]}
      onLayout={onLayout}
      {...(isWeb
        ? {
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false)
          }
        : {})}
    >
      {containerWidth > 0 ? (
        <FlatList
          ref={flatListRef}
          data={bufferedPhotos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          scrollEventThrottle={16}
          keyExtractor={(item, index) => `${item}-${index}`}
          getItemLayout={(_, index) => ({
            length: containerWidth,
            offset: containerWidth * index,
            index
          })}
          onScrollBeginDrag={() => setIsInteracting(true)}
          onMomentumScrollEnd={handleScrollEnd}
          renderItem={({ item, index }) => {
            const isFailed = failedUrls.has(item);
            return (
              <View style={[styles.slide, { width: containerWidth, height }]}>
                {isFailed ? (
                  <View style={styles.failedBox}>
                    <Ionicons name="image-outline" size={44} color={colors.textMuted} />
                    <Text style={styles.failedText}>Photo unavailable</Text>
                  </View>
                ) : (
                  <Pressable
                    style={styles.imagePressable}
                    onPress={() => onPhotoPress?.(item, activeIndex)}
                    disabled={!onPhotoPress}
                  >
                    <Image
                      source={{ uri: getOptimizedImageUrl(item, { width: 900 }) }}
                      style={styles.fullImage}
                      resizeMode="cover"
                      onError={() => handleImageError(item)}
                    />
                  </Pressable>
                )}
              </View>
            );
          }}
        />
      ) : (
        <View style={styles.measuringBox}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      {/* EV / SERVICE BADGE OVERLAY */}
      {overlayBadge}

      {/* PHOTO COUNTER BADGE */}
      <View style={styles.counterBadge}>
        <Text style={styles.counterText}>
          {activeIndex + 1}/{photoCount}
        </Text>
      </View>

      {/* WEB / DESKTOP PREV & NEXT CONTROLS */}
      {photoCount > 1 ? (
        <>
          <Pressable
            style={[styles.navButton, styles.navButtonLeft]}
            onPress={goToPrev}
            accessibilityLabel="Previous vehicle photo"
          >
            <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
          </Pressable>

          <Pressable
            style={[styles.navButton, styles.navButtonRight]}
            onPress={goToNext}
            accessibilityLabel="Next vehicle photo"
          >
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </Pressable>
        </>
      ) : null}

      {/* PAGINATION DOTS */}
      {photoCount > 1 ? (
        <View style={styles.paginationDotsContainer}>
          {rawPhotos.map((_, idx) => {
            const isActive = idx === activeIndex;
            return (
              <Pressable
                key={`dot-${idx}`}
                onPress={() => scrollToIndex(idx, true)}
                style={[
                  styles.dot,
                  isActive
                    ? [styles.dotActive, { backgroundColor: activeAccentColor }]
                    : styles.dotInactive
                ]}
                accessibilityLabel={`Go to photo ${idx + 1}`}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.surfaceAlt || "#142334",
    borderWidth: 1,
    borderColor: colors.line || "#1E293B",
    marginBottom: 14
  },
  containerEV: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderColor: "rgba(16, 185, 129, 0.25)"
  },
  containerTaxi: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderColor: "rgba(245, 158, 11, 0.25)"
  },
  slide: {
    height: "100%",
    overflow: "hidden",
    backgroundColor: colors.surfaceAlt || "#142334"
  },
  imagePressable: {
    width: "100%",
    height: "100%"
  },
  fullImage: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.surfaceAlt || "#142334"
  },
  placeholderBox: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 20
  },
  placeholderTitle: {
    color: colors.text || "#F8FAFC",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4
  },
  placeholderSubtitle: {
    color: colors.textMuted || "#94A3B8",
    fontSize: 13
  },
  failedBox: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt || "#142334",
    gap: 6
  },
  failedText: {
    color: colors.textMuted || "#94A3B8",
    fontSize: 12,
    fontWeight: "600"
  },
  measuringBox: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center"
  },
  counterBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(8, 17, 31, 0.78)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    zIndex: 5
  },
  counterText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5
  },
  paginationDotsContainer: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    zIndex: 5
  },
  dot: {
    height: 6,
    borderRadius: 3
  },
  dotInactive: {
    width: 6,
    backgroundColor: "rgba(255, 255, 255, 0.4)"
  },
  dotActive: {
    width: 18
  },
  navButton: {
    position: "absolute",
    top: "50%",
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(8, 17, 31, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 6
  },
  navButtonLeft: {
    left: 10
  },
  navButtonRight: {
    right: 10
  }
});
