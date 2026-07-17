import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

export default function BusMarker({
  location,
  statusType = 'offline',
  busLabel = '',
  isSelected = false,
  onPress,
}) {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  function getStatusDotStyle() {
    if (statusType === 'live') {
      return styles.liveStatus;
    }

    if (statusType === 'delayed') {
      return styles.delayedStatus;
    }

    return styles.offlineStatus;
  }

  return (
    <Marker
      coordinate={{
        latitude,
        longitude,
      }}
      anchor={{
        x: 0.5,
        y: 0.5,
      }}
      tracksViewChanges
      zIndex={isSelected ? 20 : 10}
      onPress={() => {
        if (typeof onPress === 'function') {
          onPress();
        }
      }}
    >
      <View style={styles.markerOuterContainer}>
        <View
          style={[
            styles.markerContainer,
            isSelected && styles.selectedMarkerContainer,
          ]}
        >
          <Image
            source={require('../../assets/uiu-bus-marker.png')}
            style={styles.busImage}
            resizeMode="contain"
          />

          <View style={[styles.statusDot, getStatusDotStyle()]} />
        </View>

        {busLabel ? (
          <View
            style={[
              styles.labelContainer,
              isSelected && styles.selectedLabelContainer,
            ]}
          >
            <Text
              style={[styles.labelText, isSelected && styles.selectedLabelText]}
              numberOfLines={1}
            >
              {busLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  markerOuterContainer: {
    width: 118,
    alignItems: 'center',
    justifyContent: 'center',
  },

  markerContainer: {
    width: 110,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderRadius: 14,
  },

  selectedMarkerContainer: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderWidth: 2,
    borderColor: '#2563EB',
  },

  busImage: {
    width: 102,
    height: 52,
  },

  statusDot: {
    position: 'absolute',
    top: 2,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 10,
    elevation: 10,
  },

  liveStatus: {
    backgroundColor: '#16A34A',
  },

  delayedStatus: {
    backgroundColor: '#F59E0B',
  },

  offlineStatus: {
    backgroundColor: '#6B7280',
  },

  labelContainer: {
    maxWidth: 100,
    marginTop: 2,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 4,
  },

  selectedLabelContainer: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },

  labelText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'center',
  },

  selectedLabelText: {
    color: '#FFFFFF',
  },
});
