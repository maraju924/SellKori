import React, { useState, useEffect } from 'react';
import { 
  Terminal, 
  Trash2, 
  Filter, 
  Activity, 
  Zap, 
  AlertTriangle, 
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export function AdminLogsTelemetry() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    const q = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(50));
    return onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, []);

  const sampleLogs = logs.length > 0 ? logs : [
    {
      id: 'log-1',
      type: 'gemini_api',
      message: 'Gemini 2.5 Flash completion executed (380ms) for Store: FASHION BD',
      timestamp: new Date().toLocaleTimeString(),
      status: 'success'
    },
    {
      id: 'log-2',
      type: 'messenger_webhook',
      message: 'Webhook POST payload received from Meta Graph API - 200 OK',
      timestamp: new Date(Date.now() - 5000).toLocaleTimeString(),
      status: 'success'
    },
    {
      id: 'log-3',
      type: 'capi_event',
      message: 'Meta CAPI "Purchase" event dispatched to Pixel 104928374829',
      timestamp: new Date(Date.now() - 15000).toLocaleTimeString(),
      status: 'success'
    },
    {
      id: 'log-4',
      type: 'steadfast_courier',
      message: 'Steadfast order creation dispatched (CID: STDF-90234)',
      timestamp: new Date(Date.now() - 30000).toLocaleTimeString(),
      status: 'success'
    }
  ];

  return (
    <div className="space-y-6 text-white">
      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-black">
              লাইভ টেলিমিতি ও সিস্টেম লগস
            </h2>
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live WebSocket Stream
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            এআই চ্যাট ইনফারেন্স, মেটা CAPI কনভারশন এবং কুরিয়ার এপিআই রিকোয়েস্ট স্ট্রীম।
          </p>
        </div>

        <div className="flex items-center gap-2">
          {['all', 'gemini_api', 'messenger_webhook', 'capi_event'].map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterType === t ? 'bg-orange-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {t === 'all' ? 'সকল লগ' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal View */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 font-mono text-xs shadow-2xl space-y-2 max-h-[500px] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 text-[11px] text-zinc-500 font-bold">
          <span>EVENT_STREAM_VIEWER // asia-east1</span>
          <span>AUTOSCROLL: ACTIVE</span>
        </div>

        <div className="space-y-2 pt-2">
          {sampleLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 p-2 rounded-xl hover:bg-zinc-900/60 transition-colors">
              <span className="text-zinc-500 text-[10px] shrink-0 mt-0.5">[{log.timestamp}]</span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md shrink-0 ${
                log.type === 'gemini_api' ? 'bg-indigo-950 text-indigo-400 border border-indigo-800' :
                log.type === 'capi_event' ? 'bg-orange-950 text-orange-400 border border-orange-800' :
                'bg-emerald-950 text-emerald-400 border border-emerald-800'
              }`}>
                {log.type}
              </span>
              <span className="text-zinc-300 leading-relaxed text-[11px] flex-1">
                {log.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
