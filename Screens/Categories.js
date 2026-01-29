import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from "@expo/vector-icons";

export default function Categories(){
    const navigation = useNavigation();
    
    const categories = [
        { id: 1, name: 'Category 1', image: require('../assets/FB_IMG_1719287573612.jpg') },
        { id: 2, name: 'Category 2', image: require('../assets/FB_IMG_1719287573612.jpg') },
        { id: 3, name: 'Category 3', image: require('../assets/FB_IMG_1719287573612.jpg') },
        { id: 4, name: 'Category 4', image: require('../assets/FB_IMG_1719287573612.jpg') },
    ];
    
    return(
        <View style={{flex:1, justifyContent:'flex-start', alignItems:'center', backgroundColor: "#f7cfc9", paddingTop: 50}}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.toggleDrawer()}>
                    <Feather name="menu" size={28} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Categories</Text>
                <View style={{width: 28}} />
            </View>

            <View style={styles.centeredText}>
                <Text style={styles.subtitle}>Explore and Have fun!</Text>
            </View>

            <View style={styles.gridContainer}>
                {categories.map((category) => (
                    <View key={category.id} style={styles.categoryWrapper}>
                        <TouchableOpacity 
                            style={styles.gridItem}
                            onPress={() => console.log(`Pressed ${category.name}`)}
                        >
                            <Image source={category.image} style={styles.categoryImage} />
                        </TouchableOpacity>
                        <Text style={styles.categoryText}>{category.name}</Text>
                    </View>
                ))}
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    header: {
        width: "90%",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
        alignSelf: "center",
    },

    headerTitle: {
        fontSize: 22,
        fontWeight: "200",
    },

    centeredText: {
        width: "100%",
        marginBottom: 20,
        alignItems: "center",
    },

    subtitle: {
        fontSize: 18,
        fontWeight: "400",
    },

    gridContainer: {
        width: "90%",
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        marginTop: 50
    },

    categoryWrapper: {
        width: "48%",
        marginBottom: 25,
        alignItems: "center",
    },

    gridItem: {
        width: "100%",
        aspectRatio: 1,
        backgroundColor: "#fff",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        overflow: "hidden",
    },

    categoryImage: {
        width: "100%",
        height: "100%",
        resizeMode: "cover",
    },

    categoryText: {
        marginTop: 8,
        fontSize: 16,
        fontWeight: "500",
        color: "#333",
    },
});