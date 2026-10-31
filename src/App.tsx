import { useEffect, useState } from 'react';
import LaptopConsole from '@/components/laptop/LaptopConsole';
import MobileApp from '@/components/mobile/MobileApp';

function useRoute(): string {
  const get = () => (typeof window !== 'undefined' ? window.location.pathname : '/');
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const onPop = () => setRoute(get());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return route;
}

export default function App() {
  const route = useRoute();
  const path = route.toLowerCase();

  if (path.startsWith('/mobile')) {
    return <MobileApp />;
  }
  if (path.startsWith('/laptop')) {
    return <LaptopConsole />;
  }

  return <Landing />;
}

function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center gap-8 p-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>
        <span className="text-2xl font-semibold tracking-tight text-white">SOC Sentinel</span>
      </div>
      <p className="text-slate-400 text-center max-w-md">
        Real-time security monitoring platform. Choose your interface to begin.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <a
          href="/laptop"
          className="px-6 py-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium transition-colors text-center"
        >
          Open SOC Console (Laptop)
        </a>
        <a
          href="/mobile"
          className="px-6 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors text-center border border-slate-700"
        >
          Open Mobile App
        </a>
      </div>
    </div>
  );
}
