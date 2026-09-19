import { Database } from "lucide-react"

export function AmbientBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
      {/* Background Soft Mesh Gradients */}
      <div className="absolute top-1/4 -right-20 w-[600px] h-[600px] bg-emerald-100/30 rounded-full blur-3xl opacity-70 animate-pulse duration-1000" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-orange-100/20 rounded-full blur-3xl opacity-60" />
      <div className="absolute top-10 left-1/3 w-[500px] h-[500px] bg-slate-200/40 rounded-full blur-3xl opacity-50" />

      {/* Connected Graph Lines SVG */}
      <svg className="absolute inset-0 w-full h-full stroke-gray-300/40" strokeWidth="1" fill="none">
        <path d="M 550 250 L 780 280 L 880 180" strokeDasharray="4 4" className="opacity-60" />
        <path d="M 680 400 L 780 280 L 850 430" strokeDasharray="3 3" className="opacity-50" />
      </svg>

      {/* Floating Node: Database Icon Card (as seen on the right side in the image) */}
      <div className="absolute right-[12%] top-[27%] hidden lg:flex items-center justify-center w-12 h-12 rounded-2xl bg-white border border-teal-100/80 shadow-md shadow-teal-500/5 text-teal-600 backdrop-blur-md animate-bounce duration-3000">
        <Database className="w-5 h-5 text-teal-600/90" />
      </div>

      {/* Floating Node Dots */}
      {/* Teal Accent Dot (Top right) */}
      <div className="absolute right-[8%] top-[18%] w-2.5 h-2.5 rounded-full bg-teal-400/90 shadow-xs shadow-teal-300 ring-4 ring-teal-50/50" />

      {/* Coral/Orange Accent Dot (Mid right) */}
      <div className="absolute right-[14%] top-[42%] w-2.5 h-2.5 rounded-full bg-orange-400/90 shadow-xs shadow-orange-300 ring-4 ring-orange-50/50" />
    </div>
  )
}
