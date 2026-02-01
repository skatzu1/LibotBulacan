import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

export default function Bookmark() {
  const navigation = useNavigation();

  // Sample bookmarked destinations
  const [bookmarks, setBookmarks] = useState([
    {
      id: 1,
      name: "Biak na bato",
      image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
      location: "San Miguel, Bulacan",
      isBookmarked: true
    },
    {
      id: 2,
      name: "Ocean View",
      image: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800",
      location: "Palawan",
      isBookmarked: true
    },
    {
      id: 3,
      name: "Tourist Destination",
      image: "https://images.unsplash.com/photo-1523712999610-f77fbcfc3843?w=800",
      location: "El Nido",
      isBookmarked: true
    },
    {
      id: 4,
      name: "Kapurpurawan Rock",
      image: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800",
      location: "Ilocos Norte",
      isBookmarked: true
    },
    {
      id: 5,
      name: "Enchanting Falls",
      image: "https://images.unsplash.com/photo-1511576661531-b34d7da5d0bb?w=800",
      location: "Bulacan",
      isBookmarked: true
    },
    {
      id: 6,
      name: "Bitbit Ripple",
      image: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800",
      location: "Nueva Ecija",
      isBookmarked: true
    },
    {
      id: 7,
      name: "100Ks Baawan",
      image: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800",
      location: "Pangasinan",
      isBookmarked: true
    },
  ]);

  const toggleBookmark = (id) => {
    setBookmarks(bookmarks.map(item => 
      item.id === id ? { ...item, isBookmarked: !item.isBookmarked } : item
    ));
  };

  const BookmarkCard = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => navigation.navigate('InformationScreen', { destination: item })}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: item.image }} 
        style={styles.cardImage}
        resizeMode="cover"
      />
      <TouchableOpacity 
        style={styles.bookmarkButton}
        onPress={() => toggleBookmark(item.id)}
        activeOpacity={0.8}
      >
        <Feather 
          name="bookmark" 
          size={20} 
          color={item.isBookmarked ? "#f4c542" : "#fff"} 
          fill={item.isBookmarked ? "#f4c542" : "transparent"}
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
          style={styles.profileButton}
        >
          <Feather name="user" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {bookmarks.filter(item => item.isBookmarked).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="bookmark" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No bookmarks yet</Text>
            <Text style={styles.emptySubtext}>
              Start exploring and save your favorite destinations
            </Text>
          </View>
        ) : (
          <View style={styles.cardsContainer}>
            {bookmarks
              .filter(item => item.isBookmarked)
              .map((item) => (
                <BookmarkCard key={item.id} item={item} />
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
    backgroundColor: '#f5c4c1',
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

  scrollContent: {
    paddingHorizontal: 20,
  },

  cardsContainer: {
    gap: 15,
  },

  card: {
    backgroundColor: '#fff',
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