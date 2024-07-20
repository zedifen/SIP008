export function base64ToBytes(base64: string) {
  // decode using built-in `atob` function
  const binString = atob(base64);
  // forming a bytes array from decoding result of `atob`
  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return bytes;
}

export function decodeBase64EncodedUTF8(encoded: string): string {
  const bytes = base64ToBytes(encoded);
  const utf8decoder = new TextDecoder();
  return utf8decoder.decode(bytes);
}

export function base64EncodeStringAsUTF8(text: string) {
  const utf8encoder = new TextEncoder();
  // encoding string into utf-8
  const bytes = utf8encoder.encode(text);
  // transform to a string before using built-in `btoa` function
  const s = String.fromCharCode(...bytes);
  return btoa(s);
}

export function isBase64String(s: string): boolean {
  // test possible trailing "=" paddings
  let i = 0;
  while (s[s.length - 1 - i] == '=') {
    i += 1;
    if (i > 2) return false;
  }
  if (i > 0 && s.length % 4 != 0) { return false; }  // has incorrect number of paddings
  const t = (i == 0 ? s : s.slice(0, -i));
  return /^[A-Za-z0-9+/]*/.test(t) || /^[A-Za-z0-9\-_]*/.test(t) || /^[A-Za-z0-9+,]*/.test(t);
}

export function normalizeBase64String(s: string): string {
  return s.replaceAll('-', '+').replaceAll(/_,/g, '/');
}
