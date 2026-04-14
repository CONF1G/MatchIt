import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
// Schimbă aici:
import { FlashList } from "@shopify/flash-list"; 
import FeedItem from '../../components/feed/FeedItem';
import posts from '../../../assets/data/posts';

/**
 * Renders the home feed as a responsive grid of post cards.
 *
 * Renders a FlashList of posts laid out in columns (7 columns on web, 2 on other platforms) with consistent horizontal spacing between items and top/side list padding. The posts array reference is memoized to remain stable across renders.
 *
 * @returns The component's rendered JSX element representing the feed grid.
 */
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
            // Apply different padding based on which column the item is in
            index % 2 === 0 ? { paddingRight: COLUMN_GAP / 2 } : { paddingLeft: COLUMN_GAP / 2 }
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