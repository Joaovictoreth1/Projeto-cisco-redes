import { describe, expect, it } from 'vitest';
import {
  broadcastAddress,
  generateMAC,
  getNetworkStr,
  ipMatchesNetwork,
  ipToLong,
  isSameSubnet,
  isValidIP,
  isValidMask,
  longToIp,
  maskToPrefix,
  networkAddress,
} from '../src/core/ip';

describe('ip helpers', () => {
  it.each(['0.0.0.0', '10.0.0.1', '255.255.255.255', ' 192.168.1.1 '])('accepts %s', (ip) => {
    expect(isValidIP(ip)).toBe(true);
  });

  it.each(['', '256.1.1.1', '1.2.3', '1.2.3.4.5', '01.2.3.4', 'a.b.c.d', '1.2.3.-1'])('rejects %s', (ip) => {
    expect(isValidIP(ip)).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isValidIP(undefined)).toBe(false);
    expect(isValidIP(null)).toBe(false);
  });

  it('round-trips between dotted and numeric forms, including the high bit', () => {
    expect(ipToLong('192.168.1.10')).toBe(3232235786);
    expect(ipToLong('255.255.255.255')).toBe(0xffffffff);
    expect(longToIp(3232235786)).toBe('192.168.1.10');
    expect(longToIp(ipToLong('200.1.2.3'))).toBe('200.1.2.3');
    expect(ipToLong('bogus')).toBe(0);
  });

  it('validates contiguous masks only', () => {
    expect(isValidMask('255.255.255.0')).toBe(true);
    expect(isValidMask('255.255.255.252')).toBe(true);
    expect(isValidMask('0.0.0.0')).toBe(true);
    expect(isValidMask('255.255.255.255')).toBe(true);
    expect(isValidMask('255.0.255.0')).toBe(false);
    expect(isValidMask('255.255.255.1')).toBe(false);
    expect(isValidMask('nope')).toBe(false);
  });

  it('computes prefix, network and broadcast', () => {
    expect(maskToPrefix('255.255.255.252')).toBe(30);
    expect(maskToPrefix('0.0.0.0')).toBe(0);
    expect(longToIp(networkAddress('192.168.1.77', '255.255.255.192'))).toBe('192.168.1.64');
    expect(longToIp(broadcastAddress('192.168.1.77', '255.255.255.192'))).toBe('192.168.1.127');
    expect(getNetworkStr('10.0.12.2', '255.255.255.252')).toBe('10.0.12.0/30');
    expect(getNetworkStr('', '255.255.255.0')).toBe('Unconfigured');
  });

  it('compares subnets', () => {
    expect(isSameSubnet('10.0.0.1', '255.255.255.0', '10.0.0.200', '255.255.255.0')).toBe(true);
    expect(isSameSubnet('10.0.0.1', '255.255.255.0', '10.0.1.1', '255.255.255.0')).toBe(false);
    expect(isSameSubnet('10.0.0.1', '255.255.255.0', '10.0.0.2', '255.255.0.0')).toBe(false);
    expect(isSameSubnet('', '255.255.255.0', '10.0.0.2', '255.255.255.0')).toBe(false);
    expect(ipMatchesNetwork('172.16.5.4', '172.16.0.0', '255.255.0.0')).toBe(true);
    expect(ipMatchesNetwork('172.17.5.4', '172.16.0.0', '255.255.0.0')).toBe(false);
    expect(ipMatchesNetwork('x', '172.16.0.0', '255.255.0.0')).toBe(false);
  });

  it('generates well-formed MAC addresses', () => {
    expect(generateMAC()).toMatch(/^00(:[0-9A-F]{2}){5}$/);
    expect(generateMAC(() => 0.999)).toBe('00:FF:FF:FF:FF:FF');
  });
});
