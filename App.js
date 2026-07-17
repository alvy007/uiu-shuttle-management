import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
} from 'react-native';

import * as Location from 'expo-location';
import MapView, { Marker, UrlTile } from 'react-native-maps';

import { supabase } from './lib/supabase';
import { BUS_ID, getInitialMode, canGoBackHome } from './src/config/appConfig';
import {
  getDurationBetween,
  formatTime,
  calculateTrackingQuality,
} from './src/utils/trackingUtils';

/*
|--------------------------------------------------------------------------
| App configuration
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| Main application
|--------------------------------------------------------------------------
*/

export default function App() {
  /*
  |--------------------------------------------------------------------------
  | Navigation mode
  |--------------------------------------------------------------------------
  */

  const [mode, setMode] = useState(getInitialMode());

  /*
  |--------------------------------------------------------------------------
  | Student states
  |--------------------------------------------------------------------------
  */

  const [busLocation, setBusLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [followBus, setFollowBus] = useState(true);

  /*
  |--------------------------------------------------------------------------
  | Driver states
  |--------------------------------------------------------------------------
  */

  const [isTracking, setIsTracking] = useState(false);
  const [driverStatus, setDriverStatus] = useState('Not started yet');

  const [lastSentLocation, setLastSentLocation] = useState(null);
  const [lastSentTime, setLastSentTime] = useState(null);

  const [activeTripId, setActiveTripId] = useState(null);
  const [tripStartedAt, setTripStartedAt] = useState(null);
  const [updateCount, setUpdateCount] = useState(0);

  const [lastTripSummary, setLastTripSummary] = useState(null);

  /*
  |--------------------------------------------------------------------------
  | References
  |--------------------------------------------------------------------------
  */

  const locationSubscriptionRef = useRef(null);
  const mapRef = useRef(null);

  // Prevent stale update-count value inside location watcher.
  const updateCountRef = useRef(0);

  // Prevent realtime subscription recreation when Follow Bus changes.
  const followBusRef = useRef(true);

  /*
  |--------------------------------------------------------------------------
  | Map helpers
  |--------------------------------------------------------------------------
  */

  function getInitialRegion() {
    const latitude =
      typeof busLocation?.latitude === 'number'
        ? busLocation.latitude
        : 23.797911;

    const longitude =
      typeof busLocation?.longitude === 'number'
        ? busLocation.longitude
        : 90.449223;

    return {
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }

  function focusMapOnLocation(locationData, duration = 800) {
    if (!locationData || !mapRef.current || !followBusRef.current) {
      return;
    }

    const latitude = Number(locationData.latitude);
    const longitude = Number(locationData.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    mapRef.current.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      duration,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Student bus status helpers
  |--------------------------------------------------------------------------
  */

  function getLocationAgeInfo(updatedAt, isActive) {
    if (!updatedAt) {
      return {
        text: 'No update time available',
        status: 'offline',
      };
    }

    const updatedTime = new Date(updatedAt).getTime();

    if (!Number.isFinite(updatedTime)) {
      return {
        text: 'Invalid update time',
        status: 'offline',
      };
    }

    const differenceSeconds = Math.max(
      0,
      Math.floor((currentTime - updatedTime) / 1000),
    );

    if (!isActive) {
      return {
        text: `Bus offline, last updated ${differenceSeconds}s ago`,
        status: 'offline',
      };
    }

    if (differenceSeconds <= 15) {
      return {
        text: `Live, updated ${differenceSeconds}s ago`,
        status: 'live',
      };
    }

    if (differenceSeconds <= 60) {
      return {
        text: `Delayed, updated ${differenceSeconds}s ago`,
        status: 'delayed',
      };
    }

    const differenceMinutes = Math.floor(differenceSeconds / 60);

    return {
      text: `Outdated, updated ${differenceMinutes}m ago`,
      status: 'offline',
    };
  }

  function getStudentStatusInfo() {
    if (!busLocation) {
      return {
        label: 'NO DATA',
        type: 'offline',
        style: styles.offlineBadge,
        text: 'No bus location data found.',
      };
    }

    const locationAge = getLocationAgeInfo(
      busLocation.updated_at,
      busLocation.is_active,
    );

    if (locationAge.status === 'live') {
      return {
        label: 'BUS LIVE',
        type: 'live',
        style: styles.liveBadge,
        text: locationAge.text,
      };
    }

    if (locationAge.status === 'delayed') {
      return {
        label: 'BUS DELAYED',
        type: 'delayed',
        style: styles.delayedBadge,
        text: locationAge.text,
      };
    }

    return {
      label: 'BUS OFFLINE',
      type: 'offline',
      style: styles.offlineBadge,
      text: locationAge.text,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Trip helpers
  |--------------------------------------------------------------------------
  */

  function getTripDurationText() {
    if (!tripStartedAt) {
      return 'Not started';
    }

    const startTime = new Date(tripStartedAt).getTime();

    if (!Number.isFinite(startTime)) {
      return 'N/A';
    }

    const differenceSeconds = Math.max(
      0,
      Math.floor((Date.now() - startTime) / 1000),
    );

    const minutes = Math.floor(differenceSeconds / 60);
    const seconds = differenceSeconds % 60;

    return `${minutes}m ${seconds}s`;
  }


  

  function getQualityStyle(quality) {
    if (quality === 'Excellent') {
      return styles.qualityExcellent;
    }

    if (quality === 'Good') {
      return styles.qualityGood;
    }

    return styles.qualityWeak;
  }

  /*
  |--------------------------------------------------------------------------
  | Fetch latest bus location
  |--------------------------------------------------------------------------
  */

  async function fetchBusLocation() {
    try {
      setLoadingLocation(true);
      setErrorMessage('');

      const { data, error } = await supabase
        .from('live_locations')
        .select('*')
        .eq('bus_id', BUS_ID)
        .maybeSingle();

      if (error) {
        console.log('SUPABASE FETCH ERROR:', error);

        setErrorMessage(error.message);
        setBusLocation(null);

        return;
      }

      if (!data) {
        setBusLocation(null);
        setErrorMessage('No bus location found yet.');

        return;
      }

      setBusLocation(data);

      setTimeout(() => {
        focusMapOnLocation(data);
      }, 250);
    } catch (error) {
      console.log('FETCH CATCH ERROR:', error);

      setErrorMessage(error?.message || 'Something went wrong.');
      setBusLocation(null);
    } finally {
      setLoadingLocation(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Send driver location to Supabase
  |--------------------------------------------------------------------------
  */

  async function sendCoordsToSupabase(coords, tripId = activeTripId) {
    try {
      if (!tripId) {
        setDriverStatus('No active trip found.');
        return;
      }

      if (
        typeof coords?.latitude !== 'number' ||
        typeof coords?.longitude !== 'number'
      ) {
        setDriverStatus('Invalid GPS coordinates received.');
        return;
      }

      if (typeof coords.accuracy === 'number' && coords.accuracy > 100) {
        setDriverStatus(`Weak GPS accuracy: ${Math.round(coords.accuracy)}m`);

        return;
      }

      const currentIsoTime = new Date().toISOString();

      const liveLocationPayload = {
        bus_id: BUS_ID,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy ?? null,
        speed: coords.speed ?? null,
        heading: coords.heading ?? null,
        is_active: true,
        updated_at: currentIsoTime,
      };

      /*
      |--------------------------------------------------------------------------
      | 1. Update latest live location
      |--------------------------------------------------------------------------
      */

      const { data: liveLocationData, error: liveLocationError } =
        await supabase
          .from('live_locations')
          .upsert(liveLocationPayload, {
            onConflict: 'bus_id',
          })
          .select()
          .single();

      if (liveLocationError) {
        console.log('SUPABASE LIVE UPDATE ERROR:', liveLocationError);

        setDriverStatus('Failed to send live location.');

        Alert.alert('Supabase Error', liveLocationError.message);

        return;
      }

      /*
      |--------------------------------------------------------------------------
      | 2. Save location history
      |--------------------------------------------------------------------------
      */

      const { error: locationLogError } = await supabase
        .from('location_logs')
        .insert({
          trip_id: tripId,
          bus_id: BUS_ID,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy ?? null,
          speed: coords.speed ?? null,
          heading: coords.heading ?? null,
          created_at: currentIsoTime,
        });

      if (locationLogError) {
        console.log('LOCATION LOG ERROR:', locationLogError);

        setDriverStatus('Live sent, but history log failed.');

        Alert.alert('Location Log Error', locationLogError.message);

        return;
      }

      /*
      |--------------------------------------------------------------------------
      | 3. Update trip summary
      |--------------------------------------------------------------------------
      */

      const nextUpdateCount = updateCountRef.current + 1;

      updateCountRef.current = nextUpdateCount;
      setUpdateCount(nextUpdateCount);

      const { error: tripUpdateError } = await supabase
        .from('trips')
        .update({
          total_updates: nextUpdateCount,
          last_latitude: coords.latitude,
          last_longitude: coords.longitude,
          last_accuracy: coords.accuracy ?? null,
        })
        .eq('id', tripId);

      if (tripUpdateError) {
        console.log('TRIP UPDATE ERROR:', tripUpdateError);
      }

      setLastSentLocation(liveLocationData);
      setLastSentTime(new Date().toLocaleTimeString());
      setDriverStatus('Location sent and logged successfully.');

      console.log('LOCATION SENT AND LOGGED:', liveLocationData);
    } catch (error) {
      console.log('SEND LOCATION ERROR:', error);

      setDriverStatus('Location send error.');

      Alert.alert(
        'Location Error',
        error?.message || 'Could not send location.',
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Create new trip
  |--------------------------------------------------------------------------
  */

  async function createTripSession() {
    try {
      setDriverStatus('Creating new trip session...');

      const { data, error } = await supabase
        .from('trips')
        .insert({
          bus_id: BUS_ID,
          status: 'active',
          started_at: new Date().toISOString(),
          total_updates: 0,
        })
        .select()
        .single();

      if (error) {
        console.log('CREATE TRIP ERROR:', error);

        Alert.alert('Trip Error', error.message);

        return null;
      }

      updateCountRef.current = 0;

      setActiveTripId(data.id);
      setTripStartedAt(data.started_at);
      setUpdateCount(0);
      setLastTripSummary(null);

      console.log('TRIP CREATED:', data);

      return data;
    } catch (error) {
      console.log('CREATE TRIP CATCH ERROR:', error);

      Alert.alert('Trip Error', error?.message || 'Could not create trip.');

      return null;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Get first location
  |--------------------------------------------------------------------------
  */

  async function getOneCurrentLocationAndSend(tripId = activeTripId) {
    try {
      setDriverStatus('Getting current GPS location...');

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      await sendCoordsToSupabase(location.coords, tripId);
    } catch (error) {
      console.log('LOCATION ERROR:', error);

      setDriverStatus('Location error.');

      Alert.alert(
        'Location Error',
        error?.message || 'Could not get current location.',
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Start driver tracking
  |--------------------------------------------------------------------------
  */

  async function startTracking() {
    try {
      if (isTracking) {
        return;
      }

      const permissionResponse =
        await Location.requestForegroundPermissionsAsync();

      if (permissionResponse.status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is required to track the shuttle.',
        );

        setDriverStatus('Location permission denied.');

        return;
      }

      const newTrip = await createTripSession();

      if (!newTrip) {
        setDriverStatus('Could not create trip. Tracking not started.');

        return;
      }

      setIsTracking(true);
      setDriverStatus('Tracking started. Waiting for GPS...');

      /*
      |--------------------------------------------------------------------------
      | Send first location immediately
      |--------------------------------------------------------------------------
      */

      await getOneCurrentLocationAndSend(newTrip.id);

      /*
      |--------------------------------------------------------------------------
      | Remove previous watcher
      |--------------------------------------------------------------------------
      */

      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }

      /*
      |--------------------------------------------------------------------------
      | Continuous foreground location tracking
      |--------------------------------------------------------------------------
      */

      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        async location => {
          await sendCoordsToSupabase(location.coords, newTrip.id);
        },
      );
    } catch (error) {
      console.log('START TRACKING ERROR:', error);

      setIsTracking(false);
      setDriverStatus('Could not start tracking.');

      Alert.alert('Error', error?.message || 'Could not start tracking.');
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Stop driver tracking
  |--------------------------------------------------------------------------
  */

  async function stopTracking() {
    try {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }

      setIsTracking(false);
      setDriverStatus('Stopping trip...');

      const currentIsoTime = new Date().toISOString();

      /*
      |--------------------------------------------------------------------------
      | Mark bus offline
      |--------------------------------------------------------------------------
      */

      const { error: liveLocationError } = await supabase
        .from('live_locations')
        .update({
          is_active: false,
          updated_at: currentIsoTime,
        })
        .eq('bus_id', BUS_ID);

      if (liveLocationError) {
        console.log('STOP LIVE LOCATION ERROR:', liveLocationError);

        Alert.alert('Supabase Error', liveLocationError.message);
      }

      /*
      |--------------------------------------------------------------------------
      | Complete trip
      |--------------------------------------------------------------------------
      */

      let completedTrip = null;

      if (activeTripId) {
        const { data: completedTripData, error: tripError } = await supabase
          .from('trips')
          .update({
            status: 'completed',
            ended_at: currentIsoTime,
            total_updates: updateCountRef.current,
          })
          .eq('id', activeTripId)
          .select()
          .single();

        if (tripError) {
          console.log('STOP TRIP ERROR:', tripError);

          Alert.alert('Trip Error', tripError.message);
        } else {
          completedTrip = completedTripData;
        }
      }

      /*
      |--------------------------------------------------------------------------
      | Generate trip summary
      |--------------------------------------------------------------------------
      */

      if (completedTrip) {
        const { data: locationLogs, error: logsError } = await supabase
          .from('location_logs')
          .select('accuracy, latitude, longitude, created_at')
          .eq('trip_id', completedTrip.id)
          .order('created_at', {
            ascending: true,
          });

        if (logsError) {
          console.log('FETCH TRIP LOGS ERROR:', logsError);
        }

        const qualityInformation = calculateTrackingQuality(locationLogs || []);

        setLastTripSummary({
          id: completedTrip.id,
          bus_id: completedTrip.bus_id,
          started_at: completedTrip.started_at,
          ended_at: completedTrip.ended_at,
          total_updates: completedTrip.total_updates ?? updateCountRef.current,
          last_accuracy: completedTrip.last_accuracy,
          last_latitude: completedTrip.last_latitude,
          last_longitude: completedTrip.last_longitude,
          quality: qualityInformation.quality,
          averageAccuracy: qualityInformation.averageAccuracy,
          bestAccuracy: qualityInformation.bestAccuracy,
          worstAccuracy: qualityInformation.worstAccuracy,
          totalPoints: qualityInformation.totalPoints,
        });
      }

      setDriverStatus('Trip completed successfully.');
      setActiveTripId(null);
      setTripStartedAt(null);
    } catch (error) {
      console.log('STOP TRACKING ERROR:', error);

      setDriverStatus('Stop tracking failed.');

      Alert.alert('Error', error?.message || 'Could not stop tracking.');
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Keep Follow Bus ref updated
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    followBusRef.current = followBus;
  }, [followBus]);

  /*
  |--------------------------------------------------------------------------
  | Clock and Supabase realtime subscription
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    fetchBusLocation();

    const clockTimer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    const realtimeChannel = supabase
      .channel(`live-location-${BUS_ID}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_locations',
          filter: `bus_id=eq.${BUS_ID}`,
        },
        payload => {
          console.log('REALTIME LOCATION UPDATE:', payload);

          const newLocation = payload?.new;

          if (
            newLocation &&
            typeof newLocation.latitude === 'number' &&
            typeof newLocation.longitude === 'number'
          ) {
            setBusLocation(newLocation);
            setErrorMessage('');

            focusMapOnLocation(newLocation);
          }
        },
      )
      .subscribe(subscriptionStatus => {
        console.log('REALTIME SUBSCRIPTION STATUS:', subscriptionStatus);
      });

    return () => {
      clearInterval(clockTimer);

      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }

      supabase.removeChannel(realtimeChannel);
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Driver screen
  |--------------------------------------------------------------------------
  */

  if (mode === 'driver') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Driver Mode</Text>

            <Text style={styles.subtitle}>
              Driver phone theke live bus location Supabase-e send korbe.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tracking Status</Text>

            <View
              style={[
                styles.statusBadge,
                isTracking ? styles.liveBadge : styles.offlineBadge,
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {isTracking ? 'LIVE TRACKING' : 'OFFLINE'}
              </Text>
            </View>

            <Text style={styles.statusText}>{driverStatus}</Text>

            <View style={styles.tripBox}>
              <Text style={styles.tripText}>
                Trip ID:{' '}
                {activeTripId
                  ? `${activeTripId.slice(0, 8)}...`
                  : 'No active trip'}
              </Text>

              <Text style={styles.tripText}>Updates Sent: {updateCount}</Text>

              <Text style={styles.tripText}>
                Duration: {getTripDurationText()}
              </Text>
            </View>

            {lastSentLocation ? (
              <View style={styles.locationBox}>
                <Text style={styles.locationText}>
                  Latitude: {lastSentLocation.latitude}
                </Text>

                <Text style={styles.locationText}>
                  Longitude: {lastSentLocation.longitude}
                </Text>

                <Text style={styles.locationText}>
                  Accuracy:{' '}
                  {lastSentLocation.accuracy != null
                    ? `${Math.round(lastSentLocation.accuracy)}m`
                    : 'N/A'}
                </Text>

                <Text style={styles.locationText}>
                  Speed:{' '}
                  {lastSentLocation.speed != null
                    ? `${lastSentLocation.speed} m/s`
                    : 'N/A'}
                </Text>

                <Text style={styles.locationText}>
                  Heading:{' '}
                  {lastSentLocation.heading != null
                    ? `${lastSentLocation.heading}°`
                    : 'N/A'}
                </Text>

                <Text style={styles.locationText}>
                  Last Sent: {lastSentTime || 'N/A'}
                </Text>
              </View>
            ) : (
              <Text style={styles.statusText}>
                Start Tracking press korle current GPS ekhane show korbe.
              </Text>
            )}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                isTracking && styles.disabledButton,
              ]}
              onPress={startTracking}
              disabled={isTracking}
            >
              <Text style={styles.buttonText}>Start Tracking</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.dangerButton,
                !isTracking && styles.disabledButton,
              ]}
              onPress={stopTracking}
              disabled={!isTracking}
            >
              <Text style={styles.buttonText}>Stop Tracking</Text>
            </TouchableOpacity>

            {lastTripSummary ? (
              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Last Trip Summary</Text>

                <Text style={styles.summaryText}>
                  Trip ID: {lastTripSummary.id.slice(0, 8)}...
                </Text>

                <Text style={styles.summaryText}>
                  Started: {formatTime(lastTripSummary.started_at)}
                </Text>

                <Text style={styles.summaryText}>
                  Ended: {formatTime(lastTripSummary.ended_at)}
                </Text>

                <Text style={styles.summaryText}>
                  Duration:{' '}
                  {getDurationBetween(
                    lastTripSummary.started_at,
                    lastTripSummary.ended_at,
                  )}
                </Text>

                <Text style={styles.summaryText}>
                  Total Updates: {lastTripSummary.total_updates ?? 0}
                </Text>

                <Text style={styles.summaryText}>
                  Logged Points: {lastTripSummary.totalPoints ?? 0}
                </Text>

                <View
                  style={[
                    styles.qualityBadge,
                    getQualityStyle(lastTripSummary.quality),
                  ]}
                >
                  <Text style={styles.qualityText}>
                    Tracking Quality: {lastTripSummary.quality || 'N/A'}
                  </Text>
                </View>

                <Text style={styles.summaryText}>
                  Average Accuracy:{' '}
                  {lastTripSummary.averageAccuracy != null
                    ? `${Math.round(lastTripSummary.averageAccuracy)}m`
                    : 'N/A'}
                </Text>

                <Text style={styles.summaryText}>
                  Best Accuracy:{' '}
                  {lastTripSummary.bestAccuracy != null
                    ? `${Math.round(lastTripSummary.bestAccuracy)}m`
                    : 'N/A'}
                </Text>

                <Text style={styles.summaryText}>
                  Worst Accuracy:{' '}
                  {lastTripSummary.worstAccuracy != null
                    ? `${Math.round(lastTripSummary.worstAccuracy)}m`
                    : 'N/A'}
                </Text>

                <Text style={styles.summaryText}>
                  Last Accuracy:{' '}
                  {lastTripSummary.last_accuracy != null
                    ? `${Math.round(lastTripSummary.last_accuracy)}m`
                    : 'N/A'}
                </Text>
              </View>
            ) : null}
          </View>

          {canGoBackHome() ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setMode('home')}
            >
              <Text style={styles.backButtonText}>Back to Home</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Student screen
  |--------------------------------------------------------------------------
  */

  if (mode === 'student') {
    const studentStatus = getStudentStatusInfo();

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.headerSmall}>
            <Text style={styles.title}>Student Mode</Text>

            <Text style={styles.subtitle}>Live bus location map.</Text>
          </View>

          <View style={styles.mapCard}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={getInitialRegion()}
              mapType="none"
              showsUserLocation={false}
              showsMyLocationButton={false}
              showsCompass={true}
              toolbarEnabled={false}
              onMapReady={() => {
                if (busLocation) {
                  setTimeout(() => {
                    focusMapOnLocation(busLocation, 500);
                  }, 200);
                }
              }}
            >
              <UrlTile
                urlTemplate="https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
                maximumZ={19}
                flipY={false}
              />

              {busLocation ? (
                <Marker
                  coordinate={{
                    latitude: Number(busLocation.latitude),
                    longitude: Number(busLocation.longitude),
                  }}
                  anchor={{
                    x: 0.5,
                    y: 0.5,
                  }}
                  tracksViewChanges={true}
                >
                  <View style={styles.cleanBusMarkerContainer}>
                    <Image
                      source={require('./assets/uiu-bus-marker.png')}
                      style={styles.cleanBusMarkerImage}
                      resizeMode="contain"
                    />

                    <View
                      style={[
                        styles.cleanBusStatusDot,
                        studentStatus.type === 'live'
                          ? styles.cleanBusLive
                          : studentStatus.type === 'delayed'
                            ? styles.cleanBusDelayed
                            : styles.cleanBusOffline,
                      ]}
                    />
                  </View>
                </Marker>
              ) : null}
            </MapView>

            {!busLocation ? (
              <View style={styles.mapLoadingOverlay} pointerEvents="none">
                {loadingLocation ? (
                  <>
                    <ActivityIndicator size="large" />

                    <Text style={styles.mapLoadingText}>
                      Loading bus location...
                    </Text>
                  </>
                ) : (
                  <Text style={styles.errorText}>
                    {errorMessage || 'No bus location found.'}
                  </Text>
                )}
              </View>
            ) : null}
          </View>

          <View style={styles.cardCompact}>
            <View style={[styles.statusBadge, studentStatus.style]}>
              <Text style={styles.statusBadgeText}>{studentStatus.label}</Text>
            </View>

            <Text style={styles.statusText}>{studentStatus.text}</Text>

            {busLocation ? (
              <>
                <Text style={styles.locationText}>Bus ID: {BUS_ID}</Text>

                <Text style={styles.locationText}>
                  Latitude: {busLocation.latitude}
                </Text>

                <Text style={styles.locationText}>
                  Longitude: {busLocation.longitude}
                </Text>

                <Text style={styles.locationText}>
                  Accuracy:{' '}
                  {busLocation.accuracy != null
                    ? `${Math.round(busLocation.accuracy)}m`
                    : 'N/A'}
                </Text>

                <Text style={styles.locationText}>
                  Speed:{' '}
                  {busLocation.speed != null
                    ? `${busLocation.speed} m/s`
                    : 'N/A'}
                </Text>
              </>
            ) : null}

            <TouchableOpacity
              style={followBus ? styles.followOnButton : styles.followOffButton}
              onPress={() => {
                setFollowBus(previousValue => {
                  const newValue = !previousValue;

                  if (newValue && busLocation) {
                    setTimeout(() => {
                      focusMapOnLocation(busLocation, 500);
                    }, 100);
                  }

                  return newValue;
                });
              }}
            >
              <Text style={styles.buttonText}>
                {followBus ? 'Follow Bus: ON' : 'Follow Bus: OFF'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={fetchBusLocation}
            >
              <Text style={styles.buttonText}>Refresh Location</Text>
            </TouchableOpacity>
          </View>

          {canGoBackHome() ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setMode('home')}
            >
              <Text style={styles.backButtonText}>Back to Home</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Beta guide screen
  |--------------------------------------------------------------------------
  */

  if (mode === 'guide') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.headerSmall}>
            <Text style={styles.title}>Beta Test Guide</Text>

            <Text style={styles.subtitle}>
              Ei guide follow kore driver and student side properly test korba.
            </Text>
          </View>

          <View style={styles.guideCard}>
            <Text style={styles.guideTitle}>Driver Tester</Text>

            <Text style={styles.guideItem}>1. Phone internet ON rakhbe.</Text>

            <Text style={styles.guideItem}>2. GPS / Location ON rakhbe.</Text>

            <Text style={styles.guideItem}>3. Battery saver OFF rakhbe.</Text>

            <Text style={styles.guideItem}>
              4. App open kore Continue as Driver press korbe.
            </Text>

            <Text style={styles.guideItem}>
              5. Start Tracking press kore location permission Allow dibe.
            </Text>

            <Text style={styles.guideItem}>
              6. 3-5 minutes normal walk or ride test korbe.
            </Text>

            <Text style={styles.guideItem}>
              7. Stop Tracking press kore Trip Summary check korbe.
            </Text>
          </View>

          <View style={styles.guideCard}>
            <Text style={styles.guideTitle}>Student Tester</Text>

            <Text style={styles.guideItem}>
              1. App open kore Continue as Student press korbe.
            </Text>

            <Text style={styles.guideItem}>
              2. Map-e bus marker show hocche kina check korbe.
            </Text>

            <Text style={styles.guideItem}>
              3. Follow Bus ON rakhle map bus-ke automatically follow korbe.
            </Text>

            <Text style={styles.guideItem}>
              4. Follow Bus OFF korle map manually move kora jabe.
            </Text>

            <Text style={styles.guideItem}>
              5. BUS LIVE, DELAYED and OFFLINE status check korbe.
            </Text>

            <Text style={styles.guideItem}>
              6. Accuracy and last updated time check korbe.
            </Text>
          </View>

          <View style={styles.guideCard}>
            <Text style={styles.guideTitle}>Successful Test Means</Text>

            <Text style={styles.guideItem}>
              ✓ Driver location Supabase-e update hocche.
            </Text>

            <Text style={styles.guideItem}>
              ✓ Student map-e marker realtime move kortese.
            </Text>

            <Text style={styles.guideItem}>
              ✓ Stop korar por trip summary show kortese.
            </Text>

            <Text style={styles.guideItem}>
              ✓ Tracking quality Excellent or Good ashtese.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setMode('home')}
          >
            <Text style={styles.backButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Home screen
  |--------------------------------------------------------------------------
  */

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Shuttle Live Tracking</Text>

          <Text style={styles.subtitle}>
            Driver live location send korbe and student realtime map-e bus
            dekhbe.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Choose Mode</Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setMode('driver')}
          >
            <Text style={styles.buttonText}>Continue as Driver</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setMode('student')}
          >
            <Text style={styles.buttonText}>Continue as Student</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.guideButton}
            onPress={() => setMode('guide')}
          >
            <Text style={styles.buttonText}>Beta Test Guide</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Current Goal</Text>

          <Text style={styles.infoText}>
            Driver phone move korle student map-e transparent orange bus marker
            realtime update hobe.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/*
|--------------------------------------------------------------------------
| Application styles
|--------------------------------------------------------------------------
*/

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  scrollContent: {
    paddingBottom: 30,
  },

  header: {
    marginTop: 40,
    marginBottom: 30,
  },

  headerSmall: {
    marginTop: 35,
    marginBottom: 12,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },

  cardCompact: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },

  mapCard: {
    height: 330,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },

  map: {
    flex: 1,
  },

  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 10,
  },

  mapLoadingText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },

  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 18,
  },

  statusText: {
    fontSize: 15,
    color: '#4B5563',
    marginBottom: 8,
    lineHeight: 22,
  },

  errorText: {
    fontSize: 15,
    color: '#DC2626',
    textAlign: 'center',
    lineHeight: 22,
  },

  locationBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },

  tripBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },

  tripText: {
    fontSize: 14,
    color: '#3730A3',
    fontWeight: '700',
    marginBottom: 5,
  },

  locationText: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 6,
  },

  summaryBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 14,
    marginTop: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },

  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#065F46',
    marginBottom: 8,
  },

  summaryText: {
    fontSize: 14,
    color: '#047857',
    fontWeight: '700',
    marginBottom: 5,
  },

  qualityBadge: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
    marginTop: 4,
  },

  qualityText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  qualityExcellent: {
    backgroundColor: '#16A34A',
  },

  qualityGood: {
    backgroundColor: '#F59E0B',
  },

  qualityWeak: {
    backgroundColor: '#DC2626',
  },

  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginBottom: 10,
  },

  liveBadge: {
    backgroundColor: '#16A34A',
  },

  delayedBadge: {
    backgroundColor: '#F59E0B',
  },

  offlineBadge: {
    backgroundColor: '#6B7280',
  },

  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },

  secondaryButton: {
    backgroundColor: '#059669',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },

  dangerButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },

  guideButton: {
    backgroundColor: '#EA580C',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },

  disabledButton: {
    opacity: 0.45,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  backButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },

  backButtonText: {
    color: '#2563EB',
    fontSize: 15,
    fontWeight: '700',
  },

  followOnButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },

  followOffButton: {
    backgroundColor: '#64748B',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },

  guideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  guideTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },

  guideItem: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 21,
    marginBottom: 5,
  },

  infoBox: {
    marginTop: 22,
    backgroundColor: '#E0F2FE',
    borderRadius: 16,
    padding: 18,
  },

  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },

  infoText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 21,
  },

  cleanBusMarkerContainer: {
    width: 110,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  cleanBusMarkerImage: {
    width: 102,
    height: 52,
  },

  cleanBusStatusDot: {
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

  cleanBusLive: {
    backgroundColor: '#16A34A',
  },

  cleanBusDelayed: {
    backgroundColor: '#F59E0B',
  },

  cleanBusOffline: {
    backgroundColor: '#6B7280',
  },
});
