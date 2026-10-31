import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ShieldAlert, ShieldCheck, Shield, Radio, Clock,
  Zap, AlertTriangle, Globe, User, Server, Crosshair, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SecurityEvent, Incident, IncidentStage, ConnectionStatus } from '@/lib/types';
import { STAGE_LABELS } from '@/lib/types';
import { generateNormalEvent, generateAttackSequence, extractAttackContext } from '@/lib/eventGenerator';

const MAX_EVENTS = 120;

export default function LaptopConsole() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionStatus>('connected');
  const [simulating, setSimulating] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [totalEventsCount, setTotalEventsCount] = useState(0);
  const [neutralizedCount, setNeutralizedCount] = useState(0);
  const streamingRef = useRef(false);

  const activeIncident = useMemo(
    () => incidents.find((i) => i.id === activeIncidentId) || null,
    [incidents, activeIncidentId],
  );

  const metrics = useMemo(() => {
    const criticalEvents = events.filter((e) => e.severity === 'critical').length;
    const activeIncidents = incidents.filter((i) => i.status !== 'neutralized').length;
    const threatsDetected = incidents.length;
    return {
      totalEvents: totalEventsCount,
      criticalEvents,
      activeIncidents,
      threatsDetected,
      neutralized: neutralizedCount,
    };
  }, [events, incidents, totalEventsCount, neutralizedCount]);

  // Load existing data on mount
  useEffect(() => {
    (async () => {
      const [{ data: ev }, { data: inc }] = await Promise.all([
        supabase.from('security_events').select('*').order('ts', { ascending: false }).limit(MAX_EVENTS),
        supabase.from('incidents').select('*').order('created_at', { ascending: false }).limit(50),
      ]);
      if (ev) setEvents(ev);
      if (inc) {
        setIncidents(inc);
        const neu = inc.filter((i) => i.status === 'neutralized').length;
        setNeutralizedCount(neu);
      }
      const { count } = await supabase.from('security_events').select('*', { count: 'exact', head: true });
      if (typeof count === 'number') setTotalEventsCount(count);
    })();
  }, []);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Background normal event generator (laptop produces events into shared stream)
  useEffect(() => {
    if (streamingRef.current) return;
    streamingRef.current = true;

    const insertNormal = async () => {
      const ev = generateNormalEvent();
      const { data } = await supabase.from('security_events').insert(ev).select().single();
      if (data) {
        setEvents((prev) => [data, ...prev].slice(0, MAX_EVENTS));
        setTotalEventsCount((c) => c + 1);
      }
    };

    insertNormal();
    const interval = setInterval(insertNormal, 3500 + Math.random() * 2500);
    return () => clearInterval(interval);
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('soc-laptop')
      .on<SecurityEvent>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'security_events' },
        (payload) => {
          setEvents((prev) => [payload.new, ...prev].slice(0, MAX_EVENTS));
          setTotalEventsCount((c) => c + 1);
        },
      )
      .on<Incident>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incidents' },
        (payload) => {
          setIncidents((prev) => [payload.new, ...prev]);
          setActiveIncidentId(payload.new.id);
        },
      )
      .on<Incident>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'incidents' },
        (payload) => {
          setIncidents((prev) => prev.map((i) => (i.id === payload.new.id ? payload.new : i)));
          if (payload.new.status === 'neutralized') {
            setNeutralizedCount((c) => c + 1);
          }
        },
      )
      .on('system', { event: 'disconnected' }, () => setConnection('reconnecting'))
      .on('system', { event: 'reconnected' }, () => setConnection('connected'))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnection('connected');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setConnection('reconnecting');
        else if (status === 'CLOSED') setConnection('offline');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Simulate attack
  const handleSimulate = useCallback(async () => {
    if (simulating) return;
    setSimulating(true);
    const seq = generateAttackSequence();
    const ctx = extractAttackContext(seq);

    const insertedEvents: SecurityEvent[] = [];

    for (const step of seq) {
      await new Promise((r) => setTimeout(r, step.delayMs));
      const { data } = await supabase.from('security_events').insert(step.event).select().single();
      if (data) {
        insertedEvents.push(data);
        setEvents((prev) => [data, ...prev].slice(0, MAX_EVENTS));
        setTotalEventsCount((c) => c + 1);
      }
    }

    // Generate the incident after the sequence completes
    const evidence = insertedEvents.map((e) => ({
      ts: e.ts,
      event_type: e.event_type,
      description: e.description,
    }));

    const { data: incident } = await supabase
      .from('incidents')
      .insert({
        severity: 'critical',
        threat_type: 'Brute Force & Lateral Movement',
        status: 'investigating',
        affected_user: ctx.targetUser,
        affected_device: ctx.targetHost,
        source_ip: ctx.attackerIp,
        explanation:
          'Multiple failed authentication attempts followed by a successful login from an unusual IP, unauthorized resource access, and a threat intelligence IOC match indicating coordinated brute-force and lateral movement.',
        evidence,
        stage: 4 as IncidentStage,
      })
      .select()
      .single();

    if (incident) {
      setIncidents((prev) => [incident, ...prev]);
      setActiveIncidentId(incident.id);

      // Link events to the incident
      await Promise.all(
        insertedEvents.map((e) =>
          supabase.from('security_events').update({ incident_id: incident.id }).eq('id', e.id),
        ),
      );

      // Progress through stages 5 and 6
      setTimeout(async () => {
        const { data: upd5 } = await supabase
          .from('incidents')
          .update({ stage: 5, status: 'contained', updated_at: new Date().toISOString() })
          .eq('id', incident.id)
          .select()
          .single();
        if (upd5) setIncidents((prev) => prev.map((i) => (i.id === upd5.id ? upd5 : i)));
      }, 5000);

      setTimeout(async () => {
        const { data: upd6 } = await supabase
          .from('incidents')
          .update({ stage: 6, status: 'neutralized', updated_at: new Date().toISOString() })
          .eq('id', incident.id)
          .select()
          .single();
        if (upd6) {
          setIncidents((prev) => prev.map((i) => (i.id === upd6.id ? upd6 : i)));
          setNeutralizedCount((c) => c + 1);
        }
      }, 10000);
    }

    setSimulating(false);
  }, [simulating]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      <TopNav connection={connection} now={now} />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="p-6 space-y-6">
            <MetricsRow metrics={metrics} />
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <EventExplorer events={events} onSimulate={handleSimulate} simulating={simulating} />
              </div>
              <div className="xl:col-span-1">
                <IncidentPanel incidents={incidents} activeIncident={activeIncident} onSelect={setActiveIncidentId} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function TopNav({ connection, now }: { connection: ConnectionStatus; now: Date }) {
  const connConfig = {
    connected: { color: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Live' },
    reconnecting: { color: 'text-amber-400', dot: 'bg-amber-400', label: 'Reconnecting' },
    offline: { color: 'text-rose-400', dot: 'bg-rose-400', label: 'Offline' },
  }[connection];

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">SOC Sentinel</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">
            Console
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${connConfig.dot} ${connection === 'reconnecting' ? 'animate-pulse' : ''}`} />
            <span className={connConfig.color}>System ONLINE</span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Radio className="h-4 w-4" />
          <span className="font-medium text-slate-300">{connConfig.label}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400 font-mono">
          <Clock className="h-4 w-4" />
          <span>{now.toLocaleTimeString([], { hour12: false })} UTC</span>
        </div>
        <div className="flex items-center gap-2 pl-6 border-l border-slate-800">
          <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-white">
            AR
          </div>
          <div className="text-sm">
            <div className="text-slate-200 font-medium leading-tight">A. Rivera</div>
            <div className="text-slate-500 text-xs leading-tight">SOC Analyst · Tier 2</div>
          </div>
        </div>
      </div>
    </header>
  );
}

function Sidebar() {
  const items = [
    { icon: Activity, label: 'Overview', active: true },
    { icon: ShieldAlert, label: 'Live Events' },
    { icon: Crosshair, label: 'Incidents' },
    { icon: Globe, label: 'Threat Intel' },
    { icon: Server, label: 'Assets' },
    { icon: User, label: 'Users' },
    { icon: ShieldCheck, label: 'Reports' },
  ];
  return (
    <aside className="w-16 lg:w-56 border-r border-slate-800 bg-slate-900/40 shrink-0 flex flex-col py-4">
      <nav className="flex flex-col gap-1 px-2 lg:px-3">
        {items.map((item) => (
          <button
            key={item.label}
            className={`flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-colors ${
              item.active
                ? 'bg-sky-500/10 text-sky-400 font-medium'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <item.icon className="h-4.5 w-4.5 shrink-0" />
            <span className="hidden lg:inline">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="mt-auto px-3 hidden lg:block">
        <div className="rounded-lg bg-slate-800/50 border border-slate-800 p-3">
          <div className="text-xs text-slate-500 mb-1">Engine version</div>
          <div className="text-sm text-slate-300 font-medium">Sentinel v3.2.1</div>
        </div>
      </div>
    </aside>
  );
}

function MetricsRow({ metrics }: { metrics: Record<string, number> }) {
  const cards = [
    { label: 'Total Events Received', value: metrics.totalEvents, icon: Activity, accent: 'text-sky-400', bg: 'bg-sky-500/10' },
    { label: 'Critical Events', value: metrics.criticalEvents, icon: AlertTriangle, accent: 'text-rose-400', bg: 'bg-rose-500/10' },
    { label: 'Active Incidents', value: metrics.activeIncidents, icon: ShieldAlert, accent: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Threats Detected', value: metrics.threatsDetected, icon: Crosshair, accent: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Threats Neutralized', value: metrics.neutralized, icon: ShieldCheck, accent: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl bg-slate-900 border border-slate-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className={`h-8 w-8 rounded-lg ${c.bg} flex items-center justify-center`}>
              <c.icon className={`h-4.5 w-4.5 ${c.accent}`} />
            </span>
          </div>
          <div className="text-2xl font-semibold text-white tabular-nums">{c.value.toLocaleString()}</div>
          <div className="text-xs text-slate-400 mt-1">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

const SEVERITY_STYLES: Record<string, string> = {
  info: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  critical: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
};

const STATUS_STYLES: Record<string, string> = {
  processed: 'text-slate-400',
  suspicious: 'text-amber-400',
  investigating: 'text-sky-400',
  contained: 'text-violet-400',
};

function EventExplorer({
  events,
  onSimulate,
  simulating,
}: {
  events: SecurityEvent[];
  onSimulate: () => void;
  simulating: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 flex flex-col h-[calc(100vh-280px)] min-h-[420px]">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Activity className="h-4.5 w-4.5 text-sky-400" />
          <h2 className="text-sm font-semibold text-white">Live Security Event Explorer</h2>
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 ml-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            streaming
          </span>
        </div>
        <button
          onClick={onSimulate}
          disabled={simulating}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            simulating
              ? 'bg-rose-900/40 text-rose-300 cursor-wait border border-rose-800'
              : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/30'
          }`}
        >
          <Zap className={`h-4 w-4 ${simulating ? 'animate-pulse' : ''}`} />
          {simulating ? 'SIMULATING...' : 'SIMULATE ATTACK'}
        </button>
      </div>
      <div className="overflow-y-auto flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 z-10">
            <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
              <th className="font-medium px-4 py-2.5">Timestamp</th>
              <th className="font-medium px-4 py-2.5">Severity</th>
              <th className="font-medium px-4 py-2.5">Event Type</th>
              <th className="font-medium px-4 py-2.5">Source IP</th>
              <th className="font-medium px-4 py-2.5">User</th>
              <th className="font-medium px-4 py-2.5">Host</th>
              <th className="font-medium px-4 py-2.5">Description</th>
              <th className="font-medium px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr
                key={e.id}
                className={`border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors ${
                  e.is_simulated ? 'bg-rose-950/20' : ''
                }`}
              >
                <td className="px-4 py-2.5 text-slate-400 font-mono text-xs whitespace-nowrap">
                  {new Date(e.ts).toLocaleTimeString([], { hour12: false })}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded border ${SEVERITY_STYLES[e.severity]}`}>
                    {e.severity}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-300 font-mono text-xs">{e.event_type}</td>
                <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{e.source_ip}</td>
                <td className="px-4 py-2.5 text-slate-400 text-xs">{e.username || '—'}</td>
                <td className="px-4 py-2.5 text-slate-400 text-xs">{e.host}</td>
                <td className="px-4 py-2.5 text-slate-300 text-xs max-w-xs">
                  {e.is_simulated && <span className="text-rose-500 font-medium mr-1">[SIM]</span>}
                  {e.description}
                </td>
                <td className={`px-4 py-2.5 text-xs font-medium ${STATUS_STYLES[e.status]}`}>
                  {e.status}
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500 text-sm">
                  Waiting for security events...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IncidentPanel({
  incidents,
  activeIncident,
  onSelect,
}: {
  incidents: Incident[];
  activeIncident: Incident | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 flex flex-col h-[calc(100vh-280px)] min-h-[420px]">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-800">
        <Crosshair className="h-4.5 w-4.5 text-amber-400" />
        <h2 className="text-sm font-semibold text-white">Threat Detection & Incidents</h2>
        <span className="ml-auto text-xs text-slate-500">{incidents.length} total</span>
      </div>
      <div className="overflow-y-auto flex-1">
        {activeIncident ? (
          <IncidentDetail incident={activeIncident} onBack={() => onSelect('')} />
        ) : (
          <div className="p-3 space-y-2">
            {incidents.length === 0 && (
              <div className="text-center text-slate-500 text-sm py-8">
                No incidents detected. Monitoring active.
              </div>
            )}
            {incidents.map((inc) => (
              <button
                key={inc.id}
                onClick={() => onSelect(inc.id)}
                className="w-full text-left rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-800/30 p-3 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-mono text-white font-medium">{inc.incident_code}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border ${
                    inc.severity === 'critical'
                      ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                      : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                  }`}>
                    {inc.severity}
                  </span>
                </div>
                <div className="text-xs text-slate-400">{inc.threat_type}</div>
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-full ${
                    inc.status === 'neutralized'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : inc.status === 'contained'
                        ? 'bg-sky-500/10 text-sky-400'
                        : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {inc.status}
                  </span>
                  <span className="text-slate-500">{STAGE_LABELS[inc.stage]}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function IncidentDetail({ incident, onBack }: { incident: Incident; onBack: () => void }) {
  const stages: IncidentStage[] = [1, 2, 3, 4, 5, 6];
  return (
    <div className="p-4">
      <button onClick={onBack} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 mb-3">
        <ChevronRight className="h-3 w-3 rotate-180" /> Back to list
      </button>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-lg font-semibold text-white font-mono">{incident.incident_code}</div>
          <div className="text-sm text-slate-400">{incident.threat_type}</div>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded border ${
          incident.severity === 'critical'
            ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
            : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
        }`}>
          {incident.severity.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <DetailField label="Affected User" value={incident.affected_user} />
        <DetailField label="Affected Device" value={incident.affected_device} />
        <DetailField label="Source IP" value={incident.source_ip} />
        <DetailField label="Detected" value={new Date(incident.created_at).toLocaleString()} />
      </div>

      <div className="mb-4">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">Detection Summary</div>
        <p className="text-sm text-slate-300 leading-relaxed">{incident.explanation}</p>
      </div>

      <div className="mb-4">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Investigation Progress</div>
        <div className="space-y-1.5">
          {stages.map((s) => {
            const done = incident.stage >= s;
            const current = incident.stage === s;
            return (
              <div key={s} className="flex items-center gap-2.5">
                <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  done
                    ? current
                      ? 'bg-sky-500 text-white'
                      : 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-800 text-slate-600'
                }`}>
                  {done && !current ? '✓' : s}
                </div>
                <span className={`text-xs ${done ? 'text-slate-300' : 'text-slate-600'}`}>
                  {STAGE_LABELS[s]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {Array.isArray(incident.evidence) && incident.evidence.length > 0 && (
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Supporting Evidence</div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {incident.evidence.map((ev, i) => (
              <div key={i} className="rounded-md bg-slate-800/50 border border-slate-800 p-2">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono text-slate-500">{new Date(ev.ts).toLocaleTimeString([], { hour12: false })}</span>
                  <span className="text-xs text-sky-400 font-mono">{ev.event_type}</span>
                </div>
                <div className="text-xs text-slate-300">{ev.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-800/40 border border-slate-800 p-2.5">
      <div className="text-xs text-slate-500 mb-0.5">{label}</div>
      <div className="text-sm text-slate-200 font-medium font-mono truncate">{value}</div>
    </div>
  );
}
