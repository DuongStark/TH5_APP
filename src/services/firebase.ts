import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';
import config from './firebase.config.json';

// Firebase JS SDK dùng cấu hình ứng dụng Web; không cần google-services.json.
const app = getApps().length ? getApp() : initializeApp(config);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const database = getDatabase(app);
export const usingEmulators = config.useEmulators;

if (usingEmulators) {
  // Android Emulator truy cập máy tính qua 10.0.2.2. Máy thật: điền IP LAN.
  const host =
    config.emulatorHost ||
    (Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1');
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectDatabaseEmulator(database, host, 9000);
}
