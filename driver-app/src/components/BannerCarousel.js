import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Image,
  FlatList,
  ActivityIndicator,
  Platform,
  Dimensions
} from "react-native";
import api from "../services/api";
import colors from "../constants/colors";

export default function BannerCarousel({ audience = "driver", fallback = null }) {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [realIndex, setRealIndex] = useState(0);
  const [layoutWidth, setLayoutWidth] = useState(Dimensions.get("window").width);
  const [webActiveIndex, setWebActiveIndex] = useState(1);
  const [isWebAnimating, setIsWebAnimating] = useState(false);
  
  const flatListRef = useRef(null);
  const currentIndexRef = useRef(1);
  const timerRef = useRef(null);
  
  // Ref for web tracking
  const webTimeoutRef = useRef(null);

  useEffect(() => {
    fetchBanners();
    return () => {
      clearTimer();
      if (webTimeoutRef.current) clearTimeout(webTimeoutRef.current);
    };
  }, [audience]);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/banners?audience=${audience}`);
      if (res.data?.success) {
        const fetchedBanners = res.data.data || [];
        console.log(`[BannerCarousel] Loaded ${fetchedBanners.length} banners.`);
        fetchedBanners.forEach((b, i) => console.log(`[BannerCarousel] Banner ${i}: ${b.imageUrl}`));
        setBanners(fetchedBanners);
      }
    } catch (err) {
      console.warn('Failed to fetch banners', err);
    } finally {
      setLoading(false);
    }
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const extendedBanners = useMemo(() => {
    if (banners.length <= 1) return banners.map((b, i) => ({ ...b, uniqueKey: b._id || i.toString() }));
    return [
      { ...banners[banners.length - 1], uniqueKey: 'clone-last-' + banners[banners.length - 1]._id },
      ...banners.map((b) => ({ ...b, uniqueKey: b._id })),
      { ...banners[0], uniqueKey: 'clone-first-' + banners[0]._id }
    ];
  }, [banners]);

  const scrollToIndexNative = useCallback((index, animated) => {
    if (!flatListRef.current || layoutWidth <= 0) return;
    const offset = index * layoutWidth;
    try {
      flatListRef.current.scrollToOffset({ offset, animated });
    } catch (e) {
      console.warn("[BannerCarousel] scroll error:", e);
    }
  }, [layoutWidth]);

  useEffect(() => {
    if (extendedBanners.length > 1 && layoutWidth > 0) {
      currentIndexRef.current = 1;
      setRealIndex(0);
      setWebActiveIndex(1);
      if (Platform.OS !== 'web') {
        setTimeout(() => scrollToIndexNative(1, false), 100);
      }
    } else if (extendedBanners.length === 1) {
      currentIndexRef.current = 0;
      setRealIndex(0);
      setWebActiveIndex(0);
    }
  }, [extendedBanners, layoutWidth, scrollToIndexNative]);

  const startAutoSlide = useCallback(() => {
    clearTimer();
    if (banners.length <= 1 || layoutWidth <= 0) return;

    timerRef.current = setInterval(() => {
      const N = banners.length;
      let nextIndex = currentIndexRef.current + 1;
      
      if (Platform.OS === 'web') {
        setIsWebAnimating(true);
        setWebActiveIndex(nextIndex);
        currentIndexRef.current = nextIndex;
        
        if (nextIndex === N + 1) {
          if (webTimeoutRef.current) clearTimeout(webTimeoutRef.current);
          webTimeoutRef.current = setTimeout(() => {
            setIsWebAnimating(false);
            setWebActiveIndex(1);
            currentIndexRef.current = 1;
            setRealIndex(0);
          }, 500);
        } else {
          setRealIndex(nextIndex - 1);
        }
      } else {
        scrollToIndexNative(nextIndex, true);
        if (nextIndex === N + 1) {
          setTimeout(() => {
            if (flatListRef.current) {
              scrollToIndexNative(1, false);
              currentIndexRef.current = 1;
              setRealIndex(0);
            }
          }, 500);
        } else {
          currentIndexRef.current = nextIndex;
          setRealIndex(nextIndex - 1);
        }
      }
    }, 3000);
  }, [banners.length, layoutWidth, scrollToIndexNative]);

  useEffect(() => {
    startAutoSlide();
    return () => clearTimer();
  }, [startAutoSlide]);

  const handleMomentumScrollEnd = (event) => {
    if (layoutWidth <= 0) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / layoutWidth);
    const N = banners.length;
    
    if (N > 1) {
      if (index === 0) {
        scrollToIndexNative(N, false);
        currentIndexRef.current = N;
        setRealIndex(N - 1);
      } else if (index === N + 1) {
        scrollToIndexNative(1, false);
        currentIndexRef.current = 1;
        setRealIndex(0);
      } else {
        currentIndexRef.current = index;
        setRealIndex(index - 1);
      }
    }
    startAutoSlide();
  };

  const handleDotPress = (index) => {
    clearTimer();
    const targetIndex = index + 1;
    if (Platform.OS === 'web') {
      setIsWebAnimating(true);
      setWebActiveIndex(targetIndex);
    } else {
      scrollToIndexNative(targetIndex, true);
    }
    currentIndexRef.current = targetIndex;
    setRealIndex(index);
    startAutoSlide();
  };

  const handlePress = (action) => {
    if (!action) return;
    try {
      console.log("Banner action pressed:", action);
      // navigation.navigate(action); // Disabled for driver app since it does not use react-navigation
    } catch (err) {
      console.warn("Action failed:", action);
    }
  };

  if (loading) {
    return (
      <View style={styles.skeletonContainer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (banners.length === 0) return fallback;

  return (
    <View 
      style={styles.container} 
      onLayout={(e) => {
        const newWidth = e.nativeEvent.layout.width;
        if (newWidth > 0 && newWidth !== layoutWidth) {
           setLayoutWidth(newWidth);
        }
      }}
    >
      {Platform.OS === 'web' ? (
        <View style={{ width: layoutWidth, overflow: 'hidden', alignSelf: 'center' }}>
          <View 
            style={{ 
              flexDirection: 'row', 
              width: layoutWidth * extendedBanners.length,
              transform: [{ translateX: -webActiveIndex * layoutWidth }],
              transition: isWebAnimating ? 'transform 0.5s ease-in-out' : 'none'
            }}
          >
            {extendedBanners.map((item, index) => (
              <Pressable 
                key={item.uniqueKey + index}
                style={[styles.bannerWrapper, { width: layoutWidth }]} 
                onPress={() => handlePress(item.ctaAction)}
              >
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.bannerImage}
                  resizeMode="contain"
                />
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={extendedBanners}
          keyExtractor={(item, idx) => item.uniqueKey + idx}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onScrollBeginDrag={clearTimer}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          scrollEventThrottle={16}
          getItemLayout={(_, index) => ({
            length: layoutWidth,
            offset: layoutWidth * index,
            index,
          })}
          renderItem={({ item }) => (
            <Pressable 
              style={[styles.bannerWrapper, { width: layoutWidth }]} 
              onPress={() => handlePress(item.ctaAction)}
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.bannerImage}
                resizeMode="contain"
              />
            </Pressable>
          )}
        />
      )}

      {banners.length > 1 && (
        <View style={styles.pagination}>
          {banners.map((_, index) => (
            <Pressable
              key={index}
              onPress={() => handleDotPress(index)}
              style={styles.dotContainer}
            >
              <View
                style={[
                  styles.dot,
                  realIndex === index && styles.activeDot
                ]}
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 10, width: '100%', alignSelf: 'center' },
  skeletonContainer: {
    height: 160, backgroundColor: colors.surface, borderRadius: 16,
    marginHorizontal: 16, marginVertical: 10, alignItems: "center",
    justifyContent: "center", borderColor: colors.line, borderWidth: 1,
  },
  bannerWrapper: { paddingHorizontal: 16 },
  bannerImage: { width: "100%", height: 160, borderRadius: 16, overflow: "hidden" },
  pagination: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 10 },
  dotContainer: { padding: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted || '#8A98A8', marginHorizontal: 2, opacity: 0.5 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary || '#08A9F5', opacity: 1 },
});
