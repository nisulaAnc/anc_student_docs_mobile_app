import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode as atob } from 'base-64';
import { useFonts, Poppins_600SemiBold } from '@expo-google-fonts/poppins';

export default function LaunchScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const [fontsLoaded] = useFonts({ Poppins_600SemiBold });

    useEffect(() => {
        const timer = setTimeout(async () => {
            try {
                const token = await AsyncStorage.getItem('counsellorSession');
                if (token) {
                    const parts = token.split('.');
                    const payload = parts.length === 3 ? JSON.parse(atob(parts[1])) : null;
                    const expired = payload?.exp && payload.exp * 1000 <= Date.now();
                    if (payload && !expired) {
                        navigation.replace('Home');
                        return;
                    }
                    await AsyncStorage.removeItem('counsellorSession');
                }
            } catch (e) {
                await AsyncStorage.removeItem('counsellorSession');
            }
            navigation.replace('Home');
        }, 2500);

        return () => clearTimeout(timer);
    }, [navigation]);

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor="#1E3A8A" />
            <View style={styles.content}>
                <View style={styles.logoContainer}>
                    <Image
                        source={require('../../assets/Docs logo.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                </View>
                {/* {fontsLoaded && <Text style={styles.title}>Student Docs</Text>} */}
                {fontsLoaded && <Text style={styles.title}>DMS</Text>}
            </View>
            <View style={styles.footer}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1E3A8A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    logoContainer: {
        width: 140,
        height: 140,
        backgroundColor: '#FFFFFF',
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
        overflow: 'hidden',
    },
    logo: {
        width: 112,
        height: 112,
        borderRadius: 22,
    },
    title: {
        color: '#FFFFFF',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 26,
        marginTop: 20,
    },
    footer: {
        alignItems: 'center',
        paddingBottom: 40,
    },
    loadingText: {
        color: '#FFFFFF',
        marginTop: 12,
        fontSize: 14,
        fontWeight: '600',
        opacity: 0.8,
    }
});