export function getDeviceFingerprint(): string {
  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
  ].join("|");

  return btoa(raw).slice(0, 64);
}

export function getDeviceName(): string {
  const ua = navigator.userAgent;
  let name = "Unknown Device";

  if (/iPhone/.test(ua)) name = "iPhone";
  else if (/iPad/.test(ua)) name = "iPad";
  else if (/Android/.test(ua)) name = "Android";
  else if (/Macintosh/.test(ua)) name = "Mac";
  else if (/Windows/.test(ua)) name = "Windows";
  else if (/Linux/.test(ua)) name = "Linux";

  return name;
}
