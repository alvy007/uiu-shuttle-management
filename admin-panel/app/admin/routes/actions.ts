'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { RouteActionState } from '@/lib/routes/route-action-state';
import { createClient } from '@/lib/supabase/server';

export async function createRouteAction(
  _previousState: RouteActionState,
  formData: FormData,
): Promise<RouteActionState> {
  const values = {
    routeName: getTrimmedValue(formData, 'route_name'),
    shortName: getTrimmedValue(formData, 'short_name'),
    origin: getTrimmedValue(formData, 'origin'),
    destination: getTrimmedValue(formData, 'destination'),
    description: getTrimmedValue(formData, 'description'),
    isActive: formData.get('is_active') === 'on',
  };

  const fieldErrors: RouteActionState['fieldErrors'] = {};

  // =======================================================
  // 1. SERVER-SIDE FORM VALIDATION
  // =======================================================

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

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: 'error',
      message: 'Please correct the highlighted fields.',
      fieldErrors,
      values,
    };
  }

  // =======================================================
  // 2. VERIFY AUTHENTICATED ADMIN
  // =======================================================

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

  if (
    profileError ||
    !profile ||
    profile.role !== 'admin' ||
    !profile.is_active
  ) {
    return {
      status: 'error',
      message:
        'Your account does not have permission to create shuttle routes.',
      fieldErrors: {},
      values,
    };
  }

  // =======================================================
  // 3. PREVENT DUPLICATE ROUTES
  // =======================================================

  const { data: existingRoutes, error: existingRoutesError } = await supabase
    .from('routes')
    .select('id, route_name, short_name');

  if (existingRoutesError) {
    console.error('Route duplicate check failed:', {
      code: existingRoutesError.code,
      message: existingRoutesError.message,
      details: existingRoutesError.details,
      hint: existingRoutesError.hint,
    });

    return {
      status: 'error',
      message: 'The system could not verify existing routes. Please try again.',
      fieldErrors: {},
      values,
    };
  }

  const duplicateRouteName = (existingRoutes ?? []).some(
    route =>
      normalizeText(route.route_name) === normalizeText(values.routeName),
  );

  if (duplicateRouteName) {
    return {
      status: 'error',
      message: 'A route with this route name already exists.',
      fieldErrors: {
        routeName: 'Please enter a different route name.',
      },
      values,
    };
  }

  const duplicateShortName = (existingRoutes ?? []).some(
    route =>
      normalizeText(route.short_name) === normalizeText(values.shortName),
  );

  if (duplicateShortName) {
    return {
      status: 'error',
      message: 'A route with this short name already exists.',
      fieldErrors: {
        shortName: 'Please enter a different short name.',
      },
      values,
    };
  }

  // =======================================================
  // 4. GENERATE SYSTEM ROUTE ID
  // =======================================================

  const routeId = generateRouteId();

  // =======================================================
  // 5. INSERT ROUTE
  // =======================================================

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
    console.error('Route creation failed:', {
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
    });

    if (insertError.code === '42501') {
      return {
        status: 'error',
        message:
          'Database security policy rejected this request. Confirm that you are signed in with an active admin account.',
        fieldErrors: {},
        values,
      };
    }

    if (insertError.code === '23505') {
      return {
        status: 'error',
        message: 'This route conflicts with an existing database record.',
        fieldErrors: {},
        values,
      };
    }

    return {
      status: 'error',
      message: 'The route could not be created. Please try again.',
      fieldErrors: {},
      values,
    };
  }

  // =======================================================
  // 6. REFRESH ADMIN PAGES
  // =======================================================

  revalidatePath('/admin');
  revalidatePath('/admin/routes');
  revalidatePath('/admin/routes/new');

  redirect('/admin/routes');
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
