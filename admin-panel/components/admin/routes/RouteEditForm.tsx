'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { updateRouteAction } from '@/app/admin/routes/actions';
import type { RouteActionState } from '@/lib/routes/route-action-state';

import RouteDeleteButton from './RouteDeleteButton';

type EditableRoute = {
  id: string;
  route_name: string;
  short_name: string;
  origin: string;
  destination: string;
  description: string | null;
  is_active: boolean;
};

export default function RouteEditForm({ route }: { route: EditableRoute }) {
  const initialState: RouteActionState = {
    status: 'idle',
    message: '',
    fieldErrors: {},
    values: {
      routeName: route.route_name,
      shortName: route.short_name,
      origin: route.origin,
      destination: route.destination,
      description: route.description ?? '',
      isActive: route.is_active,
    },
  };

  const updateRouteWithId = updateRouteAction.bind(null, route.id);

  const [actionState, formAction, isPending] = useActionState<
    RouteActionState,
    FormData
  >(updateRouteWithId, initialState);

  const state = actionState ?? initialState;

  return (
    <form action={formAction} className="uiu-card overflow-hidden">
      {/* =================================================
          FORM HEADER
      ================================================= */}

      <div className="border-b border-gray-100 px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F37021]">
              Route Information
            </p>

            <h2 className="mt-2 text-2xl font-black text-[#171717]">
              Update Shuttle Route
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Edit the route information carefully. The internal route ID will
              remain unchanged.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Route ID
            </p>

            <p className="mt-1 break-all text-xs font-black text-[#171717]">
              {route.id}
            </p>
          </div>
        </div>
      </div>

      {/* =================================================
          GENERAL ERROR
      ================================================= */}

      {state.status === 'error' && state.message ? (
        <div className="mx-6 mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 sm:mx-8">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-xs font-black text-red-700">
              !
            </div>

            <div>
              <p className="text-sm font-black text-red-800">
                Route could not be updated
              </p>

              <p className="mt-1 text-sm leading-6 text-red-700">
                {state.message}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* =================================================
          FORM FIELDS
      ================================================= */}

      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-2">
        <FormField
          id="route_name"
          name="route_name"
          label="Full Route Name"
          placeholder="Example: 300 Feet to UIU via Bashundhara"
          defaultValue={state.values.routeName}
          error={state.fieldErrors.routeName}
          maxLength={120}
          required
        />

        <FormField
          id="short_name"
          name="short_name"
          label="Short Display Name"
          placeholder="Example: 300 Feet → UIU"
          defaultValue={state.values.shortName}
          error={state.fieldErrors.shortName}
          maxLength={50}
          required
        />

        <FormField
          id="origin"
          name="origin"
          label="Origin"
          placeholder="Example: 300 Feet"
          defaultValue={state.values.origin}
          error={state.fieldErrors.origin}
          maxLength={150}
          required
        />

        <FormField
          id="destination"
          name="destination"
          label="Destination"
          placeholder="Example: United International University"
          defaultValue={state.values.destination}
          error={state.fieldErrors.destination}
          maxLength={150}
          required
        />

        <div className="lg:col-span-2">
          <label
            htmlFor="description"
            className="block text-sm font-black text-[#171717]"
          >
            Route Description
          </label>

          <p className="mt-1 text-xs leading-5 text-gray-500">
            Add major roads, areas or important travel information.
          </p>

          <textarea
            id="description"
            name="description"
            rows={5}
            maxLength={600}
            defaultValue={state.values.description}
            placeholder="Add route details..."
            aria-invalid={Boolean(state.fieldErrors.description)}
            aria-describedby={
              state.fieldErrors.description ? 'description-error' : undefined
            }
            className={`mt-3 w-full resize-y rounded-xl border bg-white px-4 py-3 text-sm leading-6 text-[#171717] transition placeholder:text-gray-400 focus:border-[#F37021] focus:outline-none focus:ring-4 focus:ring-orange-100 ${
              state.fieldErrors.description
                ? 'border-red-400'
                : 'border-gray-300'
            }`}
          />

          <div className="mt-2 flex items-start justify-between gap-4">
            <FieldError
              id="description-error"
              message={state.fieldErrors.description}
            />

            <p className="ml-auto shrink-0 text-xs font-medium text-gray-400">
              Maximum 600 characters
            </p>
          </div>
        </div>

        <div className="lg:col-span-2">
          <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-orange-100 bg-orange-50/70 p-5 transition hover:border-[#F37021]">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={state.values.isActive}
              className="mt-1 h-5 w-5 shrink-0 accent-[#F37021]"
            />

            <span>
              <span className="block text-sm font-black text-[#171717]">
                Route is active
              </span>

              <span className="mt-1 block text-xs leading-5 text-gray-500">
                Active routes may appear in the student and driver applications.
                Uncheck this option to temporarily disable the route.
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* =================================================
          FORM ACTIONS
      ================================================= */}

      <div className="border-t border-gray-100 bg-gray-50 px-6 py-5 sm:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <RouteDeleteButton
              routeId={route.id}
              routeName={state.values.routeName}
              disabled={isPending}
            />

            <p className="mt-2 max-w-md text-xs leading-5 text-gray-400">
              Delete is permanently allowed only when this route has no
              connected operational data.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/admin/routes"
              className={`uiu-secondary-button ${
                isPending ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={isPending}
              className="uiu-primary-button min-w-[160px] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function FormField({
  id,
  name,
  label,
  placeholder,
  defaultValue,
  error,
  maxLength,
  required,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  defaultValue: string;
  error?: string;
  maxLength: number;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-black text-[#171717]">
        {label}

        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </label>

      <input
        id={id}
        name={name}
        type="text"
        required={required}
        maxLength={maxLength}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`mt-3 min-h-[48px] w-full rounded-xl border bg-white px-4 text-sm font-semibold text-[#171717] transition placeholder:font-normal placeholder:text-gray-400 focus:border-[#F37021] focus:outline-none focus:ring-4 focus:ring-orange-100 ${
          error ? 'border-red-400' : 'border-gray-300'
        }`}
      />

      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} className="mt-2 text-xs font-bold leading-5 text-red-600">
      {message}
    </p>
  );
}
