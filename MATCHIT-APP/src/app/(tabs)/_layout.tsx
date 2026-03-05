import { Tabs } from "expo-router";
import { Image } from "react-native";
import { AntDesign, Feather } from "@expo/vector-icons";
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
            <Tabs.Screen name="search" options={{
                title: "Search",
                tabBarShowLabel: false,
                tabBarIcon: ({color}) => <AntDesign name="search" size={24} color={color} />
            }} />
           <Tabs.Screen name="match" options={{
                title: "Match",
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
                <Tabs.Screen name="post" options={{
                title: "Post",
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