import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import type { Bookmark } from '../../shared/types';

interface Props {
  bookmarks: Bookmark[];
  onSelect: (bookmark: Bookmark) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function BookmarkPanel({ bookmarks, onSelect, onDelete, onClose }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bookmarks ({bookmarks.length})</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>

      {bookmarks.length === 0 ? (
        <Text style={styles.empty}>
          No bookmarks yet. Tap a location and save it to quickly return later.
        </Text>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {bookmarks.map((bm) => (
            <View key={bm.id} style={styles.item}>
              <TouchableOpacity style={styles.itemContent} onPress={() => onSelect(bm)}>
                <Text style={styles.itemName}>{bm.name}</Text>
                <Text style={styles.itemMeta}>
                  {bm.lat.toFixed(4)}, {bm.lon.toFixed(4)} · {Math.round(bm.altitude)}m
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(bm.id)}>
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a2035',
    borderRadius: 12,
    margin: 10,
    maxHeight: 240,
    borderWidth: 1,
    borderColor: '#2a3050',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a3050',
  },
  title: { color: '#e8eaf6', fontWeight: '700', fontSize: 14 },
  close: { color: '#6b7a99', fontSize: 18, paddingHorizontal: 4 },
  empty: { color: '#6b7a99', fontSize: 12, padding: 16, textAlign: 'center' },
  list: { padding: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#242d45',
  },
  itemContent: { flex: 1 },
  itemName: { color: '#e8eaf6', fontSize: 14, fontWeight: '600' },
  itemMeta: { color: '#6b7a99', fontSize: 11, marginTop: 2 },
  deleteBtn: { padding: 6 },
  deleteText: { color: '#e74c3c', fontSize: 14 },
});
