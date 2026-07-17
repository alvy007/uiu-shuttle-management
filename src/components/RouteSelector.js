import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function RouteSelector({
  routes = [],
  selectedRouteId = null,
  onSelectRoute,
  loading = false,
  errorMessage = '',
}) {
  if (loading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="small" color="#2563EB" />

        <Text style={styles.loadingText}>Loading available routes...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Route loading failed</Text>

        <Text style={styles.errorText}>{errorMessage}</Text>
      </View>
    );
  }

  if (!Array.isArray(routes) || routes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No active route found</Text>

        <Text style={styles.emptyText}>Active routes will appear here.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Select Your Route</Text>

      <Text style={styles.sectionSubtitle}>
        Select a route to view its active buses.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.routeList}
      >
        {routes.map(route => {
          const isSelected = selectedRouteId === route.id;

          return (
            <TouchableOpacity
              key={route.id}
              activeOpacity={0.85}
              style={[styles.routeCard, isSelected && styles.selectedRouteCard]}
              onPress={() => {
                if (typeof onSelectRoute === 'function') {
                  onSelectRoute(route);
                }
              }}
            >
              <View style={styles.routeCardHeader}>
                <View
                  style={[
                    styles.routeNumberBadge,
                    isSelected && styles.selectedRouteNumberBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.routeNumberText,
                      isSelected && styles.selectedRouteNumberText,
                    ]}
                  >
                    {getRouteNumber(route.id)}
                  </Text>
                </View>

                {isSelected ? (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>SELECTED</Text>
                  </View>
                ) : null}
              </View>

              <Text
                style={[
                  styles.routeName,
                  isSelected && styles.selectedRouteName,
                ]}
                numberOfLines={2}
              >
                {route.shortName || route.routeName || 'Unnamed Route'}
              </Text>

              <View style={styles.locationRow}>
                <View style={styles.originDot} />

                <Text
                  style={[
                    styles.locationText,
                    isSelected && styles.selectedLocationText,
                  ]}
                  numberOfLines={1}
                >
                  {route.origin || 'Unknown origin'}
                </Text>
              </View>

              <View style={styles.routeLine} />

              <View style={styles.locationRow}>
                <View style={styles.destinationDot} />

                <Text
                  style={[
                    styles.locationText,
                    isSelected && styles.selectedLocationText,
                  ]}
                  numberOfLines={1}
                >
                  {route.destination || 'Unknown destination'}
                </Text>
              </View>

              {route.description ? (
                <Text
                  style={[
                    styles.description,
                    isSelected && styles.selectedDescription,
                  ]}
                  numberOfLines={3}
                >
                  {route.description}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function getRouteNumber(routeId) {
  if (!routeId) {
    return 'R';
  }

  const routeNumber = String(routeId)
    .replace(/[^0-9]/g, '')
    .replace(/^0+/, '');

  return routeNumber ? `R${routeNumber}` : 'R';
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },

  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 12,
  },

  routeList: {
    paddingRight: 16,
  },

  routeCard: {
    width: 230,
    minHeight: 205,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  selectedRouteCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },

  routeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  routeNumberBadge: {
    minWidth: 42,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  selectedRouteNumberBadge: {
    backgroundColor: '#2563EB',
  },

  routeNumberText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#334155',
  },

  selectedRouteNumberText: {
    color: '#FFFFFF',
  },

  selectedBadge: {
    borderRadius: 999,
    backgroundColor: '#16A34A',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },

  routeName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 22,
    marginBottom: 12,
  },

  selectedRouteName: {
    color: '#1D4ED8',
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  originDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16A34A',
    marginRight: 9,
  },

  destinationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
    marginRight: 9,
  },

  locationText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },

  selectedLocationText: {
    color: '#1E3A8A',
  },

  routeLine: {
    width: 2,
    height: 15,
    backgroundColor: '#CBD5E1',
    marginLeft: 4,
    marginVertical: 2,
  },

  description: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginTop: 12,
  },

  selectedDescription: {
    color: '#475569',
  },

  stateContainer: {
    minHeight: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginTop: 10,
  },

  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 14,
  },

  errorTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#B91C1C',
    marginBottom: 5,
  },

  errorText: {
    fontSize: 13,
    color: '#DC2626',
    lineHeight: 19,
  },

  emptyContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 5,
  },

  emptyText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
  },
});
