'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { RouteActionState } from '@/lib/routes/route-action-state';
import { createClient } from '@/lib/supabase/server';

type RouteValues = RouteActionState['values'];
type RouteFieldErrors = RouteActionState['fieldErrors'];

// =========================================================
// CREATE ROUTE
// =========================================================

export async function createRouteAction(
  _previousState: RouteActionState,
  formData: FormData,
): Promise<RouteActionState> {
  const values = readRouteValues(formData);
  const fieldErrors = validateRouteValues(values);

  if (Object.keys(fieldErrors).length > 0) {
    return createErrorState(
      values,
      'Please correct the highlighted fields.',
      fieldErrors,
    );
  }

  const { supabase, isActiveAdmin } = await getAdminContext();

  if (!isActiveAdmin) {
    return createErrorState(
      values,
      'Your account does not have permission to create shuttle routes.',
    );
  }

  const duplicateErrorState = await checkDuplicateRoute(supabase, values);

  if (duplicateErrorState) {
    return duplicateErrorState;
  }

  const routeId = generateRouteId();

  const { error: insertError } = await supabase.from('routes').insert({
    id: routeId,
    route_name: values.routeName,
    short_name: values.shortName,
    origin: values.origin,
    destination: values.destination,
    description: values.description.length > 0 ? values.description : null,
    is_active: values.isActive,
  });

  if (insertError) {
    logDatabaseError('Route creation failed', insertError);

    if (insertError.code === '42501') {
      return createErrorState(
        values,
        'Database security policy rejected this request. Confirm that you are signed in with an active admin account.',
      );
    }

    if (insertError.code === '23505') {
      return createErrorState(
        values,
        'This route conflicts with an existing database record.',
      );
    }

    return createErrorState(
      values,
      'The route could not be created. Please try again.',
    );
  }

  revalidatePath('/admin');
  revalidatePath('/admin/routes');
  revalidatePath('/admin/routes/new');

  redirect('/admin/routes');
}

// =========================================================
// UPDATE ROUTE
// =========================================================

export async function updateRouteAction(
  routeId: string,
  _previousState: RouteActionState,
  formData: FormData,
): Promise<RouteActionState> {
  const cleanRouteId = routeId.trim();
  const values = readRouteValues(formData);
  const fieldErrors = validateRouteValues(values);

  if (!cleanRouteId) {
    return createErrorState(
      values,
      'The route ID is missing. Return to Route Management and try again.',
    );
  }

  if (Object.keys(fieldErrors).length > 0) {
    return createErrorState(
      values,
      'Please correct the highlighted fields.',
      fieldErrors,
    );
  }

  const { supabase, isActiveAdmin } = await getAdminContext();

  if (!isActiveAdmin) {
    return createErrorState(
      values,
      'Your account does not have permission to update shuttle routes.',
    );
  }

  // Confirm that the requested route still exists.
  const { data: currentRoute, error: currentRouteError } = await supabase
    .from('routes')
    .select('id')
    .eq('id', cleanRouteId)
    .maybeSingle();

  if (currentRouteError) {
    logDatabaseError('Route existence check failed', currentRouteError);

    return createErrorState(
      values,
      'The system could not verify this route. Please try again.',
    );
  }

  if (!currentRoute) {
    return createErrorState(
      values,
      'This route no longer exists in the database.',
    );
  }

  const duplicateErrorState = await checkDuplicateRoute(
    supabase,
    values,
    cleanRouteId,
  );

  if (duplicateErrorState) {
    return duplicateErrorState;
  }

  const { data: updatedRoute, error: updateError } = await supabase
    .from('routes')
    .update({
      route_name: values.routeName,
      short_name: values.shortName,
      origin: values.origin,
      destination: values.destination,
      description: values.description.length > 0 ? values.description : null,
      is_active: values.isActive,
    })
    .eq('id', cleanRouteId)
    .select('id')
    .maybeSingle();

  if (updateError) {
    logDatabaseError('Route update failed', updateError);

    if (updateError.code === '42501') {
      return createErrorState(
        values,
        'Database security policy rejected this update. Confirm that you are signed in with an active admin account.',
      );
    }

    if (updateError.code === '23505') {
      return createErrorState(
        values,
        'This route conflicts with another database record.',
      );
    }

    return createErrorState(
      values,
      'The route could not be updated. Please try again.',
    );
  }

  if (!updatedRoute) {
    return createErrorState(
      values,
      'No route was updated. The route may have been removed.',
    );
  }

  revalidatePath('/admin');
  revalidatePath('/admin/routes');
  revalidatePath(`/admin/routes/${cleanRouteId}/edit`);

  redirect('/admin/routes');
}

