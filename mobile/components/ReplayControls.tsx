import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  progress: number; // 0-1
  currentAltitude: number;
  currentSpeed?: number;
  onSpeedChange: (speed: number) => void;
  onTogglePause: () => void;
  onCameraModeChange: (mode: string) => void;
  onClose: () => void;
}

const SPEEDS = [0.5, 1, 2, 5, 10];
const CAMERA_MODES = [
  { label: 'Free', value: 'free' },
  { label: 'Chase', value: 'chase' },
  { label: 'Bird\'s Eye', value: 'birdseye' },
];

export default function ReplayControls({
  progress,
  currentAltitude,
  currentSpeed,
  onSpeedChange,
  onTogglePause,
  onCameraModeChange,
  onClose,
}: Props) {
  const [paused, setPaused] = useState(false);
  const [selectedSpeed, setSelectedSpeed] = useState(1);
  const [cameraMode, setCameraMode] = useState('free');

  const handlePause = () => {
    setPaused(!paused);
    onTogglePause();
  };

  const handleSpeed = (speed: number) => {
    setSelectedSpeed(speed);
    onSpeedChange(speed);
  };

  const handleCameraMode = (mode: string) => {
    setCameraMode(mode);
    onCameraModeChange(mode);
  };

  const progressPct = Math.round(progress * 100);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Track Replay</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
      </View>

      {/* Current stats */}
      <View style={styles.statsRow}>
        <Text style={styles.statText}>{progressPct}%</Text>
        <Text style={styles.statText}>{Math.round(currentAltitude)}m alt</Text>
        {currentSpeed != null && (
          <Text style={styles.statText}>{(currentSpeed * 3.6).toFixed(0)} km/h</Text>
        )}
      </View>

      {/* Play/Pause + Speed controls */}
      <View style={styles.controlRow}>
        <TouchableOpacity style={styles.playBtn} onPress={handlePause}>
          <Text style={styles.playBtnText}>{paused ? '▶' : '⏸'}</Text>
        </TouchableOpacity>

        <View style={styles.speedRow}>
          {SPEEDS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.speedBtn, selectedSpeed === s && styles.speedBtnActive]}
              onPress={() => handleSpeed(s)}
            >
              <Text style={[styles.speedBtnText, selectedSpeed === s && styles.speedBtnTextActive]}>
                {s}x
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Camera mode */}
      <View style={styles.cameraModeRow}>
        {CAMERA_MODES.map((mode) => (
          <TouchableOpacity
            key={mode.value}
            style={[styles.cameraBtn, cameraMode === mode.value && styles.cameraBtnActive]}
            onPress={() => handleCameraMode(mode.value)}
          >
            <Text style={[styles.cameraBtnText, cameraMode === mode.value && styles.cameraBtnTextActive]}>
              {mode.label}
            </Text>
          </TouchableOpacity>
        ))}
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
    alignItems: 'center',
    marginBottom: 8,
  },
  title: { color: '#e8eaf6', fontWeight: '700', fontSize: 14 },
  close: { color: '#6b7a99', fontSize: 18, paddingHorizontal: 4 },
  progressBar: {
    height: 4,
    backgroundColor: '#0d1428',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7eb8f7',
    borderRadius: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  statText: { color: '#7eb8f7', fontSize: 12, fontWeight: '600' },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  playBtn: {
    backgroundColor: '#2d4a7a',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnText: { color: '#7eb8f7', fontSize: 16 },
  speedRow: { flexDirection: 'row', flex: 1, gap: 4 },
  speedBtn: {
    flex: 1,
    backgroundColor: '#0d1428',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a3050',
  },
  speedBtnActive: { borderColor: '#7eb8f7', backgroundColor: '#2d4a7a' },
  speedBtnText: { color: '#6b7a99', fontSize: 11, fontWeight: '600' },
  speedBtnTextActive: { color: '#7eb8f7' },
  cameraModeRow: { flexDirection: 'row', gap: 6 },
  cameraBtn: {
    flex: 1,
    backgroundColor: '#0d1428',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a3050',
  },
  cameraBtnActive: { borderColor: '#7eb8f7', backgroundColor: '#2d4a7a' },
  cameraBtnText: { color: '#6b7a99', fontSize: 11, fontWeight: '600' },
  cameraBtnTextActive: { color: '#7eb8f7' },
});
