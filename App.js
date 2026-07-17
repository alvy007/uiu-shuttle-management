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
} from 'react-native';

import * as Location from 'expo-location';
import MapView, { UrlTile } from 'react-native-maps';

import { supabase } from './lib/supabase';

import { BUS_ID, getInitialMode, canGoBackHome } from './src/config/appConfig';

import {
  getDurationBetween,
  formatTime,
  calculateTrackingQuality,
} from './src/utils/trackingUtils';

import { getBusStatusInfo } from './src/utils/statusUtils';

import {
  getActiveRoutes,
  getActiveBusesByRoute,
} from './src/services/routeService';

import BusMarker from './src/components/BusMarker';
import RouteSelector from './src/components/RouteSelector';

export default function App() {
  const [mode, setMode] = useState(getInitialMode());

  const [busLocation, setBusLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [followBus, setFollowBus] = useState(true);

  const [routes, setRoutes] = useState([]);
  const [routeLoading, setRouteLoading] = useState(true);
  const [routeErrorMessage, setRouteErrorMessage] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState(null);

  const [routeBuses, setRouteBuses] = useState([]);
  const [loadingRouteBuses, setLoadingRouteBuses] = useState(false);
  const [selectedStudentBusId, setSelectedStudentBusId] = useState(null);
  const [busSelectionMessage, setBusSelectionMessage] = useState('');

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
  const updateCountRef = useRef(0);
  const followBusRef = useRef(true);

  function normalizeLocation(locationData) {
    if (!locationData) {
      return null;
    }

    const latitude = Number(locationData.latitude);
    const longitude = Number(locationData.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return {
      ...locationData,
      latitude,
      longitude,
    };
  }

  function getInitialRegion() {
    const latitude = Number(busLocation?.latitude);
    const longitude = Number(busLocation?.longitude);

    return {
      latitude: Number.isFinite(latitude) ? latitude : 23.797911,
      longitude: Number.isFinite(longitude) ? longitude : 90.449223,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }

  function focusMapOnLocation(locationData, duration = 800) {
    if (!locationData || !mapRef.current || !followBusRef.current) {
      return;
    }

    const normalizedLocation = normalizeLocation(locationData);

    if (!normalizedLocation) {
      return;
    }

    mapRef.current.animateToRegion(
      {
        latitude: normalizedLocation.latitude,
        longitude: normalizedLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      duration,
    );
  }

  function getStudentStatusInfo() {
    const statusInformation = getBusStatusInfo(busLocation, currentTime);

    let statusStyle = styles.offlineBadge;

    if (statusInformation.type === 'live') {
      statusStyle = styles.liveBadge;
    } else if (statusInformation.type === 'delayed') {
      statusStyle = styles.delayedBadge;
    }

    return {
      ...statusInformation,
      style: statusStyle,
    };
  }

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

  function getSelectedRoute() {
    return routes.find(route => route.id === selectedRouteId) || null;
  }

  function getSelectedBus() {
    return routeBuses.find(bus => bus.id === selectedStudentBusId) || null;
  }

  async function fetchBusLocation(busId = selectedStudentBusId) {
    if (!busId) {
      setBusLocation(null);
      setErrorMessage('');
      return;
    }

    try {
      setLoadingLocation(true);
      setErrorMessage('');

      const { data, error } = await supabase
        .from('live_locations')
        .select('*')
        .eq('bus_id', busId)
        .maybeSingle();

      if (error) {
        console.log('SUPABASE FETCH ERROR:', error);

        setErrorMessage(error.message);
        setBusLocation(null);

        return;
      }

      const normalizedLocation = normalizeLocation(data);

      if (!normalizedLocation) {
        setBusLocation(null);
        setErrorMessage(`${busId} has not started live tracking yet.`);

        return;
      }

      setBusLocation(normalizedLocation);

      setTimeout(() => {
        focusMapOnLocation(normalizedLocation);
      }, 250);
    } catch (error) {
      console.log('FETCH LOCATION ERROR:', error);

      setErrorMessage(error?.message || 'Could not load bus location.');

      setBusLocation(null);
    } finally {
      setLoadingLocation(false);
    }
  }

  async function loadBusesForRoute(routeId) {
    if (!routeId) {
      setRouteBuses([]);
      setSelectedStudentBusId(null);
      setBusLocation(null);
      return;
    }

    try {
      setLoadingRouteBuses(true);
      setBusSelectionMessage('');
      setErrorMessage('');
      setBusLocation(null);

      const activeBuses = await getActiveBusesByRoute(routeId);

      setRouteBuses(activeBuses);

      if (activeBuses.length === 0) {
        setSelectedStudentBusId(null);
        setBusLocation(null);

        setBusSelectionMessage(
          'No active bus is currently assigned to this route.',
        );

        return;
      }

      const firstActiveBus = activeBuses[0];

      setSelectedStudentBusId(firstActiveBus.id);

      setBusSelectionMessage(
        `${firstActiveBus.displayName} selected for live tracking.`,
      );
    } catch (error) {
      console.log('LOAD ROUTE BUSES ERROR:', error);

      setRouteBuses([]);
      setSelectedStudentBusId(null);
      setBusLocation(null);

      setBusSelectionMessage(error?.message || 'Could not load route buses.');
    } finally {
      setLoadingRouteBuses(false);
    }
  }

  async function handleRouteSelection(route) {
    if (!route?.id) {
      return;
    }

    if (route.id === selectedRouteId) {
      return;
    }

    setSelectedRouteId(route.id);
    setSelectedStudentBusId(null);
    setRouteBuses([]);
    setBusLocation(null);
    setErrorMessage('');
    setBusSelectionMessage('');

    await loadBusesForRoute(route.id);
  }

  async function loadRoutes() {
    try {
      setRouteLoading(true);
      setRouteErrorMessage('');

      const activeRoutes = await getActiveRoutes();

      setRoutes(activeRoutes);

      if (activeRoutes.length === 0) {
        setSelectedRouteId(null);
        setRouteErrorMessage('No active route found.');
        return;
      }

      const defaultRoute =
        activeRoutes.find(route => route.id === 'route_001') || activeRoutes[0];

      setSelectedRouteId(defaultRoute.id);

      await loadBusesForRoute(defaultRoute.id);
    } catch (error) {
      console.log('LOAD ROUTES ERROR:', error);

      setRoutes([]);
      setSelectedRouteId(null);

      setRouteErrorMessage(error?.message || 'Could not load routes.');
    } finally {
      setRouteLoading(false);
    }
  }

  async function sendCoordsToSupabase(coords, tripId = activeTripId) {
    try {
      if (!tripId) {
        setDriverStatus('No active trip found.');
        return;
      }

      const latitude = Number(coords?.latitude);
      const longitude = Number(coords?.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        setDriverStatus('Invalid GPS coordinates received.');
        return;
      }

      if (
        typeof coords.accuracy === 'number' &&
        Number.isFinite(coords.accuracy) &&
        coords.accuracy > 100
      ) {
        setDriverStatus(`Weak GPS accuracy: ${Math.round(coords.accuracy)}m`);

        return;
      }

      const currentIsoTime = new Date().toISOString();

      const liveLocationPayload = {
        bus_id: BUS_ID,
        latitude,
        longitude,
        accuracy: coords.accuracy ?? null,
        speed: coords.speed ?? null,
        heading: coords.heading ?? null,
        is_active: true,
        updated_at: currentIsoTime,
      };

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

      const { error: locationLogError } = await supabase
        .from('location_logs')
        .insert({
          trip_id: tripId,
          bus_id: BUS_ID,
          latitude,
          longitude,
          accuracy: coords.accuracy ?? null,
          speed: coords.speed ?? null,
          heading: coords.heading ?? null,
          created_at: currentIsoTime,
        });

      if (locationLogError) {
        console.log('LOCATION LOG ERROR:', locationLogError);

        setDriverStatus('Live location sent, but history log failed.');

        Alert.alert('Location Log Error', locationLogError.message);

        return;
      }

      const nextUpdateCount = updateCountRef.current + 1;

      updateCountRef.current = nextUpdateCount;
      setUpdateCount(nextUpdateCount);

      const { error: tripUpdateError } = await supabase
        .from('trips')
        .update({
          total_updates: nextUpdateCount,
          last_latitude: latitude,
          last_longitude: longitude,
          last_accuracy: coords.accuracy ?? null,
        })
        .eq('id', tripId);

      if (tripUpdateError) {
        console.log('TRIP UPDATE ERROR:', tripUpdateError);
      }

      setLastSentLocation(normalizeLocation(liveLocationData));

      setLastSentTime(new Date().toLocaleTimeString());

      setDriverStatus('Location sent and logged successfully.');
    } catch (error) {
      console.log('SEND LOCATION ERROR:', error);

      setDriverStatus('Location send error.');

      Alert.alert(
        'Location Error',
        error?.message || 'Could not send location.',
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

      updateCountRef.current = 0;

      setActiveTripId(data.id);
      setTripStartedAt(data.started_at);
      setUpdateCount(0);
      setLastTripSummary(null);

      return data;
    } catch (error) {
      console.log('CREATE TRIP CATCH ERROR:', error);

      Alert.alert('Trip Error', error?.message || 'Could not create trip.');

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
        error?.message || 'Could not get current location.',
      );
    }
  }

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

      await getOneCurrentLocationAndSend(newTrip.id);

      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }

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

  async function stopTracking() {
    try {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }

      setIsTracking(false);
      setDriverStatus('Stopping trip...');

      const currentIsoTime = new Date().toISOString();

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

  function toggleFollowBus() {
    const nextValue = !followBusRef.current;

    followBusRef.current = nextValue;
    setFollowBus(nextValue);

    if (nextValue && busLocation) {
      setTimeout(() => {
        focusMapOnLocation(busLocation, 500);
      }, 100);
    }
  }

  useEffect(() => {
    followBusRef.current = followBus;
  }, [followBus]);

  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      clearInterval(clockTimer);

      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    loadRoutes();
  }, []);

  useEffect(() => {
    if (!selectedStudentBusId) {
      setBusLocation(null);
      return undefined;
    }

    fetchBusLocation(selectedStudentBusId);

    const realtimeChannel = supabase
      .channel(`student-live-location-${selectedStudentBusId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_locations',
          filter: `bus_id=eq.${selectedStudentBusId}`,
        },
        payload => {
          const normalizedLocation = normalizeLocation(payload?.new);

          if (normalizedLocation) {
            setBusLocation(normalizedLocation);

            setErrorMessage('');

            focusMapOnLocation(normalizedLocation);
          }
        },
      )
      .subscribe(subscriptionStatus => {
        console.log('REALTIME SUBSCRIPTION STATUS:', subscriptionStatus);
      });

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [selectedStudentBusId]);

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
                  Trip ID: {lastTripSummary.id.slice(0, 8)}
                  ...
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

  if (mode === 'student') {
    const studentStatus = getStudentStatusInfo();

    const selectedRoute = getSelectedRoute();

    const selectedBus = getSelectedBus();

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.headerSmall}>
            <Text style={styles.title}>Student Mode</Text>

            <Text style={styles.subtitle}>
              Select a route and view its live shuttle.
            </Text>
          </View>

          <RouteSelector
            routes={routes}
            selectedRouteId={selectedRouteId}
            onSelectRoute={handleRouteSelection}
            loading={routeLoading}
            errorMessage={routeErrorMessage}
          />

          {selectedRoute ? (
            <View style={styles.routeSummaryBox}>
              <Text style={styles.routeSummaryTitle}>
                {selectedRoute.shortName}
              </Text>

              <Text style={styles.routeSummaryText}>
                {selectedRoute.origin}
                {'  →  '}
                {selectedRoute.destination}
              </Text>

              {loadingRouteBuses ? (
                <View style={styles.inlineLoadingRow}>
                  <ActivityIndicator size="small" color="#2563EB" />

                  <Text style={styles.inlineLoadingText}>
                    Loading active buses...
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.routeSummaryText}>
                    Active buses: {routeBuses.length}
                  </Text>

                  <Text style={styles.routeSummaryText}>
                    Tracking:{' '}
                    {selectedBus ? selectedBus.displayName : 'No active bus'}
                  </Text>
                </>
              )}
            </View>
          ) : null}

          <View style={styles.mapCard}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={getInitialRegion()}
              mapType="none"
              showsUserLocation={false}
              showsMyLocationButton={false}
              showsCompass
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
                <BusMarker
                  location={busLocation}
                  statusType={studentStatus.type}
                />
              ) : null}
            </MapView>

            {!busLocation ? (
              <View style={styles.mapLoadingOverlay} pointerEvents="none">
                {loadingLocation || loadingRouteBuses ? (
                  <>
                    <ActivityIndicator size="large" color="#2563EB" />

                    <Text style={styles.mapLoadingText}>
                      Loading bus location...
                    </Text>
                  </>
                ) : (
                  <Text style={styles.errorText}>
                    {errorMessage ||
                      busSelectionMessage ||
                      'No active bus location found.'}
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

            {selectedRoute ? (
              <Text style={styles.locationText}>
                Route: {selectedRoute.shortName}
              </Text>
            ) : null}

            <Text style={styles.locationText}>
              Bus: {selectedBus ? selectedBus.displayName : 'No active bus'}
            </Text>

            {busLocation ? (
              <>
                <Text style={styles.locationText}>
                  Bus ID: {selectedStudentBusId}
                </Text>

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
              onPress={toggleFollowBus}
            >
              <Text style={styles.buttonText}>
                {followBus ? 'Follow Bus: ON' : 'Follow Bus: OFF'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.secondaryButton,
                !selectedStudentBusId && styles.disabledButton,
              ]}
              onPress={() => fetchBusLocation(selectedStudentBusId)}
              disabled={!selectedStudentBusId}
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

            <Text style={styles.guideItem}>2. GPS or Location ON rakhbe.</Text>

            <Text style={styles.guideItem}>3. Battery saver OFF rakhbe.</Text>

            <Text style={styles.guideItem}>
              4. Continue as Driver press korbe.
            </Text>

            <Text style={styles.guideItem}>
              5. Start Tracking press kore permission allow dibe.
            </Text>

            <Text style={styles.guideItem}>
              6. Normal walk or ride test korbe.
            </Text>

            <Text style={styles.guideItem}>
              7. Stop Tracking press kore summary check korbe.
            </Text>
          </View>

          <View style={styles.guideCard}>
            <Text style={styles.guideTitle}>Student Tester</Text>

            <Text style={styles.guideItem}>
              1. Continue as Student press korbe.
            </Text>

            <Text style={styles.guideItem}>2. Route select korbe.</Text>

            <Text style={styles.guideItem}>
              3. Active bus and map marker check korbe.
            </Text>

            <Text style={styles.guideItem}>
              4. Follow Bus ON or OFF test korbe.
            </Text>

            <Text style={styles.guideItem}>
              5. Live, delayed and offline status check korbe.
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Shuttle Live Tracking</Text>

          <Text style={styles.subtitle}>
            Driver live location send korbe and student route select kore
            realtime bus dekhbe.
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
            Student route select korbe and selected route-er active shuttle live
            map-e dekhbe.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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

  routeSummaryBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 7,
    elevation: 2,
  },

  routeSummaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1D4ED8',
    marginBottom: 6,
  },

  routeSummaryText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 3,
  },

  inlineLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },

  inlineLoadingText: {
    fontSize: 13,
    color: '#475569',
    marginLeft: 9,
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
});
