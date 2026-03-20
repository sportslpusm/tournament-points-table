// Premium loading screen shown while Firestore data loads
export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-accent/[0.04] blur-[120px]" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] rounded-full bg-blue-500/[0.03] blur-[100px]" />
      </div>

      {/* USC Logo — main branding */}
      <div className="relative mb-10">
        {/* Outer pulsing ring */}
        <div className="absolute -inset-3 rounded-3xl border border-accent/10 animate-pulseLive" />
        {/* Logo container */}
        <div className="w-28 h-28 rounded-2xl bg-white/[0.04] backdrop-blur-sm flex items-center justify-center animate-glowPulse border border-white/[0.06]">
          <img
            src="/USC.png"
            alt="Uni Sports Council, LPU"
            className="w-24 h-24 object-contain drop-shadow-lg"
          />
        </div>
      </div>

      {/* Loading text */}
      <h1 className="text-xl font-bold text-white mb-1.5 tracking-tight">Tournament Points Table</h1>
      <p className="text-xs text-gray-500 mb-10 font-medium tracking-wide">Loading your tournament data...</p>

      {/* Progress bar */}
      <div className="w-52 h-[3px] rounded-full bg-navy-800/80 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent via-blue-400 to-accent animate-shimmer"
          style={{ width: '60%', backgroundSize: '200% 100%' }}
        />
      </div>

      {/* USC footer */}
      <div className="mt-14 flex flex-col items-center gap-1.5">
        <p className="text-[10px] text-gray-600 tracking-[0.2em] uppercase font-medium">
          Organized by
        </p>
        <p className="text-[11px] text-gray-500 font-semibold tracking-wide">
          Uni Sports Council, LPU
        </p>
      </div>
    </div>
  );
}
