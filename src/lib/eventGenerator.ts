import type { SecurityEvent } from './types';

const NORMAL_EVENT_TYPES = [
  { type: 'dns_query', desc: 'Recursive DNS lookup for external domain', severity: 'info' as const },
  { type: 'auth_success', desc: 'Successful user authentication', severity: 'info' as const },
  { type: 'tls_handshake', desc: 'TLS handshake established with internal service', severity: 'info' as const },
  { type: 'firewall_allow', desc: 'Firewall rule permitted outbound traffic', severity: 'info' as const },
  { type: 'patch_check', desc: 'Endpoint agent checked in for policy updates', severity: 'info' as const },
  { type: 'health_check', desc: 'Service health probe returned OK', severity: 'info' as const },
  { type: 'backup_ok', desc: 'Scheduled backup completed successfully', severity: 'info' as const },
  { type: 'file_scan', desc: 'Antivirus scan completed, no threats found', severity: 'info' as const },
  { type: 'config_sync', desc: 'Configuration synchronized across cluster nodes', severity: 'info' as const },
  { type: 'session_renew', desc: 'User session token renewed', severity: 'info' as const },
  { type: 'vpn_connect', desc: 'VPN tunnel established for remote endpoint', severity: 'info' as const },
  { type: 'cert_renewal', desc: 'TLS certificate auto-renewal succeeded', severity: 'info' as const },
  { type: 'port_scan_blocked', desc: 'External port scan blocked at perimeter', severity: 'warning' as const },
  { type: 'rate_limit', desc: 'API rate limit triggered for service account', severity: 'warning' as const },
];

const USERNAMES = ['j.martinez', 'a.chen', 's.patel', 'm.olsen', 'r.kumar', 'l.nguyen', 'd.silva', 'k.tanaka', 'svc_backup', 'svc_monitor'];
const HOSTS = ['prod-web-01', 'prod-web-02', 'prod-db-01', 'dev-build-03', 'edge-fw-01', 'vpn-gw-02', 'k8s-node-04', 'bastion-01', 'mail-relay-01', 'log-collector-02'];
const IP_POOL = ['10.4.21.8', '10.4.21.12', '192.168.1.55', '172.16.8.4', '10.0.3.77', '192.168.20.9', '10.5.2.140', '203.0.113.22', '198.51.100.7', '10.8.0.12'];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomIp(): string {
  return randomItem(IP_POOL);
}

export function generateNormalEvent(): Omit<SecurityEvent, 'id' | 'incident_id' | 'is_simulated'> {
  const template = randomItem(NORMAL_EVENT_TYPES);
  return {
    ts: new Date().toISOString(),
    severity: template.severity,
    event_type: template.type,
    source_ip: randomIp(),
    username: Math.random() > 0.3 ? randomItem(USERNAMES) : null,
    host: randomItem(HOSTS),
    description: template.desc,
    status: 'processed',
  };
}

export interface SimulatedAttackStep {
  delayMs: number;
  event: Omit<SecurityEvent, 'id' | 'incident_id' | 'is_simulated'> & { is_simulated: true };
}

export function generateAttackSequence(): SimulatedAttackStep[] {
  const attackerIp = '45.137.21.' + Math.floor(Math.random() * 200 + 20);
  const targetUser = randomItem(['j.martinez', 'a.chen', 's.patel']);
  const targetHost = randomItem(['prod-web-01', 'bastion-01', 'prod-db-01']);
  const ts = () => new Date().toISOString();

  return [
    {
      delayMs: 0,
      event: {
        ts: ts(),
        severity: 'warning',
        event_type: 'auth_failure',
        source_ip: attackerIp,
        username: targetUser,
        host: targetHost,
        description: 'Failed login attempt (incorrect password)',
        status: 'suspicious',
        is_simulated: true,
      },
    },
    {
      delayMs: 1500,
      event: {
        ts: ts(),
        severity: 'warning',
        event_type: 'auth_failure',
        source_ip: attackerIp,
        username: targetUser,
        host: targetHost,
        description: 'Failed login attempt (incorrect password)',
        status: 'suspicious',
        is_simulated: true,
      },
    },
    {
      delayMs: 1500,
      event: {
        ts: ts(),
        severity: 'warning',
        event_type: 'auth_failure',
        source_ip: attackerIp,
        username: targetUser,
        host: targetHost,
        description: 'Failed login attempt (incorrect password)',
        status: 'suspicious',
        is_simulated: true,
      },
    },
    {
      delayMs: 1500,
      event: {
        ts: ts(),
        severity: 'warning',
        event_type: 'auth_failure',
        source_ip: attackerIp,
        username: targetUser,
        host: targetHost,
        description: 'Failed login attempt (account lockout threshold reached)',
        status: 'suspicious',
        is_simulated: true,
      },
    },
    {
      delayMs: 2200,
      event: {
        ts: ts(),
        severity: 'critical',
        event_type: 'unusual_login',
        source_ip: attackerIp,
        username: targetUser,
        host: targetHost,
        description: 'Successful login from unusual geographic IP (Tor exit node detected)',
        status: 'investigating',
        is_simulated: true,
      },
    },
    {
      delayMs: 2000,
      event: {
        ts: ts(),
        severity: 'warning',
        event_type: 'unauthorized_access',
        source_ip: attackerIp,
        username: targetUser,
        host: targetHost,
        description: 'Access attempt to restricted resource /etc/shadow',
        status: 'investigating',
        is_simulated: true,
      },
    },
    {
      delayMs: 2000,
      event: {
        ts: ts(),
        severity: 'warning',
        event_type: 'file_access',
        source_ip: attackerIp,
        username: targetUser,
        host: targetHost,
        description: 'Unusual file access pattern detected on sensitive directory',
        status: 'investigating',
        is_simulated: true,
      },
    },
    {
      delayMs: 2000,
      event: {
        ts: ts(),
        severity: 'critical',
        event_type: 'ioc_match',
        source_ip: attackerIp,
        username: targetUser,
        host: targetHost,
        description: 'Threat intelligence IOC match: source IP flagged in C2 feed',
        status: 'investigating',
        is_simulated: true,
      },
    },
    {
      delayMs: 2000,
      event: {
        ts: ts(),
        severity: 'critical',
        event_type: 'correlation',
        source_ip: attackerIp,
        username: targetUser,
        host: targetHost,
        description: 'Correlated suspicious activities: brute force + lateral movement + IOC match',
        status: 'investigating',
        is_simulated: true,
      },
    },
  ];
}

export interface AttackContext {
  attackerIp: string;
  targetUser: string;
  targetHost: string;
}

export function extractAttackContext(seq: SimulatedAttackStep[]): AttackContext {
  const last = seq[seq.length - 1].event;
  return {
    attackerIp: last.source_ip,
    targetUser: last.username || 'unknown',
    targetHost: last.host,
  };
}
