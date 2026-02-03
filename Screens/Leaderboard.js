import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

export default function Leaderboard() {
  const navigation = useNavigation();

  // Sample leaderboard data
  const topThree = [
    { id: 2, name: 'Valent', visits: '45 visits', position: 2, avatar: null },
    { id: 1, name: 'Co.Vistol', visits: '65 visits', position: 1, avatar: null },
    { id: 3, name: 'Jonathan', visits: '35 visits', position: 3, avatar: null },
  ];

  const otherUsers = [
    { id: 4, rank: 4, name: 'Mae', visits: '29 visits', avatar: null },
    { id: 5, rank: 5, name: 'Yuan', visits: '21 visits', avatar: null },
    { id: 6, rank: 6, name: 'Jonathan', visits: '20 visits', avatar: null },
  ];

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="chevron-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <TouchableOpacity style={styles.settingsButton}>
          <Feather name="settings" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* TOP 3 PODIUM */}
        <View style={styles.podiumContainer}>
          {/* Second Place */}
          <View style={styles.podiumItem}>
            <View style={styles.avatarContainer}>
              {topThree[0].avatar ? (
                <Image source={{ uri: topThree[0].avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Feather name="user" size={30} color="#fff" />
                </View>
              )}
            </View>
            <Text style={styles.podiumName}>{topThree[0].name}</Text>
            <Text style={styles.podiumVisits}>{topThree[0].visits}</Text>
          </View>

          {/* First Place (Winner) */}
          <View style={[styles.podiumItem, styles.winnerItem]}>
            <View style={styles.crownContainer}>
              <Text style={styles.crown}>👑</Text>
            </View>
            <View style={[styles.avatarContainer, styles.winnerAvatar]}>
              {topThree[1].avatar ? (
                <Image source={{ uri: topThree[1].avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder, styles.winnerAvatarBg]}>
                  <Feather name="user" size={35} color="#fff" />
                </View>
              )}
              <View style={styles.winnerBadge}>
                <Text style={styles.winnerBadgeText}>1</Text>
              </View>
            </View>
            <Text style={[styles.podiumName, styles.winnerName]}>{topThree[1].name}</Text>
            <Text style={styles.podiumVisits}>{topThree[1].visits}</Text>
          </View>

          {/* Third Place */}
          <View style={styles.podiumItem}>
            <View style={styles.avatarContainer}>
              {topThree[2].avatar ? (
                <Image source={{ uri: topThree[2].avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Feather name="user" size={30} color="#fff" />
                </View>
              )}
            </View>
            <Text style={styles.podiumName}>{topThree[2].name}</Text>
            <Text style={styles.podiumVisits}>{topThree[2].visits}</Text>
          </View>
        </View>

        {/* RANKED LIST */}
        <View style={styles.rankedList}>
          {otherUsers.map((user) => (
            <View key={user.id} style={styles.rankItem}>
              <View style={styles.rankLeft}>
                <Text style={styles.rankNumber}>{user.rank}</Text>
                <View style={styles.rankAvatar}>
                  {user.avatar ? (
                    <Image source={{ uri: user.avatar }} style={styles.smallAvatar} />
                  ) : (
                    <View style={[styles.smallAvatar, styles.smallAvatarPlaceholder]}>
                      <Feather name="user" size={18} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={styles.rankName}>{user.name}</Text>
              </View>
              <Text style={styles.rankVisits}>{user.visits}</Text>
            </View>
          ))}
        </View>

        {/* VIEW ALL BUTTON */}
        <TouchableOpacity style={styles.viewAllButton}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5c4c1',
    paddingTop: 50,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 30,
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },

  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },

  scrollContent: {
    paddingHorizontal: 20,
  },

  // PODIUM STYLES
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: 40,
    gap: 15,
  },

  podiumItem: {
    alignItems: 'center',
    flex: 1,
  },

  winnerItem: {
    marginBottom: 20,
  },

  crownContainer: {
    marginBottom: 5,
  },

  crown: {
    fontSize: 35,
  },

  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },

  winnerAvatar: {
    marginBottom: 10,
  },

  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#6a5a5a',
  },

  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  winnerAvatarBg: {
    width: 85,
    height: 85,
    borderRadius: 42.5,
    backgroundColor: '#2c2c54',
  },

  winnerBadge: {
    position: 'absolute',
    bottom: -5,
    alignSelf: 'center',
    backgroundColor: '#f4c542',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#f5c4c1',
  },

  winnerBadgeText: {
    color: '#2c2c54',
    fontSize: 16,
    fontWeight: '700',
  },

  podiumName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a4a4a',
    marginBottom: 3,
  },

  winnerName: {
    fontSize: 15,
    fontWeight: '700',
  },

  podiumVisits: {
    fontSize: 12,
    color: '#6a5a5a',
  },

  // RANKED LIST STYLES
  rankedList: {
    backgroundColor: 'transparent',
    marginBottom: 25,
  },

  rankItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5d4d1',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 10,
  },

  rankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  rankNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a4a4a',
    width: 25,
  },

  rankAvatar: {
    marginRight: 12,
  },

  smallAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6a5a5a',
  },

  smallAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  rankName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4a4a4a',
  },

  rankVisits: {
    fontSize: 14,
    color: '#6a5a5a',
  },

  // VIEW ALL BUTTON
  viewAllButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6a5a5a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },

  viewAllText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a4a4a',
  },
});