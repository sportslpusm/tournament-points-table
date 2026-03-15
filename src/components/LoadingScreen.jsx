// Premium loading screen shown while Firestore data loads
export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center">
      {/* USC Logo — main branding */}
      <div className="relative mb-8">
        <div className="w-28 h-28 rounded-2xl bg-white/5 flex items-center justify-center animate-glowPulse">
          <img
            src="/USC.png"
            alt="Uni Sports Council, LPU"
            className="w-24 h-24 object-contain drop-shadow-lg"
          />
        </div>
        {/* Subtle ring */}
        <div className="absolute inset-0 rounded-2xl border border-accent/20 animate-pulseLive" />
      </div>

      {/* Loading text */}
      <h1 className="text-xl font-bold text-white mb-1">Tournament Points Table</h1>
      <p className="text-xs text-gray-500 mb-8">Loading your tournament data...</p>

      {/* Progress bar */}
      <div className="w-48 h-1 rounded-full bg-navy-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-blue-500 animate-shimmer"
          style={{ width: '60%', backgroundSize: '200% 100%' }}
        />
      </div>

      {/* USC footer */}
      <div className="mt-12 flex flex-col items-center gap-1">
        <p className="text-[10px] text-gray-600 tracking-widest uppercase">
          Organized by
        </p>
        <p className="text-[11px] text-gray-500 font-semibold tracking-wide">
          Uni Sports Council, LPU
        </p>
      </div>
    </div>
  );
}
