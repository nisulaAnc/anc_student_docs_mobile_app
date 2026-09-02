import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import HomeScreen from '../screens/HomeScreen';
import CFRegistrationScreen from '../screens/CFRegistrationScreen';
import CFDashboardScreen from '../screens/CFDashboardScreen';
import CounsellorPortalScreen from '../screens/CounsellorPortalScreen';
import StudentPortalScreen from '../screens/StudentPortalScreen';
import QRScanScreen from '../screens/QRScanScreen';
import LaunchScreen from '../screens/LaunchScreen';
import StaffLoginScreen from '../screens/StaffLoginScreen';
import StaffRegisterScreen from '../screens/StaffRegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Launch">
        <Stack.Screen name="Launch" component={LaunchScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="CFRegistration" component={CFRegistrationScreen} />
        <Stack.Screen name="CFDashboard" component={CFDashboardScreen} />
        <Stack.Screen name="CounsellorPortal" component={CounsellorPortalScreen} />
        <Stack.Screen name="StudentPortal" component={StudentPortalScreen} />
        <Stack.Screen name="StaffLogin" component={StaffLoginScreen} />
        <Stack.Screen name="StaffRegister" component={StaffRegisterScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="QRScan" component={QRScanScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
