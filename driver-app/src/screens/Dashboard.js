import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import BannerCarousel from '../components/BannerCarousel';
import LoadBalbinLogo from '../components/LoadBalbinLogo';

const Dashboard = () => {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <LoadBalbinLogo width={140} height={90} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <BannerCarousel audience="driver" />
        <View style={styles.content}>
          <Text style={styles.text}>Dashboard coming soon...</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#08111F' },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 0,
    paddingRight: 16,
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: '#25364A',
    backgroundColor: '#0F1B29'
  },
  scroll: { paddingBottom: 40 },
  content: { padding: 16, alignItems: 'center', marginTop: 20 },
  text: { color: '#B8C4D1', fontSize: 16 }
});

export default Dashboard;