import { Slot, useRouter, Href } from 'expo-router';
import { View, Text, TextInput, Pressable, Image, ScrollView } from 'react-native';
import { AntDesign, Feather } from '@expo/vector-icons';
import LogoImg from '../../../assets/logo.png';

// this must be a from the user saved catalogs
const catalogs = [
    { id: '1', name: 'Summer 2026', path: '/', image: 'https://picsum.photos/200' },
    { id: '2', name: 'UI Design', path: '/matchLobby', image: 'https://picsum.photos/201' },
    { id: '3', name: 'MatchIt Ideas', path: '/create', image: 'https://picsum.photos/202' },
    { id: '4', name: 'Recipes', path: '/profile', image: 'https://picsum.photos/203' },
];

interface WebNavIconProps {
  name: any;
  path: Href;
  iconFamily?: any;
}

const WebNavIcon = ({ name, path, iconFamily: IconFamily = AntDesign }: WebNavIconProps) => {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(path)} style={{ padding: 10, marginVertical: 5 }}>
      <IconFamily name={name} size={24} color="black" />
    </Pressable>
  );
};

/**
 * App layout that renders a top navigation bar, a narrow left sidebar for catalog navigation, and a main content area for routed pages.
 *
 * The top bar includes a logo that navigates to the match lobby, a centered search input, and a profile menu control. The left sidebar shows primary nav icons and a vertically scrollable list of catalog tiles that navigate to each catalog's path. The main area renders routed content via a Slot.
 *
 * @returns The layout's JSX element containing the navbar, sidebar, and content region.
 */
export default function WebLayout() {
  const router = useRouter(); // Use the hook consistently

  return (
   <View style={{ flex: 1, backgroundColor: 'white' }}>
      {/* TOP NAVBAR */}
      <View style={{ height: 60, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 }}>
        <Pressable 
          onPress={() => router.replace('/matchLobby')} 
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginRight: 20 })}
        >
          <Image source={LogoImg} style={{ width: 50, height: 50, resizeMode: 'contain' }} />
        </Pressable>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ width: '60%', height: 40, backgroundColor: '#f0f0f0', borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 }}>
            <AntDesign name="search" size={18} color="gray" style={{ marginRight: 10 }} />
            <TextInput placeholder="Search..." style={{ flex: 1 }} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Feather name="user" size={24} color="white" style={{ backgroundColor: '#ccc', borderRadius: 20, padding: 8, marginRight: 5 }} />
            <Pressable onPress={() => router.push('/profile')} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginLeft: 15 })}>
              <Feather name="chevron-down" size={18} color="black" />
            </Pressable>

        </View>
      </View>

      {/* MAIN BODY */}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        
        {/* NARROW SIDEBAR (60px) */}
        <View style={{ width: 60, borderRightWidth: 1, borderRightColor: '#eee', alignItems: 'center' }}>
          
          {/* Main Nav Icons */}
          <View style={{ paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', width: '100%', alignItems: 'center' }}>
            <WebNavIcon name="home" path="/" />
            <WebNavIcon name="plus" path="/create" />
          </View>

          {/* BATALOGS LIST (Narrow stack) */}
          <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={{ alignItems: 'center', paddingTop: 15 }}
            style={{ width: '100%' }}
          >
            {catalogs.map((board) => (
              <Pressable 
                key={board.id}
                onPress={() => router.push(board.path as Href)}
                style={({ pressed }) => ({
                  width: 40, // Narrower than the 60px sidebar
                  marginBottom: 12,
                  opacity: pressed ? 0.7 : 1,
                  alignItems: 'center'
                })}
              >
                <Image 
                  source={{ uri: board.image }} 
                  style={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: 8, // Square-ish Pinterest look
                    backgroundColor: '#f0f0f0' 
                  }} 
                />
                {/* Text is hidden or very small because 60px is too narrow for words */}
                <Text numberOfLines={1} style={{ fontSize: 8, fontWeight: '600', marginTop: 2, textAlign: 'center' }}>
                  {board.name.split(' ')[0]} {/* Only show first word */}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* CONTENT AREA */}
        <View style={{ flex: 1, backgroundColor: '#f9f9f9', padding: 20 }}>
          <Slot /> 
        </View>
      </View>
    </View>
  );
}