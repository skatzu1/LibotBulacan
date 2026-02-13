import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useBookmark } from '../context/BookmarkContext';
import { FontAwesome5 } from '@expo/vector-icons';

// 🔥 CHANGE THIS TO YOUR RENDER BACKEND URL
const API_URL = 'https://libotbackend.onrender.com';

export default function Lists() {
  const navigation = useNavigation();
  const route = useRoute();
  const { isBookmarked, toggleBookmark } = useBookmark();
  
  // Get category from navigation params
  const category = route.params?.category || "Religious";
  const displayName = route.params?.displayName || category;
  
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);

  // Fallback data if backend is unavailable
  const fallbackData = {
    "Religious": [
      {
        _id: '1',
        name: "Barasoain Church",
        image: "https://images.unsplash.com/photo-1548013146-72479768bada?w=800",
        description: "Our Lady of Mount Carmel Parish",
        visitingHours: "6am to 6pm",
        entranceFee: "Free"
      },
      {
        _id: '2',
        name: "Paoay Church",
        image: "https://images.unsplash.com/photo-1609137144813-7d9921338f24?w=800",
        description: "UNESCO World Heritage",
        visitingHours: "8am to 5pm",
        entranceFee: "₱50"
      },
    ],
    "Nature": [
      {
        _id: '1',
        name: "Biak-na-Bato National Park",
        image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
        description: "Historical and natural site in Bulacan",
        visitingHours: "7am to 5pm",
        entranceFee: "₱100"
      },
      {
        _id: '2',
        name: "Mount Pulag",
        image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
        description: "Sea of Clouds",
        visitingHours: "5am to 7pm",
        entranceFee: "₱500"
      },
    ],
    "Historical": [
      {
        _id: '1',
        name: "Vigan Heritage",
        image: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800",
        description: "Spanish colonial city",
        visitingHours: "24/7",
        entranceFee: "Free"
      },
    ],
    "Festivals": [
      {
        _id: '1',
        name: "Pahiyas Festival",
        image: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800",
        description: "Harvest festival celebration",
        visitingHours: "All day during festival",
        entranceFee: "Free"
      },
    ],
  };

  useEffect(() => {
    loadDestinations();
  }, [category]);

  const loadDestinations = async () => {
  try {
    setLoading(true);
    setError(null);
    setUsingFallback(false);
    
    console.log(`📍 Fetching spots for category: ${category}`);
    console.log(`🌐 API URL: ${API_URL}/api/spots/category/${category}`);
    
    const response = await fetch(
      `${API_URL}/api/spots/category/${encodeURIComponent(category)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log(`📡 Response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // ✅ FIX: Access spots array from response
    const spots = data.spots || data;
    console.log(`✅ Received ${spots.length} spots from backend`);
    console.log('📦 Data:', JSON.stringify(data, null, 2));
    
    if (spots.length > 0) {
      const transformedData = spots.map(spot => ({
        _id: spot._id,
        name: spot.name,
        image: spot.image,
        description: spot.description,
        coordinates: spot.coordinates,
        category: spot.category,
        location: spot.location,
        visitingHours: spot.visitingHours || "6am to 10pm",
        entranceFee: spot.entranceFee || "Free",
        history: spot.history || "Historical information coming soon...",
        recommendations: spot.recommendations || "Recommendations coming soon..."
      }));
      
      setDestinations(transformedData);
    } else {
      console.log('⚠️ No spots found in backend, using fallback data');
      setDestinations(fallbackData[category] || []);
      setUsingFallback(true);
    }
    
  } catch (error) {
    console.error('❌ Error loading destinations:', error);
    console.log('🔄 Using fallback data');
    
    setDestinations(fallbackData[category] || []);
    setError('Using offline data');
    setUsingFallback(true);
    
  } finally {
    setLoading(false);
  }
};

  const DestinationCard = ({ item }) => {
    const spotIsBookmarked = isBookmarked(item._id);

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => {
          console.log('Navigating to InformationScreen with spot:', item.name, 'ID:', item._id);
          navigation.navigate('InformationScreen', { spot: item });
        }}
        activeOpacity={0.8}
      >
        <Image 
          source={{ uri: item.image }} 
          style={styles.cardImage}
          resizeMode="cover"
        />
        
        {/* BOOKMARK BUTTON */}
        <TouchableOpacity 
          style={styles.bookmarkButton}
          onPress={(e) => {
            e.stopPropagation(); // Prevent card press
            console.log('Bookmark pressed for:', item.name, 'ID:', item._id);
            toggleBookmark(item);
          }}
          activeOpacity={0.8}
        >
        <FontAwesome5
          name="bookmark"
          size={24}
          solid={spotIsBookmarked}   // true = filled, false = outline
          color={spotIsBookmarked ? "#f4c542" : "#f7cfc9"}
        />
        </TouchableOpacity>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.name}
          </Text>
          {item.location && (
            <View style={styles.locationContainer}>
              <Feather name="map-pin" size={12} color="#6a5a5a" />
              <Text style={styles.locationText}>{item.location}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a4a4a" />
        <Text style={styles.loadingText}>Loading destinations...</Text>
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>{displayName}</Text>
        <TouchableOpacity style={styles.searchButton}>
          <Feather name="search" size={22} color="#4a4a4a" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* CATEGORY INFO */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            {destinations.length} destination{destinations.length !== 1 ? 's' : ''} found
          </Text>
          {usingFallback && (
            <View style={styles.offlineBadge}>
              <Feather name="wifi-off" size={12} color="#e67e22" />
              <Text style={styles.offlineText}>Offline</Text>
            </View>
          )}
        </View>

        {/* DESTINATION CARDS */}
        {destinations.length > 0 ? (
          <View style={styles.cardsContainer}>
            {destinations.map((item) => (
              <DestinationCard key={item._id} item={item} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Feather name="map" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No destinations found</Text>
            <Text style={styles.emptySubtext}>Try selecting a different category</Text>
          </View>
        )}

        <View style={{ height: 30 }} />
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

  loadingContainer: {
    flex: 1,
    backgroundColor: '#f5c4c1',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#4a4a4a',
    fontWeight: '500',
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
    fontSize: 16,
    fontWeight: '600',
    color: '#4a4a4a',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },

  searchButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },

  scrollContent: {
    paddingHorizontal: 20,
  },

  infoContainer: {
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  infoText: {
    fontSize: 14,
    color: '#6a5a5a',
    fontWeight: '500',
  },

  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },

  offlineText: {
    fontSize: 12,
    color: '#e67e22',
    fontWeight: '600',
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
    height: 160,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },

  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#888',
    marginTop: 15,
  },

  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
});