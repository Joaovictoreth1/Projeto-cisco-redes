const OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4_RE = new RegExp(`^${OCTET}(\\.${OCTET}){3}$`);

export function isValidIP(ip: string | null | undefined): ip is string {
  return typeof ip === 'string' && IPV4_RE.test(ip.trim());
}

export function ipToLong(ip: string): number {
  if (!isValidIP(ip)) return 0;
  return (
    ip
      .trim()
      .split('.')
      .reduce((acc, octet) => acc * 256 + Number.parseInt(octet, 10), 0) >>> 0
  );
}

export function longToIp(value: number): string {
  const v = value >>> 0;
  return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].join('.');
}

/** A subnet mask is valid when its binary form is a run of ones followed only by zeros. */
export function isValidMask(mask: string | null | undefined): mask is string {
  if (!isValidIP(mask)) return false;
  const m = ipToLong(mask);
  const inverted = ~m >>> 0;
  return (inverted & (inverted + 1)) === 0;
}

export function maskToPrefix(mask: string): number {
  let m = ipToLong(mask);
  let bits = 0;
  while (m) {
    bits += m & 1;
    m >>>= 1;
  }
  return bits;
}

export function networkAddress(ip: string, mask: string): number {
  return (ipToLong(ip) & ipToLong(mask)) >>> 0;
}

export function broadcastAddress(ip: string, mask: string): number {
  return (networkAddress(ip, mask) | (~ipToLong(mask) >>> 0)) >>> 0;
}

export function isSameSubnet(ip1: string, mask1: string, ip2: string, mask2: string): boolean {
  if (!isValidIP(ip1) || !isValidIP(mask1) || !isValidIP(ip2) || !isValidIP(mask2)) return false;
  if (ipToLong(mask1) !== ipToLong(mask2)) return false;
  return networkAddress(ip1, mask1) === networkAddress(ip2, mask2);
}

export function ipMatchesNetwork(ip: string, netIp: string, mask: string): boolean {
  if (!isValidIP(ip) || !isValidIP(netIp) || !isValidIP(mask)) return false;
  return networkAddress(ip, mask) === networkAddress(netIp, mask);
}

export function getNetworkStr(ip: string, mask: string): string {
  if (!isValidIP(ip) || !isValidIP(mask)) return 'Unconfigured';
  return `${longToIp(networkAddress(ip, mask))}/${maskToPrefix(mask)}`;
}

export function generateMAC(random: () => number = Math.random): string {
  const bytes = Array.from({ length: 5 }, () =>
    Math.floor(random() * 256)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase(),
  );
  return ['00', ...bytes].join(':');
}