// =========================================================
// AUTHORIZATION
// =========================================================

async function getAdminContext() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/auth/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  const isActiveAdmin =
    !profileError &&
    Boolean(profile) &&
    profile?.role === 'admin' &&
    profile?.is_active === true;

  return {
    supabase,
    isActiveAdmin,
  };
}

// =========================================================
// DUPLICATE CHECK
// =========================================================

async function checkDuplicateRoute(
  supabase: Awaited<ReturnType<typeof createClient>>,
  values: RouteValues,
  excludedRouteId?: string,
): Promise<RouteActionState | null> {
  let query = supabase.from('routes').select('id, route_name, short_name');

  if (excludedRouteId) {
    query = query.neq('id', excludedRouteId);
  }

  const { data: existingRoutes, error: existingRoutesError } = await query;

  if (existingRoutesError) {
    logDatabaseError('Route duplicate check failed', existingRoutesError);

    return createErrorState(
      values,
      'The system could not verify existing routes. Please try again.',
    );
  }

  const duplicateRouteName = (existingRoutes ?? []).some(
    route =>
      normalizeText(route.route_name) === normalizeText(values.routeName),
  );

  if (duplicateRouteName) {
    return createErrorState(
      values,
      'A route with this route name already exists.',
      {
        routeName: 'Please enter a different route name.',
      },
    );
  }

  const duplicateShortName = (existingRoutes ?? []).some(
    route =>
      normalizeText(route.short_name) === normalizeText(values.shortName),
  );

  if (duplicateShortName) {
    return createErrorState(
      values,
      'A route with this short name already exists.',
      {
        shortName: 'Please enter a different short name.',
      },
    );
  }

  return null;
}

// =========================================================
// VALIDATION
// =========================================================

function validateRouteValues(values: RouteValues): RouteFieldErrors {
  const fieldErrors: RouteFieldErrors = {};

  if (values.routeName.length < 3) {
    fieldErrors.routeName = 'Route name must contain at least 3 characters.';
  } else if (values.routeName.length > 120) {
    fieldErrors.routeName =
      'Route name cannot contain more than 120 characters.';
  }

  if (values.shortName.length < 2) {
    fieldErrors.shortName = 'Short name must contain at least 2 characters.';
  } else if (values.shortName.length > 50) {
    fieldErrors.shortName =
      'Short name cannot contain more than 50 characters.';
  }

  if (values.origin.length < 2) {
    fieldErrors.origin = 'Origin must contain at least 2 characters.';
  } else if (values.origin.length > 150) {
    fieldErrors.origin = 'Origin cannot contain more than 150 characters.';
  }

  if (values.destination.length < 2) {
    fieldErrors.destination = 'Destination must contain at least 2 characters.';
  } else if (values.destination.length > 150) {
    fieldErrors.destination =
      'Destination cannot contain more than 150 characters.';
  }

  if (
    values.origin.length >= 2 &&
    values.destination.length >= 2 &&
    normalizeText(values.origin) === normalizeText(values.destination)
  ) {
    fieldErrors.destination =
      'Origin and destination cannot be the same location.';
  }

  if (values.description.length > 600) {
    fieldErrors.description =
      'Description cannot contain more than 600 characters.';
  }

  return fieldErrors;
}

// =========================================================
// SHARED HELPERS
// =========================================================

function readRouteValues(formData: FormData): RouteValues {
  return {
    routeName: getTrimmedValue(formData, 'route_name'),
    shortName: getTrimmedValue(formData, 'short_name'),
    origin: getTrimmedValue(formData, 'origin'),
    destination: getTrimmedValue(formData, 'destination'),
    description: getTrimmedValue(formData, 'description'),
    isActive: formData.get('is_active') === 'on',
  };
}

function getTrimmedValue(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);

  return typeof value === 'string' ? value.trim() : '';
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function generateRouteId(): string {
  const uniquePart = randomUUID().replaceAll('-', '').slice(0, 12);

  return `route_${uniquePart}`;
}

function createErrorState(
  values: RouteValues,
  message: string,
  fieldErrors: RouteFieldErrors = {},
): RouteActionState {
  return {
    status: 'error',
    message,
    fieldErrors,
    values,
  };
}

function logDatabaseError(
  context: string,
  error: {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  },
) {
  console.error(context, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}
