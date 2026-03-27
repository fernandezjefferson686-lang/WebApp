import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { getToken, clearAll } from "../storage/auth";

// Auth screens
import LoginScreen           from "../screens/auth/LoginScreen";
import RegisterScreen        from "../screens/auth/RegisterScreen";
import ForgotPasswordScreen  from "../screens/auth/ForgotPasswordScreen";

// App screens
import DashboardScreen           from "../screens/DashboardScreen";
import CounselingRequestScreen   from "../screens/CounselingRequestScreen";
import CounselingHistoryScreen   from "../screens/CounselingHistoryScreen";
import CounselingRecordsScreen   from "../screens/CounselingRecordsScreen";
import MessagesScreen            from "../screens/MessagesScreen";
import ProfileScreen             from "../screens/ProfileScreen";
import SetupProfileScreen        from "../screens/SetupProfileScreen";

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Tab Icon ─────────────────────────────────────────────────
function TabIcon({ emoji, focused }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>;
}

// ── Bottom Tabs ──────────────────────────────────────────────
function MainTabs({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator screenOptions={{
      tabBarActiveTintColor:   "#1e3a5f",
      tabBarInactiveTintColor: "#94a3b8",
      tabBarStyle: {
        paddingBottom:   Math.max(insets.bottom, 8),
        paddingTop:      8,
        height:          56 + Math.max(insets.bottom, 8),
        borderTopColor:  "#e2e8f0",
        borderTopWidth:  1,
        elevation:       12,
        shadowColor:     "#000",
        shadowOpacity:   0.08,
        shadowRadius:    8,
        backgroundColor: "#fff",
      },
      tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginBottom: 2 },
      headerShown:      false,
    }}>
      <Tab.Screen name="Dashboard" component={DashboardScreen}
        options={{ tabBarLabel: "Home",    tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused}/> }}/>
      <Tab.Screen name="CounselingRequest" component={CounselingRequestScreen}
        options={{ tabBarLabel: "Request", tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused}/> }}/>
      <Tab.Screen name="History" component={CounselingHistoryScreen}
        options={{ tabBarLabel: "History", tabBarIcon: ({ focused }) => <TabIcon emoji="🕐" focused={focused}/> }}/>
      <Tab.Screen name="Messages" component={MessagesScreen}
        options={{ tabBarLabel: "Messages",tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused}/> }}/>
      <Tab.Screen name="Records" component={CounselingRecordsScreen}
        options={{ tabBarLabel: "Records", tabBarIcon: ({ focused }) => <TabIcon emoji="📁" focused={focused}/> }}/>
      <Tab.Screen name="Profile" component={ProfileScreen}
        options={{ tabBarLabel: "Profile", tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused}/> }}/>
    </Tab.Navigator>
  );
}

// ── Main app — Tabs only, Records is inside Tab navigator ──
function MainStack() {
  return <MainTabs/>;
}

// ── Root Navigator ───────────────────────────────────────────
export default function AppNavigator() {
  const [isLoggedIn, setIsLoggedIn] = useState(null);

  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await getToken();
        setIsLoggedIn(!!token && token !== "null" && token !== "undefined");
      } catch {
        setIsLoggedIn(false);
      }
    };
    checkToken();
  }, []);

  if (isLoggedIn === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a" }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🧠</Text>
        <ActivityIndicator color="#2563eb" size="large"/>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}
        initialRouteName={isLoggedIn ? "Main" : "Login"}>
        <Stack.Screen name="Login"          component={LoginScreen}/>
        <Stack.Screen name="Register"       component={RegisterScreen}/>
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen}/>
        <Stack.Screen name="SetupProfile"   component={SetupProfileScreen}/>
        <Stack.Screen name="Main"           component={MainStack}/>
      </Stack.Navigator>
    </NavigationContainer>
  );
}