import '../types/native';

export function isNativeShell(): boolean {
  return typeof window !== 'undefined' && typeof window.AndroidGamepad?.scanQr === 'function';
}
