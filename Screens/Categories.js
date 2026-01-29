import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from "@expo/vector-icons";

export default function Categories(){
    const navigation = useNavigation();
    
    return(
        <View style={{flex:1, justifyContent:'flex-start', alignItems:'center', backgroundColor: "#f7cfc9", paddingTop: 50, flex: 1}}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.toggleDrawer()}>
                    <Feather name="menu" size={28} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Categories</Text>
                <Text>asd</Text>
            </View>

            <View style={styles.centeredText}>
                <Text style={styles.subtitle}>Explore and Have fun!</Text>
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
        marginBottom: 10,
        alignItems: "center",
    },

    subtitle: {
        fontSize: 18,
        fontWeight: "400",
    },
});
