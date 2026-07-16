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

const BUS_ID = 'bus_001';
const APP_MODE = process.env.EXPO_PUBLIC_APP_MODE || 'home';

function getInitialMode() {
  if (APP_MODE === 'driver') return 'driver';
  if (APP_MODE === 'student') return 'student';
  return 'home';
}

function canGoBackHome() {
  return APP_MODE === 'home';
}

export default function App() {
  const [mode, setMode] = useState(getInitialMode());

  const [busLocation, setBusLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [followBus, setFollowBus] = useState(true);

  const [isTracking, setIsTracking] = useState(false);
  const [driverStatus, setDriverStatus] = useState('Not started yet');
  const [lastSentLocation, setLastSentLocation] = useState(null);
  const [lastSentTime, setLastSentTime] = useState(null);
  const [activeTripId, setActiveTripId] = useState(null);
  const [tripStartedAt, setTripStartedAt] = useState(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [lastTripSummary, setLastTripSummary] = useState(null);
  const locationSubscriptionRef = useRef(null);
  const mapRef = useRef(null);

  function getInitialRegion() {
    const lat = busLocation?.latitude || 23.797911;
    const lng = busLocation?.longitude || 90.449223;

    return {
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }

  function getLocationAgeInfo(updatedAt, isActive) {
    if (!updatedAt) {
      return {
        text: 'No update time available',
        status: 'offline',
      };
    }

    const updatedTime = new Date(updatedAt).getTime();
    const diffSeconds = Math.floor((currentTime - updatedTime) / 1000);

    if (!isActive) {
      return {
        text: `Bus offline, last updated ${diffSeconds}s ago`,
        status: 'offline',
      };
    }

    if (diffSeconds <= 15) {
      return {
        text: `Live, updated ${diffSeconds}s ago`,
        status: 'live',
      };
    }

    if (diffSeconds <= 60) {
      return {
        text: `Delayed, updated ${diffSeconds}s ago`,
        status: 'delayed',
      };
    }

    const diffMinutes = Math.floor(diffSeconds / 60);

    return {
      text: `Outdated, updated ${diffMinutes}m ago`,
      status: 'offline',
    };
  }

  function getStudentStatusInfo() {
    if (!busLocation) {
      return {
        label: 'NO DATA',
        style: styles.offlineBadge,
        text: 'No bus location data found.',
      };
    }

    const info = getLocationAgeInfo(
      busLocation.updated_at,
      busLocation.is_active,
    );

    if (info.status === 'live') {
      return {
        label: 'BUS LIVE',
        style: styles.liveBadge,
        text: info.text,
      };
    }

    if (info.status === 'delayed') {
      return {
        label: 'BUS DELAYED',
        style: styles.delayedBadge,
        text: info.text,
      };
    }

    return {
      label: 'BUS OFFLINE',
      style: styles.offlineBadge,
      text: info.text,
    };
  }
  function getBusRotation() {
    const heading = busLocation?.heading;

    if (typeof heading === 'number' && !Number.isNaN(heading)) {
      // Side-view bus icon er jonno 90 degree offset better lage.
      return `${heading + 90}deg`;
    }

    return '0deg';
  }

  function getTripDurationText() {
    if (!tripStartedAt) return 'Not started';

    const start = new Date(tripStartedAt).getTime();
    const now = Date.now();
    const diffSeconds = Math.floor((now - start) / 1000);

    const minutes = Math.floor(diffSeconds / 60);
    const seconds = diffSeconds % 60;

    return `${minutes}m ${seconds}s`;
  }
  function getDurationBetween(startedAt, endedAt) {
    if (!startedAt || !endedAt) return 'N/A';

    const start = new Date(startedAt).getTime();
    const end = new Date(endedAt).getTime();
    const diffSeconds = Math.max(0, Math.floor((end - start) / 1000));

    const minutes = Math.floor(diffSeconds / 60);
    const seconds = diffSeconds % 60;

    return `${minutes}m ${seconds}s`;
  }

  function formatTime(dateString) {
    if (!dateString) return 'N/A';

    return new Date(dateString).toLocaleTimeString();
  }
  function calculateTrackingQuality(logs) {
    if (!logs || logs.length === 0) {
      return {
        quality: 'No Data',
        averageAccuracy: null,
        bestAccuracy: null,
        worstAccuracy: null,
        totalPoints: 0,
      };
    }

    const validAccuracyLogs = logs.filter(
      log => typeof log.accuracy === 'number' && !Number.isNaN(log.accuracy),
    );

    if (validAccuracyLogs.length === 0) {
      return {
        quality: 'No Accuracy Data',
        averageAccuracy: null,
        bestAccuracy: null,
        worstAccuracy: null,
        totalPoints: logs.length,
      };
    }

    const accuracies = validAccuracyLogs.map(log => log.accuracy);

    const totalAccuracy = accuracies.reduce((sum, value) => sum + value, 0);
    const averageAccuracy = totalAccuracy / accuracies.length;
    const bestAccuracy = Math.min(...accuracies);
    const worstAccuracy = Math.max(...accuracies);

    let quality = 'Weak';

    if (averageAccuracy <= 30 && logs.length >= 5) {
      quality = 'Excellent';
    } else if (averageAccuracy <= 70 && logs.length >= 3) {
      quality = 'Good';
    }

    return {
      quality,
      averageAccuracy,
      bestAccuracy,
      worstAccuracy,
      totalPoints: logs.length,
    };
  }

  function getQualityStyle(quality) {
    if (quality === 'Excellent') return styles.qualityExcellent;
    if (quality === 'Good') return styles.qualityGood;
    return styles.qualityWeak;
  }

  async function fetchBusLocation() {
    try {
      setLoadingLocation(true);
      setErrorMessage('');

      const { data, error } = await supabase
        .from('live_locations')
        .select('*')
        .eq('bus_id', BUS_ID)
        .single();

      if (error) {
        console.log('SUPABASE FETCH ERROR:', error);
        setErrorMessage(error.message);
        setBusLocation(null);
        return;
      }

      setBusLocation(data);

      if (data?.latitude && data?.longitude && mapRef.current && followBus) {
        mapRef.current.animateToRegion(
          {
            latitude: data.latitude,
            longitude: data.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          800,
        );
      }
    } catch (error) {
      console.log('FETCH CATCH ERROR:', error);
      setErrorMessage(error.message || 'Something went wrong.');
      setBusLocation(null);
    } finally {
      setLoadingLocation(false);
    }
  }

  async function sendCoordsToSupabase(coords, tripId = activeTripId) {
    try {
      if (!tripId) {
        setDriverStatus('No active trip found.');
        return;
      }

      // Accuracy filter
      // 100m er beshi hole location weak dhora hobe
      if (coords.accuracy && coords.accuracy > 100) {
        setDriverStatus(`Weak GPS accuracy: ${Math.round(coords.accuracy)}m`);
        return;
      }

      const nowIso = new Date().toISOString();

      const livePayload = {
        bus_id: BUS_ID,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        speed: coords.speed,
        heading: coords.heading,
        is_active: true,
        updated_at: nowIso,
      };

      // 1. Latest live location update
      const { data: liveData, error: liveError } = await supabase
        .from('live_locations')
        .upsert(livePayload, { onConflict: 'bus_id' })
        .select()
        .single();

      if (liveError) {
        console.log('SUPABASE LIVE UPDATE ERROR:', liveError);
        setDriverStatus('Failed to send live location.');
        Alert.alert('Supabase Error', liveError.message);
        return;
      }

      // 2. Location history log insert
      const { error: logError } = await supabase.from('location_logs').insert({
        trip_id: tripId,
        bus_id: BUS_ID,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        speed: coords.speed,
        heading: coords.heading,
        created_at: nowIso,
      });

      if (logError) {
        console.log('LOCATION LOG ERROR:', logError);
        setDriverStatus('Live sent, but log failed.');
        Alert.alert('Location Log Error', logError.message);
        return;
      }

      // 3. Trip summary update
      const nextCount = updateCount + 1;

      const { error: tripUpdateError } = await supabase
        .from('trips')
        .update({
          total_updates: nextCount,
          last_latitude: coords.latitude,
          last_longitude: coords.longitude,
          last_accuracy: coords.accuracy,
        })
        .eq('id', tripId);

      if (tripUpdateError) {
        console.log('TRIP UPDATE ERROR:', tripUpdateError);
      }

      setUpdateCount(nextCount);
      setLastSentLocation(liveData);
      setLastSentTime(new Date().toLocaleTimeString());
      setDriverStatus('Location sent and logged successfully.');

      console.log('LOCATION SENT + LOGGED:', liveData);
    } catch (error) {
      console.log('SEND LOCATION ERROR:', error);
      setDriverStatus('Location send error.');
      Alert.alert(
        'Location Error',
        error.message || 'Could not send location.',
      );
    }
  }
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

      setActiveTripId(data.id);
      setTripStartedAt(data.started_at);
      setUpdateCount(0);

      console.log('TRIP CREATED:', data);
      return data;
    } catch (error) {
      console.log('CREATE TRIP CATCH ERROR:', error);
      Alert.alert('Trip Error', error.message || 'Could not create trip.');
      return null;
    }
  }
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
        error.message || 'Could not get current location.',
      );
    }
  }

  async function startTracking() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is required to track the shuttle.',
        );
        setDriverStatus('Location permission denied.');
        return;
      }

      const trip = await createTripSession();

      if (!trip) {
        setDriverStatus('Could not create trip. Tracking not started.');
        return;
      }

      setIsTracking(true);
      setDriverStatus('Tracking started. Waiting for GPS...');

      // First location instantly send korbo
      await getOneCurrentLocationAndSend(trip.id);

      // Old subscription thakle remove
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }

      // Continuous location tracking
      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        async location => {
          await sendCoordsToSupabase(location.coords, trip.id);
        },
      );
    } catch (error) {
      console.log('START TRACKING ERROR:', error);
      setDriverStatus('Could not start tracking.');
      Alert.alert('Error', error.message || 'Could not start tracking.');
    }
  }

  async function stopTracking() {
    try {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }

      setIsTracking(false);
      setDriverStatus('Stopping trip...');

      const nowIso = new Date().toISOString();

      const { error: liveError } = await supabase
        .from('live_locations')
        .update({
          is_active: false,
          updated_at: nowIso,
        })
        .eq('bus_id', BUS_ID);

      if (liveError) {
        console.log('STOP LIVE ERROR:', liveError);
        Alert.alert('Supabase Error', liveError.message);
      }

      let completedTrip = null;

      if (activeTripId) {
        const { data: tripData, error: tripError } = await supabase
          .from('trips')
          .update({
            status: 'completed',
            ended_at: nowIso,
          })
          .eq('id', activeTripId)
          .select()
          .single();

        if (tripError) {
          console.log('STOP TRIP ERROR:', tripError);
          Alert.alert('Trip Error', tripError.message);
        } else {
          completedTrip = tripData;
        }
      }

      if (completedTrip) {
        const { data: logsData, error: logsError } = await supabase
          .from('location_logs')
          .select('accuracy, latitude, longitude, created_at')
          .eq('trip_id', completedTrip.id)
          .order('created_at', { ascending: true });

        if (logsError) {
          console.log('FETCH TRIP LOGS ERROR:', logsError);
        }

        const qualityInfo = calculateTrackingQuality(logsData || []);

        setLastTripSummary({
          id: completedTrip.id,
          bus_id: completedTrip.bus_id,
          started_at: completedTrip.started_at,
          ended_at: completedTrip.ended_at,
          total_updates: completedTrip.total_updates,
          last_accuracy: completedTrip.last_accuracy,
          last_latitude: completedTrip.last_latitude,
          last_longitude: completedTrip.last_longitude,
          quality: qualityInfo.quality,
          averageAccuracy: qualityInfo.averageAccuracy,
          bestAccuracy: qualityInfo.bestAccuracy,
          worstAccuracy: qualityInfo.worstAccuracy,
          totalPoints: qualityInfo.totalPoints,
        });
      }

      setDriverStatus('Trip completed successfully.');
      setActiveTripId(null);
      setTripStartedAt(null);
    } catch (error) {
      console.log('STOP ERROR:', error);
      setDriverStatus('Stop tracking failed.');
      Alert.alert('Error', error.message || 'Could not stop tracking.');
    }
  }

  useEffect(() => {
    fetchBusLocation();
    const clockTimer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    const channel = supabase
      .channel('live-location-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_locations',
          filter: `bus_id=eq.${BUS_ID}`,
        },
        payload => {
          console.log('REALTIME LOCATION UPDATE:', payload.new);

          if (payload.new) {
            setBusLocation(payload.new);

            if (mapRef.current && followBus) {
              mapRef.current.animateToRegion(
                {
                  latitude: payload.new.latitude,
                  longitude: payload.new.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                },
                800,
              );
            }
          }
        },
      )
      .subscribe();

    return () => {
      clearInterval(clockTimer);

      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }

      supabase.removeChannel(channel);
    };
  }, [followBus]);

  if (mode === 'driver') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Driver Mode</Text>
            <Text style={styles.subtitle}>
              Driver phone theke live bus location Supabase e send korbe.
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
                  ? activeTripId.slice(0, 8) + '...'
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
                  Accuracy: {lastSentLocation.accuracy ?? 'N/A'}m
                </Text>
                <Text style={styles.locationText}>
                  Speed: {lastSentLocation.speed ?? 'N/A'}
                </Text>
                <Text style={styles.locationText}>
                  Heading: {lastSentLocation.heading ?? 'N/A'}
                </Text>
                <Text style={styles.locationText}>
                  Last Sent: {lastSentTime ?? 'N/A'}
                </Text>
              </View>
            ) : (
              <Text style={styles.statusText}>
                Start tracking korle current GPS ekhane show korbe.
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
                  Total Updates: {lastTripSummary.total_updates}
                </Text>

                <Text style={styles.summaryText}>
                  Logged Points: {lastTripSummary.totalPoints ?? 'N/A'}
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
                  {lastTripSummary.averageAccuracy
                    ? `${Math.round(lastTripSummary.averageAccuracy)}m`
                    : 'N/A'}
                </Text>

                <Text style={styles.summaryText}>
                  Best Accuracy:{' '}
                  {lastTripSummary.bestAccuracy
                    ? `${Math.round(lastTripSummary.bestAccuracy)}m`
                    : 'N/A'}
                </Text>

                <Text style={styles.summaryText}>
                  Worst Accuracy:{' '}
                  {lastTripSummary.worstAccuracy
                    ? `${Math.round(lastTripSummary.worstAccuracy)}m`
                    : 'N/A'}
                </Text>

                <Text style={styles.summaryText}>
                  Last Accuracy:{' '}
                  {lastTripSummary.last_accuracy
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

  if (mode === 'student') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.headerSmall}>
            <Text style={styles.title}>Student Mode</Text>
            <Text style={styles.subtitle}>Live bus location map.</Text>
          </View>

          <View style={styles.mapCard}>
            {busLocation ? (
              <Marker
                coordinate={{
                  latitude: busLocation.latitude,
                  longitude: busLocation.longitude,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
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
                      getStudentStatusInfo().label === 'BUS LIVE'
                        ? styles.cleanBusLive
                        : getStudentStatusInfo().label === 'BUS DELAYED'
                          ? styles.cleanBusDelayed
                          : styles.cleanBusOffline,
                    ]}
                  />
                </View>
              </Marker>
            ) : (
              <View style={styles.mapPlaceholder}>
                {loadingLocation ? (
                  <ActivityIndicator size="large" />
                ) : (
                  <Text style={styles.statusText}>
                    {errorMessage || 'No bus location found.'}
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.cardCompact}>
            <View style={[styles.statusBadge, getStudentStatusInfo().style]}>
              <Text style={styles.statusBadgeText}>
                {getStudentStatusInfo().label}
              </Text>
            </View>

            <Text style={styles.statusText}>{getStudentStatusInfo().text}</Text>

            {busLocation ? (
              <>
                <Text style={styles.locationText}>
                  Lat: {busLocation.latitude}
                </Text>
                <Text style={styles.locationText}>
                  Lng: {busLocation.longitude}
                </Text>
                <Text style={styles.locationText}>
                  Accuracy:{' '}
                  {busLocation.accuracy
                    ? `${Math.round(busLocation.accuracy)}m`
                    : 'N/A'}
                </Text>
              </>
            ) : null}

            <TouchableOpacity
              style={followBus ? styles.followOnButton : styles.followOffButton}
              onPress={() => setFollowBus(prev => !prev)}
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
  if (mode === 'guide') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <ScrollView showsVerticalScrollIndicator={false}>
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
              6. 3-5 minutes normal walk / ride test korbe.
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
              2. Map e bus marker show hocche kina check korbe.
            </Text>
            <Text style={styles.guideItem}>
              3. Follow Bus ON rakhle marker auto focus korbe.
            </Text>
            <Text style={styles.guideItem}>
              4. Follow Bus OFF korle map manually move kora jabe.
            </Text>
            <Text style={styles.guideItem}>
              5. BUS LIVE / DELAYED / OFFLINE status check korbe.
            </Text>
            <Text style={styles.guideItem}>
              6. Accuracy meter and last updated time check korbe.
            </Text>
          </View>

          <View style={styles.guideCard}>
            <Text style={styles.guideTitle}>Successful Test Means</Text>

            <Text style={styles.guideItem}>
              ✓ Driver location Supabase e update hocche.
            </Text>
            <Text style={styles.guideItem}>
              ✓ Student map e marker realtime move kortese.
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
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Text style={styles.title}>Shuttle Live Tracking</Text>
        <Text style={styles.subtitle}>
          Prototype v1: Driver live location send korbe, student live map e
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
          Driver phone move korle student map e bus marker realtime update hobe.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
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
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  cardCompact: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  mapCard: {
    height: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
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
    marginBottom: 14,
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
  guideButton: {
    backgroundColor: '#EA580C',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  guideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
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
  busMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  busMarkerBubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  busMarkerLive: {
    backgroundColor: '#16A34A',
  },
  busMarkerDelayed: {
    backgroundColor: '#F59E0B',
  },
  busMarkerOffline: {
    backgroundColor: '#6B7280',
  },
  busEmoji: {
    fontSize: 25,
  },
  busMarkerLabel: {
    marginTop: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  busMarkerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#111827',
  },
  busMarkerStatus: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
  },
  busImageMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  busImageMarkerWrapper: {
    width: 76,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    overflow: 'hidden',
  },
  busMarkerImage: {
    width: 72,
    height: 48,
  },
  busMarkerLiveBorder: {
    borderColor: '#16A34A',
  },
  busMarkerDelayedBorder: {
    borderColor: '#F59E0B',
  },
  busMarkerOfflineBorder: {
    borderColor: '#6B7280',
  },
  premiumMarkerContainer: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumStatusRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 8,
  },
  premiumRingLive: {
    borderColor: '#16A34A',
  },
  premiumRingDelayed: {
    borderColor: '#F59E0B',
  },
  premiumRingOffline: {
    borderColor: '#6B7280',
  },
  premiumBus: {
    width: 32,
    height: 46,
    borderRadius: 9,
    backgroundColor: '#F97316',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: '#9A3412',
    overflow: 'visible',
  },
  busDirectionNose: {
    position: 'absolute',
    top: -7,
    width: 16,
    height: 11,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: '#F97316',
    borderWidth: 1.2,
    borderColor: '#9A3412',
  },
  busFrontWindow: {
    position: 'absolute',
    top: 4,
    width: 21,
    height: 8,
    borderRadius: 3,
    backgroundColor: '#0F172A',
  },
  busTopWindowRow: {
    position: 'absolute',
    top: 15,
    flexDirection: 'row',
  },
  busSmallWindow: {
    width: 5,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#1F2937',
    marginHorizontal: 1,
  },
  busCenterLine: {
    position: 'absolute',
    top: 30,
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    opacity: 0.92,
  },
  busRearLight: {
    position: 'absolute',
    bottom: 3,
    left: 6,
    width: 5,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#EF4444',
  },
  busFrontLight: {
    position: 'absolute',
    top: 1,
    right: 6,
    width: 5,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FEF3C7',
  },
  busWheelLeft: {
    position: 'absolute',
    bottom: 8,
    left: -5,
    width: 8,
    height: 13,
    borderRadius: 4,
    backgroundColor: '#111827',
  },
  busWheelRight: {
    position: 'absolute',
    bottom: 8,
    right: -5,
    width: 8,
    height: 13,
    borderRadius: 4,
    backgroundColor: '#111827',
  },
  premiumMarkerLabel: {
    marginTop: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 4,
  },
  premiumMarkerTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#111827',
  },
  premiumMarkerStatus: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F97316',
  },
  roadBusMarkerContainer: {
    width: 100,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roadBusStatusDot: {
    position: 'absolute',
    top: 4,
    right: 18,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 10,
  },
  roadBusLive: {
    backgroundColor: '#16A34A',
  },
  roadBusDelayed: {
    backgroundColor: '#F59E0B',
  },
  roadBusOffline: {
    backgroundColor: '#6B7280',
  },
  roadBus: {
    width: 68,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F97316',
    borderWidth: 2,
    borderColor: '#C2410C',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 8,
  },
  roadBusWindowRow: {
    position: 'absolute',
    top: 5,
    left: 7,
    right: 7,
    height: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roadBusWindow: {
    width: 11,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#111827',
    marginRight: 3,
  },
  roadBusFrontWindow: {
    flex: 1,
    height: 10,
    borderRadius: 3,
    backgroundColor: '#111827',
  },
  roadBusWhiteStripe: {
    position: 'absolute',
    left: 7,
    right: 8,
    bottom: 9,
    height: 4,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  roadBusWheelLeft: {
    position: 'absolute',
    bottom: -5,
    left: 13,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#111827',
    borderWidth: 2,
    borderColor: '#6B7280',
  },
  roadBusWheelRight: {
    position: 'absolute',
    bottom: -5,
    right: 13,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#111827',
    borderWidth: 2,
    borderColor: '#6B7280',
  },
  roadBusHeadLight: {
    position: 'absolute',
    right: -2,
    top: 16,
    width: 5,
    height: 7,
    borderRadius: 3,
    backgroundColor: '#FEF3C7',
  },
  roadBusTailLight: {
    position: 'absolute',
    left: -2,
    top: 16,
    width: 5,
    height: 7,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  roadBusLabel: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    color: '#111827',
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 4,
  },
  cleanBusMarkerContainer: {
    width: 90,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cleanBusMarkerImage: {
    width: 82,
    height: 44,
  },
  cleanBusStatusDot: {
    position: 'absolute',
    top: 2,
    right: 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 10,
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
