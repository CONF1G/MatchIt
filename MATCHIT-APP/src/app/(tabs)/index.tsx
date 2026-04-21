import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
// Schimbă aici:
import { FlashList } from "@shopify/flash-list"; 
import FeedItem from '../../components/feed/FeedItem';
import posts from '../../../assets/data/posts';

export default function HomeScreen() {
  const numColumns = Platform.OS === 'web' ? 7 : 2;
  const memoizedPosts = useMemo(() => posts, []);
  const COLUMN_GAP = 12;
  
  return (
    <View style={styles.screen}>
      <FlashList
        data={memoizedPosts}
        numColumns={numColumns}
        keyExtractor={(item: any) => item.id.toString()}
        renderItem={({ item, index }) => (  
          <View style={[  
            styles.itemWrapper,  
            {  
              paddingLeft: (index % numColumns) === 0 ? 0 : COLUMN_GAP / 2,  
              paddingRight: (index % numColumns) === (numColumns - 1) ? 0 : COLUMN_GAP / 2,  
            }  
          ]}>  
            <FeedItem feeditem={item} />  
          </View>  
        )}  
        contentContainerStyle={styles.listPadding}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listPadding: {
    paddingHorizontal: 5, // Micșorează padding-ul general
    paddingTop: 10,
  },
  itemWrapper: {
    flex: 1, // Ensures the item takes up exactly half the width
    marginBottom: 12, // Vertical gap between rows
  }
});