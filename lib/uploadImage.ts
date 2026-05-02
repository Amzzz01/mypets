import * as FileSystem from 'expo-file-system';

export async function readFileAsBase64(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64' as any,
  });
  return base64;
}
