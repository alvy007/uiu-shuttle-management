export function getBusStatusInfo(busLocation, currentTime = Date.now()) {
  if (!busLocation) {
    return {
      label: 'NO DATA',
      type: 'offline',
      text: 'No bus location data found.',
    };
  }

  const updatedAt = busLocation.updated_at;

  if (!updatedAt) {
    return {
      label: 'BUS OFFLINE',
      type: 'offline',
      text: 'No update time available.',
    };
  }

  const updatedTime = new Date(updatedAt).getTime();

  if (!Number.isFinite(updatedTime)) {
    return {
      label: 'BUS OFFLINE',
      type: 'offline',
      text: 'Invalid update time.',
    };
  }

  const differenceSeconds = Math.max(
    0,
    Math.floor((currentTime - updatedTime) / 1000),
  );

  if (!busLocation.is_active) {
    return {
      label: 'BUS OFFLINE',
      type: 'offline',
      text: `Bus offline, last updated ${differenceSeconds}s ago`,
    };
  }

  if (differenceSeconds <= 15) {
    return {
      label: 'BUS LIVE',
      type: 'live',
      text: `Live, updated ${differenceSeconds}s ago`,
    };
  }

  if (differenceSeconds <= 60) {
    return {
      label: 'BUS DELAYED',
      type: 'delayed',
      text: `Delayed, updated ${differenceSeconds}s ago`,
    };
  }

  const differenceMinutes = Math.floor(differenceSeconds / 60);

  return {
    label: 'BUS OFFLINE',
    type: 'offline',
    text: `Outdated, updated ${differenceMinutes}m ago`,
  };
}
