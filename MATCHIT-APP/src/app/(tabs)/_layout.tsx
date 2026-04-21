import { Tabs } from "expo-router";
import { Image, View, TextInput } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import LogoImg from "../../../assets/logo.png";

export default function TabLayout() { 
    return (
        <Tabs screenOptions={{ tabBarActiveTintColor: "black" }}>
            <Tabs.Screen name="index" options={{
                title: "Home",
                headerTitle: "MatchIt",
                tabBarShowLabel: false,
                tabBarIcon: ({ color }) => <AntDesign name="home" size={24} color={color} />
            }} />
             {/* on enter open search screen */}  

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