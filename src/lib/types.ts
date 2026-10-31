export type Severity = 'info' | 'warning' | 'critical';

export type EventStatus = 'processed' | 'suspicious' | 'investigating' | 'contained';

export type IncidentStatus = 'investigating' | 'contained' | 'neutralized';

export interface SecurityEvent {
  id: string;
  ts: string;
  severity: Severity;
  event_type: string;
  source_ip: string;
  username: string | null;
  host: string;
  description: string;
  status: EventStatus;
  is_simulated: boolean;
  incident_id: string | null;
}

export type IncidentStage = 1 | 2 | 3 | 4 | 5 | 6;

export interface Incident {
  id: string;
  incident_code: string;
  created_at: string;
  updated_at: string;
  severity: 'warning' | 'critical';
  threat_type: string;
  status: IncidentStatus;
  affected_user: string;
  affected_device: string;
  source_ip: string;
  explanation: string;
  evidence: EvidenceItem[];
  stage: IncidentStage;
}

export interface EvidenceItem {
  ts: string;
  event_type: string;
  description: string;
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'offline';

export const STAGE_LABELS: Record<IncidentStage, string> = {
  1: 'Suspicious activity identified',
  2: 'Events correlated',
  3: 'Threat intelligence match',
  4: 'Critical incident generated',
  5: 'Response / containment initiated',
  6: 'Threat neutralized',
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  info: 'emerald',
  warning: 'amber',
  critical: 'rose',
};
