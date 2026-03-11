import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  mountainName: string;
  elevation?: number;
  onOrbitStart: () => void;
  onOrbitStop: () => void;
  onLookAtFace: (heading: number) => void;
  onTerrainExaggeration: (factor: number) => void;
  onClose: () => void;
}

const FACES = [
  { label: 'N', heading: 180 },
  { label: 'NE', heading: 225 },
  { label: 'E', heading: 270 },
  { label: 'SE', heading: 315 },
  { label: 'S', heading: 0 },
  { label: 'SW', heading: 45 },
  { label: 'W', heading: 90 },
  { label: 'NW', heading: 135 },
];

const EXAGGERATION_LEVELS = [1, 1.5, 2, 3];

export default function MountainInspector({
  mountainName,
  elevation,
  onOrbitStart,
  onOrbitStop,
  onLookAtFace,
  onTerrainExaggeration,
  onClose,
}: Props) {
  const [orbiting, setOrbiting] = useState(false);
  const [exaggeration, setExaggeration] = useState(1);
  const [selectedFace, setSelectedFace] = useState<string | null>(null);

  const handleOrbitToggle = () => {
    if (orbiting) {
      onOrbitStop();
    } else {
      onOrbitStart();
    }
    setOrbiting(!orbiting);
  };

  const handleFaceSelect = (face: typeof FACES[0]) => {
    setSelectedFace(face.label);
    onLookAtFace(face.heading);
  };

  const handleExaggeration = (factor: number) => {
    setExaggeration(factor);
    onTerrainExaggeration(factor);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{mountainName}</Text>
          {elevation != null && (
            <Text style={styles.elevation}>{Math.round(elevation)}m</Text>
          )}
        </View>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Orbit control */}
      <TouchableOpacity
        style={[styles.orbitBtn, orbiting && styles.orbitBtnActive]}
        onPress={handleOrbitToggle}
      >
        <Text style={[styles.orbitBtnText, orbiting && styles.orbitBtnTextActive]}>
          {orbiting ? 'Stop Orbit' : 'Orbit Peak'}
        </Text>
      </TouchableOpacity>

      {/* Face selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>View Face</Text>
        <View style={styles.faceGrid}>
          {FACES.map((face) => (
            <TouchableOpacity
              key={face.label}
              style={[styles.faceBtn, selectedFace === face.label && styles.faceBtnActive]}
              onPress={() => handleFaceSelect(face)}
            >
              <Text style={[styles.faceBtnText, selectedFace === face.label && styles.faceBtnTextActive]}>
                {face.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Terrain exaggeration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Terrain Relief</Text>
        <View style={styles.exaggerationRow}>
          {EXAGGERATION_LEVELS.map((level) => (
            <TouchableOpacity
              key={level}
              style={[styles.exagBtn, exaggeration === level && styles.exagBtnActive]}
              onPress={() => handleExaggeration(level)}
            >
              <Text style={[styles.exagBtnText, exaggeration === level && styles.exagBtnTextActive]}>
                {level}x
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a2035',
    borderRadius: 12,
    margin: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a3050',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: { color: '#e8eaf6', fontWeight: '700', fontSize: 16 },
  elevation: { color: '#7eb8f7', fontSize: 14, fontWeight: '600', marginTop: 2 },
  close: { color: '#6b7a99', fontSize: 18, paddingHorizontal: 4 },
  orbitBtn: {
    backgroundColor: '#2d4a7a',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  orbitBtnActive: { backgroundColor: '#7eb8f7' },
  orbitBtnText: { color: '#7eb8f7', fontWeight: '700', fontSize: 14 },
  orbitBtnTextActive: { color: '#0a0f1e' },
  section: { marginBottom: 10 },
  sectionTitle: {
    color: '#6b7a99',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  faceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  faceBtn: {
    backgroundColor: '#0d1428',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a3050',
  },
  faceBtnActive: { borderColor: '#7eb8f7', backgroundColor: '#2d4a7a' },
  faceBtnText: { color: '#6b7a99', fontSize: 12, fontWeight: '600' },
  faceBtnTextActive: { color: '#7eb8f7' },
  exaggerationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  exagBtn: {
    flex: 1,
    backgroundColor: '#0d1428',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a3050',
  },
  exagBtnActive: { borderColor: '#7eb8f7', backgroundColor: '#2d4a7a' },
  exagBtnText: { color: '#6b7a99', fontSize: 13, fontWeight: '600' },
  exagBtnTextActive: { color: '#7eb8f7' },
});
