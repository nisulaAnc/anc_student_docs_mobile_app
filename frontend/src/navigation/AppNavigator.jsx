import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import HomeScreen from '../screens/HomeScreen';
import CFRegistrationScreen from '../screens/CFRegistrationScreen';
import CounsellorPortalScreen from '../screens/CounsellorPortalScreen';
import StudentPortalScreen from '../screens/StudentPortalScreen';
import QRScanScreen from '../screens/QRScanScreen';
import LaunchScreen from '../screens/LaunchScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Launch">
        <Stack.Screen name="Launch" component={LaunchScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="CFRegistration" component={CFRegistrationScreen} />
        <Stack.Screen name="CounsellorPortal" component={CounsellorPortalScreen} />
        <Stack.Screen name="StudentPortal" component={StudentPortalScreen} />
        <Stack.Screen name="QRScan" component={QRScanScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
