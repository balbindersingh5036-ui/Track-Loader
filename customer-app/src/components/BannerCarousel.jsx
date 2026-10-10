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
import { useNavigation } from "@react-navigation/native";
import api from "../services/api";
import colors from "../constants/colors";

export default function BannerCarousel({ audience = "customer" }) {
  const navigation = useNavigation();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [realIndex, setRealIndex] = useState(0);
  const [layoutWidth, setLayoutWidth] = useState(Dimensions.get("window").width);
  
  const flatListRef = useRef(null);
  const currentIndexRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    fetchBanners();
    return () => clearTimer();
  }, [audience]);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/banners?audience=${audience}`);
      if (res.data?.success) {
        setBanners(res.data.data || []);
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

  // Create clones for infinite loop
  const extendedBanners = useMemo(() => {
    if (banners.length <= 1) return banners.map((b, i) => ({ ...b, uniqueKey: b._id || i.toString() }));
    return [
      { ...banners[banners.length - 1], uniqueKey: 'clone-last-' + banners[banners.length - 1]._id },
      ...banners.map(b => ({ ...b, uniqueKey: b._id })),
      { ...banners[0], uniqueKey: 'clone-first-' + banners[0]._id }
    ];
  }, [banners]);

  const scrollToIndex = useCallback((index, animated) => {
    if (!flatListRef.current) return;
    const offset = index * layoutWidth;
    
    if (Platform.OS === 'web') {
      try {
        const scrollNode = flatListRef.current.getScrollableNode();
        if (scrollNode && typeof scrollNode.scrollTo === 'function') {
          scrollNode.scrollTo({ left: offset, behavior: animated ? 'smooth' : 'auto' });
        } else {
          flatListRef.current.scrollToOffset({ offset, animated });
        }
      } catch (e) {
        flatListRef.current.scrollToOffset({ offset, animated });
      }
    } else {
      flatListRef.current.scrollToOffset({ offset, animated });
    }
  }, [layoutWidth]);

  // Initial position jump when data loads
  useEffect(() => {
    if (extendedBanners.length > 1 && layoutWidth > 0) {
      currentIndexRef.current = 1;
      setRealIndex(0);
      setTimeout(() => {
        scrollToIndex(1, false);
      }, 100);
    } else if (extendedBanners.length === 1) {
      currentIndexRef.current = 0;
      setRealIndex(0);
    }
  }, [extendedBanners, layoutWidth, scrollToIndex]);

  const startAutoSlide = useCallback(() => {
    clearTimer();
    if (banners.length <= 1 || layoutWidth <= 0) return;

    timerRef.current = setInterval(() => {
      const N = banners.length;
      let nextIndex = currentIndexRef.current + 1;
      
      scrollToIndex(nextIndex, true);
      
      if (nextIndex === N + 1) {
        setTimeout(() => {
          if (flatListRef.current) {
            scrollToIndex(1, false);
            currentIndexRef.current = 1;
            setRealIndex(0);
          }
        }, 500); // Wait for transition
      } else {
        currentIndexRef.current = nextIndex;
        setRealIndex(nextIndex - 1);
      }
    }, 3000);
  }, [banners.length, layoutWidth, scrollToIndex]);

  useEffect(() => {
    startAutoSlide();
    return () => clearTimer();
  }, [startAutoSlide]);

  const handleScrollBeginDrag = () => {
    clearTimer();
  };

  const handleMomentumScrollEnd = (event) => {
    if (layoutWidth <= 0) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / layoutWidth);
    const N = banners.length;
    
    if (N > 1) {
      if (index === 0) {
        scrollToIndex(N, false);
        currentIndexRef.current = N;
        setRealIndex(N - 1);
      } else if (index === N + 1) {
        scrollToIndex(1, false);
        currentIndexRef.current = 1;
        setRealIndex(0);
      } else {
        currentIndexRef.current = index;
        setRealIndex(index - 1);
      }
    }
    startAutoSlide();
  };

  // For Web, sometimes onMomentumScrollEnd doesn't fire. Fallback using onScroll.
  const handleScroll = (event) => {
    if (Platform.OS !== 'web' || layoutWidth <= 0 || banners.length <= 1) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / layoutWidth);
    const floatIndex = offsetX / layoutWidth;
    
    // Check if we've settled on a clone boundary via manual scroll
    if (Math.abs(floatIndex - index) < 0.05) {
       const N = banners.length;
       if (index === 0) {
          scrollToIndex(N, false);
          currentIndexRef.current = N;
          setRealIndex(N - 1);
       } else if (index === N + 1) {
          scrollToIndex(1, false);
          currentIndexRef.current = 1;
          setRealIndex(0);
       }
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
    <View 
      style={styles.container} 
      onLayout={(e) => {
        const newWidth = e.nativeEvent.layout.width;
        if (newWidth > 0 && newWidth !== layoutWidth) {
           setLayoutWidth(newWidth);
        }
      }}
    >
      <FlatList
        ref={flatListRef}
        data={extendedBanners}
        keyExtractor={(item) => item.uniqueKey}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScrollBeginDrag={handleScrollBeginDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScroll={Platform.OS === 'web' ? handleScroll : undefined}
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
              resizeMode="cover"
            />
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
                realIndex === index && styles.activeDot
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
    width: '100%',
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
    paddingHorizontal: 16,
  },
  bannerImage: {
    width: "100%",
    height: 160,
    borderRadius: 16,
    overflow: "hidden",
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
    backgroundColor: colors.textMuted || '#8A98A8',
    marginHorizontal: 4,
    opacity: 0.5,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary || '#08A9F5',
    opacity: 1,
  },
});
