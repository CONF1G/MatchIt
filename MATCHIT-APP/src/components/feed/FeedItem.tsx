import React, { memo } from 'react'; // Pentru a preveni re-randări inutile
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import { Image } from 'expo-image'; // Importă din expo-image

// Define ThemedText as a functional component for clarity and type safety
const ThemedText: React.FC<{ style?: any; [key: string]: any }> = ({ style, ...props }) => <Text style={style} {...props} />;

// Folosim memo pentru ca FeedItem să nu se re-rendereze la fiecare scroll
const FeedItem = memo(({ feeditem }: { feeditem: { title: string; image: any; aspectRatio?: number } }) => {
    const { title, image, aspectRatio } = feeditem;

    return (
        <View style={styles.post}>
            <Image
                source={image}
                // Folosește aspectRatio din datele primite, sau default 1
                style={[styles.image, { aspectRatio: aspectRatio || 1 }]} 
                contentFit="cover"
                transition={200} // Fade-in fin când se încarcă
                cachePolicy="memory-disk" // Salvează imaginea să nu o mai descarce
            />
            <View style={styles.postFooter}>
                <ThemedText style={styles.title} numberOfLines={1}>
                    {title}
                </ThemedText>
                <TouchableOpacity 
                    onPress={() => console.log('Menu opened')}
                    style={styles.menuButton}
                >
                    <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
                </TouchableOpacity>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    post: {
        width: '100%',
    },
    image: {
        width: "100%",
        borderRadius: 20, // Puțin mai mic pentru un look modern
        backgroundColor: '#f0f0f0', // Placeholder gri până se încarcă
    },
    title: {
        fontSize: 14, // Mai mic pentru Masonry
        fontWeight: "600",
        flex: 1, // Ocupă spațiul rămas
        
    },
    postFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 4,
    },
    menuButton: {
        padding: 2,
    }
});

export default FeedItem;