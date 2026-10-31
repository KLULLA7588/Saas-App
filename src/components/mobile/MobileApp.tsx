import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Shield, ShieldAlert, Activity, Radio, Clock, AlertTriangle,
  Volume2, Bell, User, Server, Globe, ChevronRight, CheckCircle2, Lock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Incident, ConnectionStatus } from '@/lib/types';
import { STAGE_LABELS } from '@/lib/types';
import { startSiren, stopSiren, unlockAudio, vibrate, stopVibrate } from '@/lib/siren';

type Screen = 'login' | 'enable' | 'dashboard';

export default function MobileApp() {
  const [screen, setScreen] = useState<Screen>('login');
  const [analyst, setAnalyst] = useState<{ name: string; id: string } | null>(null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-md min-h-screen flex flex-col relative">
        {screen === 'login' && (
          <LoginScreen onLogin={(a) => { setAnalyst(a); setScreen('enable'); }} />
        )}
        {screen === 'enable' && (
          <EnableScreen onEnable={() => setScreen('dashboard')} analyst={analyst} />
        )}
        {screen === 'dashboard' && analyst && (
          <MobileDashboard analyst={analyst} onLogout={() => { setAnalyst(null); setScreen('login'); }} />
        )}
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (a: { name: string; id: string }) => void }) {
  const [email, setEmail] = useState('a.rivera@soc.sentinel');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Enter your analyst ID and password.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const name = email.split('@')[0].split('.').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      onLogin({ name, id: email });
      setLoading(false);
    }, 700);
  };

  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-12">
      <div className="flex flex-col items-center mb-10">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center mb-4 shadow-lg shadow-sky-900/30">
          <Shield className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">SOC Sentinel</h1>
        <p className="text-sm text-slate-400 mt-1">Security Team Access</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">
            Analyst ID / Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 transition-colors"
            placeholder="analyst@soc.sentinel"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 transition-colors"
            placeholder="••••••••"
          />
        </div>
        {error && (
          <div className="flex items-center gap-2 text-sm text-rose-400 bg-rose-950/30 border border-rose-900 rounded-lg px-3 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Authenticating...
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              Sign In
            </>
          )}
        </button>
      </form>
      <p className="text-center text-xs text-slate-600 mt-6">
        Demo authentication — use any credentials to sign in.
      </p>
    </div>
  );
}

function EnableScreen({ onEnable, analyst }: { onEnable: () => void; analyst: { name: string } | null }) {
  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-12 text-center">
      <div className="h-20 w-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
        <Volume2 className="h-10 w-10 text-amber-400" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">Enable Siren & Start Monitoring</h2>
      <p className="text-sm text-slate-400 mb-2 max-w-xs mx-auto">
        Browsers require a user interaction before playing audio. Tap below to enable the critical alert siren and begin receiving incidents.
      </p>
      <p className="text-xs text-slate-600 mb-8">
        Signed in as {analyst?.name}. You will receive critical incidents in real time.
      </p>
      <button
        onClick={onEnable}
        className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium py-3.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-base"
      >
        <Bell className="h-5 w-5" />
        Enable Siren & Start Monitoring
      </button>
    </div>
  );
}

