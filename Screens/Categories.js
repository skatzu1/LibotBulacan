import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from "@expo/vector-icons";

export default function Categories(){
    const navigation = useNavigation();
    
    // Static categories - no database fetching
    const categories = [
        { 
            _id: 1, 
            name: 'Culture & Traditions', 
            image: 'https://images.unsplash.com/photo-1555881770-68ab362c0ce6?w=400'
        },
        { 
            _id: 2, 
            name: 'History & Religious Heritage', 
            image: 'https://images.unsplash.com/photo-1609137144813-7d9921338f24?w=400'
        },
        { 
            _id: 3, 
            name: 'Nature & Landscapes', 
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400'
        },
        { 
            _id: 4, 
            name: 'People & Achievements', 
            image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=400'
        },
    ];
    
    return(
        <View style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity 
                    onPress={() => navigation.goBack()}
                    style={styles.headerButton}
                >
                    <Feather name="arrow-left" size={24} color="#4a4a4a" />
                </TouchableOpacity>
                
                <View style={styles.headerCenter}>
                    <Image 
                        source={require('../assets/logo.png')} 
                        style={styles.logo}
                        resizeMode="contain"
                    />
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
                {/* TITLE */}
                <View style={styles.titleContainer}>
                    <Text style={styles.categoryTitle}>category</Text>
                </View>

                {/* GRID */}
                <View style={styles.gridContainer}>
                    {categories.map((category) => (
                        <TouchableOpacity 
                            key={category._id || category.id}
                            style={styles.categoryCard}
                            onPress={() => {
                                console.log(`Pressed ${category.name}`);
                                // Navigate to category details or filter spots by category
                                // navigation.navigate('CategoryDetails', { category });
                            }}
                            activeOpacity={0.8}
                        >
                            <Image 
                                source={{ uri: category.image }} 
                                style={styles.categoryImage}
                                resizeMode="cover"
                            />
                            <View style={styles.categoryOverlay}>
                                <Text style={styles.categoryText}>{category.name}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={{ height: 100 }} />
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
        alignItems: "center",
    },

    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 25,
        paddingHorizontal: 20,
    },

    headerButton: {
        width: 36,
        height: 36,
        justifyContent: "center",
        alignItems: "center",
    },

    profileIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#3a3a3a",
        justifyContent: "center",
        alignItems: "center",
    },

    headerCenter: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    logo: {
        width: 40,
        height: 40,
    },

    titleContainer: {
        marginBottom: 20,
        paddingHorizontal: 5,
        alignItems: "center",
        width: "100%",
    },

    categoryTitle: {
        fontSize: 32,
        fontWeight: "700",
        color: "#333",
        textAlign: "center",
    },

    gridContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        paddingHorizontal: 5,
        alignSelf: "center",
        width: "100%",
        maxWidth: 400,
    },

    categoryCard: {
        width: "48%",
        aspectRatio: 0.95,
        marginBottom: 12,
        borderRadius: 25,
        overflow: "hidden",
        backgroundColor: "#fff",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
    },

    categoryImage: {
        width: "100%",
        height: "100%",
        resizeMode: "cover",
    },

    categoryOverlay: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "rgba(255,255,255,0.95)",
        paddingVertical: 8,
        paddingHorizontal: 8,
        alignItems: "center",
    },

    categoryText: {
        fontSize: 11,
        fontWeight: "600",
        color: "#333",
        textAlign: "center",
        lineHeight: 14,
    },
});