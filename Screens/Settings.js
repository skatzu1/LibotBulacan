import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const Settings = ({ navigation }) => {
  const { logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Log Out",
          onPress: async () => {
            try {
              await logout();
              navigation.replace('Login');
            } catch (error) {
              Alert.alert("Error", "Failed to log out. Please try again.");
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  const MenuItem = ({ icon, title, onPress }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuLeft}>
        <Feather name={icon} size={20} color="#4a4a4a" />
        <Text style={styles.menuText}>{title}</Text>
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
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ACCOUNT SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <MenuItem 
            icon="user" 
            title="Edit profile" 
            onPress={() => console.log('Edit profile')} 
          />
          <MenuItem 
            icon="shield" 
            title="Security" 
            onPress={() => console.log('Security')} 
          />
          <MenuItem 
            icon="bell" 
            title="Notifications" 
            onPress={() => console.log('Notifications')} 
          />
          <MenuItem 
            icon="lock" 
            title="Privacy" 
            onPress={() => console.log('Privacy')} 
          />
        </View>

        {/* SUPPORT & ABOUT SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support & About</Text>
          <MenuItem 
            icon="help-circle" 
            title="Help & Support" 
            onPress={() => console.log('Help & Support')} 
          />
          <MenuItem 
            icon="info" 
            title="About us" 
            onPress={() => console.log('About us')} 
          />
          <MenuItem 
            icon="file-text" 
            title="Terms and Policies" 
            onPress={() => console.log('Terms and Policies')} 
          />
        </View>

        {/* ACTIONS SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <MenuItem 
            icon="flag" 
            title="Report a problem" 
            onPress={() => console.log('Report a problem')} 
          />
          <MenuItem 
            icon="user-plus" 
            title="Add account" 
            onPress={() => console.log('Add account')} 
          />
          <MenuItem 
            icon="log-out" 
            title="Log out" 
            onPress={handleLogout} 
          />
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
};

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
    fontSize: 20,
    fontWeight: '600',
    color: '#4a4a4a',
  },

  scrollContent: {
    paddingHorizontal: 20,
  },

  section: {
    marginBottom: 30,
  },

  sectionTitle: {
    fontSize: 14,
    color: '#4a4a4a',
    marginBottom: 15,
    fontWeight: '600',
    marginLeft: 5,
  },

  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 5,
    marginBottom: 5,
  },

  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  menuText: {
    fontSize: 16,
    color: '#4a4a4a',
    fontWeight: '500',
    marginLeft: 15,
  },
});

export default Settings;