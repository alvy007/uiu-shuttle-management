export const BUS_ID = 'bus_001';

const APP_MODE = process.env.EXPO_PUBLIC_APP_MODE || 'home';

export function getInitialMode() {
  if (APP_MODE === 'driver') {
    return 'driver';
  }

  if (APP_MODE === 'student') {
    return 'student';
  }

  return 'home';
}

export function canGoBackHome() {
  return APP_MODE === 'home';
}
