'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { deleteRouteAction } from '@/app/admin/routes/actions';

type RouteDeleteButtonProps = {
  routeId: string;
  routeName: string;
  disabled?: boolean;
};

type DeleteFeedback = {
  message: string;
  dependencies?: {
    buses: number;
    driverAssignments: number;
    liveLocations: number;
    trips: number;
    total: number;
  };
};

export default function RouteDeleteButton({
  routeId,
  routeName,
  disabled = false,
}: RouteDeleteButtonProps) {
  const router = useRouter();

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [feedback, setFeedback] = useState<DeleteFeedback | null>(null);

  const [isPending, startTransition] = useTransition();

  const isDisabled = disabled || isPending;

  function openDialog() {
    if (isDisabled) {
      return;
    }

    setFeedback(null);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    if (isPending) {
      return;
    }

    setFeedback(null);
    setIsDialogOpen(false);
  }

  function confirmDelete() {
    setFeedback(null);

    startTransition(async () => {
      try {
        const result = await deleteRouteAction(routeId);

        if (!result.success) {
          setFeedback({
            message: result.message,
            dependencies: result.dependencies,
          });

          return;
        }

        setIsDialogOpen(false);

        router.replace('/admin/routes');
        router.refresh();
      } catch (error) {
        console.error('Unexpected route deletion error:', error);

        setFeedback({
          message: 'An unexpected error occurred while deleting the route.',
        });
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        disabled={isDisabled}
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-red-200 bg-white px-5 text-sm font-black text-red-700 transition hover:border-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Delete Route
      </button>

      {isDialogOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              closeDialog();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-route-title"
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-red-200 bg-white shadow-2xl"
          >
            <div className="h-2 bg-red-600" />

            <div className="p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-lg font-black text-red-700">
                  !
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">
                    Permanent Action
                  </p>

                  <h2
                    id="delete-route-title"
                    className="mt-2 text-2xl font-black text-[#171717]"
                  >
                    Delete this route?
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-gray-500">
                    This action permanently removes the selected route. It
                    cannot be restored from the Admin Panel.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">
                  Route Name
                </p>

                <p className="mt-2 font-black text-[#171717]">{routeName}</p>

                <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">
                  Route ID
                </p>

                <p className="mt-2 break-all text-xs font-bold text-gray-600">
                  {routeId}
                </p>
              </div>

              {feedback ? (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-black text-red-800">
                    Route was not deleted
                  </p>

                  <p className="mt-2 text-sm leading-6 text-red-700">
                    {feedback.message}
                  </p>

                  {feedback.dependencies ? (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <DependencyItem
                        label="Buses"
                        value={feedback.dependencies.buses}
                      />

                      <DependencyItem
                        label="Assignments"
                        value={feedback.dependencies.driverAssignments}
                      />

                      <DependencyItem
                        label="Live Locations"
                        value={feedback.dependencies.liveLocations}
                      />

                      <DependencyItem
                        label="Trips"
                        value={feedback.dependencies.trips}
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-black text-amber-800">
                    Safety check will run first
                  </p>

                  <p className="mt-1 text-xs leading-5 text-amber-700">
                    The route will only be deleted when it has no connected
                    buses, assignments, live locations or trips.
                  </p>
                </div>
              )}

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={isPending}
                  className="uiu-secondary-button disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={isPending}
                  className="inline-flex min-h-[44px] min-w-[170px] items-center justify-center rounded-xl border-0 bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Checking...
                    </span>
                  ) : (
                    'Permanently Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function DependencyItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-red-200 bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-red-500">
        {label}
      </p>

      <p className="mt-1 text-xl font-black text-red-700">{value}</p>
    </div>
  );
}
