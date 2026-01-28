import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from "@expo/vector-icons";

export default function Categories(){
    const navigation = useNavigation();
    
    return(
        <View style={{flex:1, justifyContent:'center', alignItems:'center', backgroundColor: "#f7cfc9"}}>
            <View style={styles.categoriesHeader}>
                <TouchableOpacity onPress={() => navigation.navigate('Home')}>
                    <Text>asdasdasd</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    categoriesHeader: {
        width: "90%",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
        alignSelf: "center",
    }
});