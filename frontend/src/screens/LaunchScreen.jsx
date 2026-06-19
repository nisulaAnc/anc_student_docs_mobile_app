import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LaunchScreen({ navigation }) {
    const insets = useSafeAreaInsets();

    useEffect(() => {
        const timer = setTimeout(() => {
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
                        source={require('../../assets/logo.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                </View>
                <Text style={styles.brandName}>ANC Student Docs</Text>
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
        width: 120,
        height: 120,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
        overflow: 'hidden'
    },
    logo: {
        width: 90,
        height: 90,
    },
    brandName: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: 0.5,
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