function MobileDashboard({ analyst, onLogout }: { analyst: { name: string; id: string }; onLogout: () => void }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeAlert, setActiveAlert] = useState<Incident | null>(null);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [connection, setConnection] = useState<ConnectionStatus>('connected');
  const [monitoring, setMonitoring] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const sirenActiveRef = useRef(false);

  // Load existing incidents
  useEffect(() => {
    unlockAudio();
    (async () => {
      const { data } = await supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) {
        setIncidents(data);
        const acked = new Set<string>();
        const firstUnacked = data.find((i) => {
          acked.add(i.id);
          return false;
        });
        setAcknowledgedIds(new Set(data.map((i) => i.id)));
        void firstUnacked;
      }
    })();
  }, []);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Realtime subscriptions for new incidents
  useEffect(() => {
    const channel = supabase
      .channel('soc-mobile')
      .on<Incident>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incidents' },
        (payload) => {
          setIncidents((prev) => [payload.new, ...prev]);
          // Only auto-trigger the siren for critical, unacknowledged incidents
          if (payload.new.severity === 'critical') {
            setActiveAlert(payload.new);
          }
        },
      )
      .on<Incident>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'incidents' },
        (payload) => {
          setIncidents((prev) => prev.map((i) => (i.id === payload.new.id ? payload.new : i)));
          setActiveAlert((cur) => (cur && cur.id === payload.new.id ? payload.new : cur));
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

  // Start siren + vibration when a new critical alert arrives (not after containment)
  useEffect(() => {
    if (activeAlert && !acknowledgedIds.has(activeAlert.id) && !sirenActiveRef.current) {
      sirenActiveRef.current = true;
      startSiren();
      vibrate([500, 200, 500, 200, 500, 200, 500]);
    }
  }, [activeAlert, acknowledgedIds]);

  const acknowledge = useCallback(() => {
    if (!activeAlert) return;
    stopSiren();
    stopVibrate();
    sirenActiveRef.current = false;
    setAcknowledgedIds((prev) => new Set(prev).add(activeAlert.id));
    setActiveAlert(null);
  }, [activeAlert]);

  const recentAlerts = useMemo(() => incidents.slice(0, 10), [incidents]);
  const lastAlert = incidents[0] || null;
  const activeCritical = incidents.filter((i) => i.status !== 'neutralized' && i.severity === 'critical').length;

  // Full-screen critical alert
  if (activeAlert && !acknowledgedIds.has(activeAlert.id)) {
    return <CriticalAlert incident={activeAlert} onAcknowledge={acknowledge} />;
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="px-5 py-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-base font-semibold text-white leading-tight">SOC Sentinel</div>
              <div className="text-xs text-slate-500 leading-tight">Security Team</div>
            </div>
          </div>
          <button onClick={onLogout} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1">
            Sign out
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Welcome */}
        <div>
          <h2 className="text-xl font-semibold text-white">Welcome, {analyst.name}</h2>
          <p className="text-sm text-slate-400 mt-0.5">{analyst.id}</p>
        </div>

        {/* Status card */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio className={`h-4 w-4 ${connection === 'connected' ? 'text-emerald-400' : connection === 'reconnecting' ? 'text-amber-400' : 'text-rose-400'}`} />
              <span className="text-sm font-medium text-slate-200">Monitoring Status</span>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              monitoring ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'
            }`}>
              {monitoring ? 'Active' : 'Paused'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${
                connection === 'connected' ? 'bg-emerald-400' : connection === 'reconnecting' ? 'bg-amber-400 animate-pulse' : 'bg-rose-400'
              }`} />
              <span className="text-slate-400">{connection === 'connected' ? 'Connected to SOC' : connection === 'reconnecting' ? 'Reconnecting...' : 'Offline'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock className="h-3 w-3" />
              <span className="font-mono">{now.toLocaleTimeString([], { hour12: false })}</span>
            </div>
          </div>
        </div>

        {/* Active critical incidents */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-300">Active Critical Incidents</h3>
            <span className="text-xs text-slate-500">{activeCritical}</span>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-rose-950/50 to-slate-900 border border-rose-900/50 p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-rose-500/15 flex items-center justify-center">
                <ShieldAlert className="h-5 w-5 text-rose-400" />
              </div>
              <div className="flex-1">
                <div className="text-2xl font-semibold text-white tabular-nums">{activeCritical}</div>
                <div className="text-xs text-rose-400/80">Require attention</div>
              </div>
            </div>
          </div>
        </div>

        {/* Last alert */}
        {lastAlert && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-300">Last Alert Received</h3>
            </div>
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-mono text-white font-medium">{lastAlert.incident_code}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded border ${
                  lastAlert.severity === 'critical'
                    ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                    : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                }`}>
                  {lastAlert.severity}
                </span>
              </div>
              <div className="text-xs text-slate-400 mb-2">{lastAlert.threat_type}</div>
              <div className="text-xs text-slate-500">
                {new Date(lastAlert.created_at).toLocaleTimeString([], { hour12: false })}
              </div>
            </div>
          </div>
        )}

        {/* Recent alerts list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-300">Recent Alerts</h3>
            <Activity className="h-4 w-4 text-slate-500" />
          </div>
          <div className="space-y-2">
            {recentAlerts.length === 0 && (
              <div className="text-center text-slate-500 text-sm py-6">
                No alerts yet. Monitoring active.
              </div>
            )}
            {recentAlerts.map((inc) => (
              <AlertCard key={inc.id} incident={inc} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertCard({ incident }: { incident: Incident }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`rounded-lg border p-3 transition-colors ${
      incident.status === 'neutralized'
        ? 'bg-slate-900/50 border-slate-800'
        : incident.severity === 'critical'
          ? 'bg-rose-950/20 border-rose-900/40'
          : 'bg-amber-950/20 border-amber-900/40'
    }`}>
      <button onClick={() => setExpanded((e) => !e)} className="w-full text-left">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-mono text-white font-medium">{incident.incident_code}</span>
          <div className="flex items-center gap-1.5">
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              incident.status === 'neutralized'
                ? 'bg-emerald-500/10 text-emerald-400'
                : incident.status === 'contained'
                  ? 'bg-sky-500/10 text-sky-400'
                  : 'bg-amber-500/10 text-amber-400'
            }`}>
              {incident.status}
            </span>
            <ChevronRight className={`h-3.5 w-3.5 text-slate-600 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </div>
        </div>
        <div className="text-xs text-slate-400">{incident.threat_type}</div>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
          <span className="flex items-center gap-1"><User className="h-3 w-3" />{incident.affected_user}</span>
          <span className="flex items-center gap-1"><Server className="h-3 w-3" />{incident.affected_device}</span>
        </div>
      </button>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-slate-800 space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <Globe className="h-3 w-3 text-slate-500" />
            <span className="text-slate-400">Source IP:</span>
            <span className="text-slate-300 font-mono">{incident.source_ip}</span>
          </div>
          <div className="text-xs text-slate-400 leading-relaxed">{incident.explanation}</div>
          <div className="text-xs text-slate-600 mt-1">{STAGE_LABELS[incident.stage]}</div>
        </div>
      )}
    </div>
  );
}

function CriticalAlert({ incident, onAcknowledge }: { incident: Incident; onAcknowledge: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-rose-950/95 backdrop-blur-sm overflow-y-auto">
      {/* Pulsing red background */}
      <div className="absolute inset-0 pointer-events-none animate-pulse-slow bg-gradient-to-b from-rose-900/40 via-transparent to-rose-900/40" />

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-8 min-h-screen">
        {/* Alert icon */}
        <div className="h-24 w-24 rounded-full bg-rose-500/15 border-2 border-rose-500/30 flex items-center justify-center mb-6 animate-pulse">
          <ShieldAlert className="h-12 w-12 text-rose-400" />
        </div>

        <div className="text-xs font-bold tracking-[0.3em] text-rose-400 uppercase mb-2">
          Critical Alert
        </div>
        <h1 className="text-2xl font-bold text-white text-center mb-1">{incident.threat_type}</h1>
        <div className="text-sm font-mono text-rose-300 mb-6">{incident.incident_code}</div>

        {/* Incident details */}
        <div className="w-full max-w-sm space-y-3 mb-6">
          <DetailRow icon={Clock} label="Detected" value={new Date(incident.created_at).toLocaleString()} />
          <DetailRow icon={AlertTriangle} label="Severity" value={incident.severity.toUpperCase()} valueClass="text-rose-400 font-bold" />
          <DetailRow icon={User} label="Affected User" value={incident.affected_user} />
          <DetailRow icon={Server} label="Affected Device" value={incident.affected_device} />
          <DetailRow icon={Globe} label="Source IP" value={incident.source_ip} />
        </div>

        {/* Explanation */}
        <div className="w-full max-w-sm rounded-lg bg-rose-900/30 border border-rose-800/50 p-4 mb-8">
          <div className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-1.5">
            Why was this detected?
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">{incident.explanation}</p>
        </div>

        {/* Acknowledge button */}
        <button
          onClick={onAcknowledge}
          className="relative w-full max-w-sm bg-white hover:bg-rose-50 text-rose-700 font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-lg shadow-2xl shadow-rose-900/50 active:scale-[0.98]"
        >
          <CheckCircle2 className="h-6 w-6" />
          ACKNOWLEDGE / STOP ALARM
        </button>
        <p className="text-xs text-rose-300/60 mt-3 text-center max-w-xs">
          The siren is sounding. Tap above to acknowledge and stop the alarm. This incident will remain in your alert history.
        </p>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon, label, value, valueClass = 'text-white',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-rose-900/20 border border-rose-800/40 px-4 py-2.5">
      <div className="flex items-center gap-2.5 text-rose-300">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-wider font-medium">{label}</span>
      </div>
      <span className={`text-sm font-mono ${valueClass}`}>{value}</span>
    </div>
  );
}
