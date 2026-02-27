import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useBookmark } from '../context/BookmarkContext';
import { useUser } from "@clerk/clerk-expo";
import { useAuth } from "../context/AuthContext";
import { MaterialIcons } from '@expo/vector-icons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

export default function Bookmark() {
  const navigation = useNavigation();
  const { bookmarks, toggleBookmark } = useBookmark();
  const { user: clerkUser } = useUser();
  const { user: authUser } = useAuth();
  const bookmarkedSpots = bookmarks;

  // Get profile photo from Clerk user or auth context
  const profilePhoto = clerkUser?.imageUrl || clerkUser?.profileImageUrl || authUser?.profilePhoto;

  const handleToggleBookmark = (spot) => {
    toggleBookmark(spot);
  };

  const BookmarkCard = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => navigation.navigate('InformationScreen', { spot: item })}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: item.image }} 
        style={styles.cardImage}
        resizeMode="cover"
      />
      <TouchableOpacity 
        style={styles.bookmarkButton}
        onPress={() => handleToggleBookmark(item)}
        activeOpacity={0.8}
      >
        <FontAwesome
                  name="bookmark"
                  size={24}
                  color={"#f4c542"}
                />
      </TouchableOpacity>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <View style={styles.locationContainer}>
          <Feather name="map-pin" size={12} color="#6a5a5a" />
          <Text style={styles.locationText}>{item.location}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="chevron-left" size={24} color="#4a4a4a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Soon to visit</Text>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Profile')}
        >
          {profilePhoto ? (
            <Image 
              source={{ uri: profilePhoto }} 
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.profileButton}>
              <Feather name="user" size={20} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {bookmarkedSpots.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="bookmark" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No bookmarks yet</Text>
            <Text style={styles.emptySubtext}>
              Start exploring and save your favorite destinations
            </Text>
          </View>
        ) : (
          <View style={styles.cardsContainer}>
            {bookmarkedSpots.map((item) => (
              <BookmarkCard key={item._id || item.id} item={item} />
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 50,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
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
    color: '#4a4a4a',
  },

  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3a3a3a',
    justifyContent: 'center',
    alignItems: 'center',
  },

  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3a3a3a',
  },

  scrollContent: {
    paddingHorizontal: 20,
  },

  cardsContainer: {
    gap: 15,
  },

  card: {
    backgroundColor: '#f7cfc9',
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    position: 'relative',
  },

  cardImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#e0e0e0',
  },

  bookmarkButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  cardContent: {
    padding: 15,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4a4a4a',
    marginBottom: 5,
  },

  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  locationText: {
    fontSize: 13,
    color: '#6a5a5a',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },

  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#6a5a5a',
    marginTop: 20,
    marginBottom: 8,
  },

  emptySubtext: {
    fontSize: 14,
    color: '#8a7a7a',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});