export function isValidHttpUrl(s: string) {
  let url;
  try {
    url = new URL(s);
  } catch (_err) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}
