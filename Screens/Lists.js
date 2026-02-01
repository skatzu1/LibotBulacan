import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

export default function Lists() {
  const navigation = useNavigation();
  const route = useRoute();
  
  // Get category from navigation params (default to "Culture & Traditions")
  const category = route.params?.category || "Culture & Traditions";

  // Sample data for different categories matching your Categories.js
  const destinationsData = {
    "Culture & Traditions": [
      {
        id: 1,
        name: "Kabayan",
        image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
        description: "Mummy Caves"
      },
      {
        id: 2,
        name: "Sagada",
        image: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800",
        description: "Hanging Coffins"
      },
      {
        id: 3,
        name: "Banaue",
        image: "https://images.unsplash.com/photo-1523712999610-f77fbcfc3843?w=800",
        description: "Rice Terraces"
      },
      {
        id: 4,
        name: "Vigan",
        image: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800",
        description: "Calle Crisologo"
      },
      {
        id: 5,
        name: "Pasuquin",
        image: "https://images.unsplash.com/photo-1511576661531-b34d7da5d0bb?w=800",
        description: "Salt Making"
      },
      {
        id: 6,
        name: "Baler",
        image: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800",
        description: "Surfing Beach"
      },
    ],
    "History & Religious Heritage": [
      {
        id: 1,
        name: "Paoay Church",
        image: "https://images.unsplash.com/photo-1548013146-72479768bada?w=800",
        description: "UNESCO World Heritage"
      },
      {
        id: 2,
        name: "Vigan Cathedral",
        image: "https://images.unsplash.com/photo-1609137144813-7d9921338f24?w=800",
        description: "St. Paul Cathedral"
      },
      {
        id: 3,
        name: "Bantay Bell Tower",
        image: "https://images.unsplash.com/photo-1564415315949-7a0c4c73aaf7?w=800",
        description: "Historic Landmark"
      },
    ],
    "Nature & Landscapes": [
      {
        id: 1,
        name: "100 Islands",
        image: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800",
        description: "Island Hopping"
      },
      {
        id: 2,
        name: "Pagudpud Beach",
        image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
        description: "White Sand Beach"
      },
      {
        id: 3,
        name: "Mount Pulag",
        image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
        description: "Sea of Clouds"
      },
      {
        id: 4,
        name: "Tangadan Falls",
        image: "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800",
        description: "Natural Waterfall"
      },
    ],
    "People & Achievements": [
      {
        id: 1,
        name: "Crisologo Museum",
        image: "https://images.unsplash.com/photo-1566127992631-137a642a90f4?w=800",
        description: "Local Heroes"
      },
      {
        id: 2,
        name: "Baguio Museum",
        image: "https://images.unsplash.com/photo-1574610720241-5addc1679a49?w=800",
        description: "Cultural Heritage"
      },
    ],
  };

  const destinations = destinationsData[category] || destinationsData["Culture & Traditions"];

  const DestinationCard = ({ item }) => (
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
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <View style={styles.locationContainer}>
          <Feather name="map-pin" size={14} color="#6a5a5a" />
          <Text style={styles.locationText}>{item.description}</Text>
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
        <Text style={styles.headerTitle}>{category}</Text>
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
            {destinations.length} destinations found
          </Text>
        </View>

        {/* DESTINATION CARDS */}
        <View style={styles.cardsContainer}>
          {destinations.map((item) => (
            <DestinationCard key={item.id} item={item} />
          ))}
        </View>

        <View style={{ height: 30 }} />
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
  },

  infoText: {
    fontSize: 14,
    color: '#6a5a5a',
    fontWeight: '500',
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
  },

  cardImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#e0e0e0',
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
    fontSize: 14,
    color: '#6a5a5a',
  },
});