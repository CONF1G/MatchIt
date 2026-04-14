import { Tabs } from "expo-router";
import { Image, View, TextInput } from "react-native";
import { AntDesign, Feather } from "@expo/vector-icons";
import LogoImg from "../../../assets/logo.png";

/**
 * Renders the app's bottom tab navigator with five configured tabs.
 *
 * The navigator includes:
 * - Home (`index`) — header title "MatchIt" and a home icon; tab label hidden.
 * - Search (`search`) — tab label hidden and a `headerRight` search input (icon + TextInput); search tab icon shown in the tab bar.
 * - MatchLobby (`matchLobby`) — uses the app logo as the tab icon and sets the logo opacity to 1 when focused and 0.6 otherwise; tab label hidden.
 * - Create (`create`) — plus icon; tab label hidden.
 * - Profile (`profile`) — user icon; tab label hidden.
 *
 * @returns A JSX element rendering the configured Tabs navigator.
 */
export default function TabLayout() { 
    return (
        <Tabs screenOptions={{ tabBarActiveTintColor: "black" }}>
            <Tabs.Screen name="index" options={{
                title: "Home",
                headerTitle: "MatchIt",
                tabBarShowLabel: false,
                tabBarIcon: ({ color }) => <AntDesign name="home" size={24} color={color} />
            }} />
            // on enter open search screen 

            <Tabs.Screen name="search" options={{
                title: "Search",
                tabBarShowLabel: false,
                 headerRight: () => (
                    <View style={{ flexDirection: 'row', alignItems: 'center' , backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 10 }}>
                      <AntDesign name="search" size={18} color="gray" style={{ marginRight: 10 }} />
                      <TextInput placeholder="Search..." style={{ width: 200, height: 40, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 15 }} />
                   </View>
                  ),

                tabBarIcon: ({color}) => <AntDesign name="search" size={24} color={color} />
            }} />
           <Tabs.Screen name="matchLobby" options={{
                title: "MatchLobby",
                tabBarShowLabel: false,
                tabBarIcon: ({ focused }) => (
                    <Image 
                        source={LogoImg} 
                        style={{ 
                            width: 90, 
                            height: 90, 
                            resizeMode: 'contain',
                            // Optional: make it slightly transparent when not focused
                            opacity: focused ? 1 : 0.6 
                        }} 
                    />
                )
            }} />
                <Tabs.Screen name="create" options={{
                title: "Create",
                tabBarShowLabel: false,
                tabBarIcon: ({ color }) => <AntDesign name="plus" size={24} color={color} />
            }} />
            <Tabs.Screen name="profile" options={{
                title: "Profile",
                tabBarShowLabel: false,
                tabBarIcon: ({ color }) => <AntDesign name="user" size={24} color={color} />
            }} />
        
            
        
        </Tabs>
    );

}