import { supabase } from '../../lib/supabase';

function normalizeRoute(route) {
  if (!route) {
    return null;
  }

  return {
    id: route.id,
    routeName: route.route_name,
    shortName: route.short_name,
    origin: route.origin,
    destination: route.destination,
    description: route.description || '',
    isActive: Boolean(route.is_active),
    createdAt: route.created_at,
    updatedAt: route.updated_at,
  };
}

function normalizeBus(bus) {
  if (!bus) {
    return null;
  }

  return {
    id: bus.id,
    displayName: bus.display_name,
    registrationNumber: bus.registration_number || '',
    routeId: bus.route_id,
    isActive: Boolean(bus.is_active),
    createdAt: bus.created_at,
    updatedAt: bus.updated_at,
  };
}

export async function getActiveRoutes() {
  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .eq('is_active', true)
    .order('id', {
      ascending: true,
    });

  if (error) {
    console.log('GET ACTIVE ROUTES ERROR:', error);
    throw new Error(error.message || 'Could not load active routes.');
  }

  return (data || []).map(normalizeRoute).filter(Boolean);
}

export async function getAllRoutes() {
  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .order('id', {
      ascending: true,
    });

  if (error) {
    console.log('GET ALL ROUTES ERROR:', error);
    throw new Error(error.message || 'Could not load routes.');
  }

  return (data || []).map(normalizeRoute).filter(Boolean);
}

export async function getRouteById(routeId) {
  if (!routeId) {
    throw new Error('Route ID is required.');
  }

  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .eq('id', routeId)
    .maybeSingle();

  if (error) {
    console.log('GET ROUTE BY ID ERROR:', error);
    throw new Error(error.message || 'Could not load route.');
  }

  return normalizeRoute(data);
}

export async function getBusesByRoute(routeId) {
  if (!routeId) {
    throw new Error('Route ID is required.');
  }

  const { data, error } = await supabase
    .from('buses')
    .select('*')
    .eq('route_id', routeId)
    .order('id', {
      ascending: true,
    });

  if (error) {
    console.log('GET BUSES BY ROUTE ERROR:', error);
    throw new Error(error.message || 'Could not load route buses.');
  }

  return (data || []).map(normalizeBus).filter(Boolean);
}

export async function getActiveBusesByRoute(routeId) {
  if (!routeId) {
    throw new Error('Route ID is required.');
  }

  const { data, error } = await supabase
    .from('buses')
    .select('*')
    .eq('route_id', routeId)
    .eq('is_active', true)
    .order('id', {
      ascending: true,
    });

  if (error) {
    console.log('GET ACTIVE BUSES BY ROUTE ERROR:', error);
    throw new Error(error.message || 'Could not load active route buses.');
  }

  return (data || []).map(normalizeBus).filter(Boolean);
}

export async function getBusById(busId) {
  if (!busId) {
    throw new Error('Bus ID is required.');
  }

  const { data, error } = await supabase
    .from('buses')
    .select('*')
    .eq('id', busId)
    .maybeSingle();

  if (error) {
    console.log('GET BUS BY ID ERROR:', error);
    throw new Error(error.message || 'Could not load bus.');
  }

  return normalizeBus(data);
}

export async function getRouteWithBuses(routeId) {
  const [route, buses] = await Promise.all([
    getRouteById(routeId),
    getBusesByRoute(routeId),
  ]);

  return {
    route,
    buses,
  };
}

export async function getAllRoutesWithBuses() {
  const routes = await getActiveRoutes();

  const routesWithBuses = await Promise.all(
    routes.map(async route => {
      const buses = await getBusesByRoute(route.id);

      return {
        ...route,
        buses,
      };
    }),
  );

  return routesWithBuses;
}
