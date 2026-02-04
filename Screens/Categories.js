import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from "@expo/vector-icons";

const { width } = Dimensions.get('window');

export default function Categories(){
    const navigation = useNavigation();
    
    // Categories matching YOUR database exactly
    const categories = [
        { 
            _id: 1, 
            name: 'Religious', 
            backendCategory: 'Religious', // Matches your DB
            image: 'https://images.unsplash.com/photo-1555881770-68ab362c0ce6?w=400',
            icon: 'users'
        },
        { 
            _id: 2, 
            name: 'Historical', 
            backendCategory: 'Historical', // For future historical spots
            image: 'https://images.unsplash.com/photo-1609137144813-7d9921338f24?w=400',
            icon: 'book'
        },
        { 
            _id: 3, 
            name: 'Nature', 
            backendCategory: 'Nature', // Matches your DB
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
            icon: 'globe'
        },
        { 
            _id: 4, 
            name: 'Festivals', 
            backendCategory: 'Festivals', // For future festival spots
            image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=400',
            icon: 'award'
        },
    ];
    
    return(
        <View style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity 
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Feather name="chevron-left" size={28} color="#4a4a4a" />
                </TouchableOpacity>
                
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Explore</Text>
                </View>
                
                <TouchableOpacity 
                    onPress={() => navigation.navigate('Profile')}
                    style={styles.profileIcon}
                >
                    <Feather name="user" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            <ScrollView 
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* SUBTITLE */}
                <View style={styles.subtitleContainer}>
                    <Text style={styles.subtitle}>Discover Categories</Text>
                    <Text style={styles.description}>
                        Choose a category to explore amazing destinations
                    </Text>
                </View>

                {/* GRID */}
                <View style={styles.gridContainer}>
                    {categories.map((category, index) => (
                        <TouchableOpacity 
                            key={category._id}
                            style={[
                                styles.categoryCard,
                                { marginTop: index % 2 !== 0 ? 20 : 0 }
                            ]}
                            onPress={() => {
                                console.log(`Pressed ${category.name} -> Backend category: ${category.backendCategory}`);
                                navigation.navigate('Lists', { 
                                    category: category.backendCategory,
                                    displayName: category.name 
                                });
                            }}
                            activeOpacity={0.85}
                        >
                            <Image 
                                source={{ uri: category.image }} 
                                style={styles.categoryImage}
                                resizeMode="cover"
                            />
                            
                            {/* Gradient Overlay */}
                            <View style={styles.gradientOverlay}>
                                <View style={styles.overlayContent}>
                                    <View style={styles.iconContainer}>
                                        <Feather 
                                            name={category.icon} 
                                            size={28} 
                                            color="#fff" 
                                        />
                                    </View>
                                    <Text style={styles.categoryText}>
                                        {category.name}
                                    </Text>
                                    <View style={styles.arrowContainer}>
                                        <Feather name="arrow-right" size={18} color="#fff" />
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f5c4c1",
        paddingTop: 50,
    },

    scrollView: {
        flex: 1,
    },

    scrollContent: {
        paddingHorizontal: 20,
    },

    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
        paddingHorizontal: 20,
    },

    backButton: {
        width: 40,
        height: 40,
        justifyContent: "center",
        alignItems: "flex-start",
    },

    headerCenter: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    headerTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#4a4a4a",
    },

    profileIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#4a4a4a",
        justifyContent: "center",
        alignItems: "center",
    },

    subtitleContainer: {
        marginBottom: 30,
        alignItems: "center",
    },

    subtitle: {
        fontSize: 26,
        fontWeight: "700",
        color: "#2a2a2a",
        marginBottom: 8,
        textAlign: "center",
    },

    description: {
        fontSize: 14,
        color: "#6a5a5a",
        textAlign: "center",
        paddingHorizontal: 20,
        lineHeight: 20,
    },

    gridContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        width: "100%",
    },

    categoryCard: {
        width: "48%",
        height: 220,
        marginBottom: 20,
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: "#fff",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },

    categoryImage: {
        width: "100%",
        height: "100%",
        position: "absolute",
    },

    gradientOverlay: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        top: 0,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "flex-end",
        padding: 15,
    },

    overlayContent: {
        alignItems: "center",
    },

    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "rgba(255,255,255,0.2)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 12,
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.3)",
    },

    categoryText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#fff",
        textAlign: "center",
        lineHeight: 18,
        marginBottom: 8,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },

    arrowContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.25)",
        justifyContent: "center",
        alignItems: "center",
    },
});