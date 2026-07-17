export function getDurationBetween(startedAt, endedAt) {
  if (!startedAt || !endedAt) {
    return 'N/A';
  }

  const startTime = new Date(startedAt).getTime();
  const endTime = new Date(endedAt).getTime();

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    return 'N/A';
  }

  const differenceSeconds = Math.max(
    0,
    Math.floor((endTime - startTime) / 1000),
  );

  const minutes = Math.floor(differenceSeconds / 60);
  const seconds = differenceSeconds % 60;

  return `${minutes}m ${seconds}s`;
}

export function formatTime(dateString) {
  if (!dateString) {
    return 'N/A';
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleTimeString();
}

export function calculateTrackingQuality(logs) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return {
      quality: 'No Data',
      averageAccuracy: null,
      bestAccuracy: null,
      worstAccuracy: null,
      totalPoints: 0,
    };
  }

  const validAccuracyLogs = logs.filter(log => {
    return (
      typeof log.accuracy === 'number' &&
      Number.isFinite(log.accuracy) &&
      log.accuracy >= 0
    );
  });

  if (validAccuracyLogs.length === 0) {
    return {
      quality: 'No Accuracy Data',
      averageAccuracy: null,
      bestAccuracy: null,
      worstAccuracy: null,
      totalPoints: logs.length,
    };
  }

  const accuracyValues = validAccuracyLogs.map(log => log.accuracy);

  const totalAccuracy = accuracyValues.reduce(
    (sum, accuracy) => sum + accuracy,
    0,
  );

  const averageAccuracy = totalAccuracy / accuracyValues.length;
  const bestAccuracy = Math.min(...accuracyValues);
  const worstAccuracy = Math.max(...accuracyValues);

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
