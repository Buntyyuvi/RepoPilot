export function Logo({ className = "w-8 h-8", iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  return (
    <div className="flex items-center gap-3 select-none">
      <div className={`bg-black text-white rounded-xl flex items-center justify-center shadow-md ${className}`}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          {/* Sparkle & Branch icon matching IndexAI / RepoMind logo */}
          <circle cx="18" cy="6" r="2.5" />
          <circle cx="6" cy="18" r="2.5" />
          <circle cx="12" cy="12" r="2" />
          <path d="M6 15.5V8a2 2 0 0 1 2-2h7.5" />
          <path d="M12 10v.5" />
          <path d="M10 14l2-2 4 4" />
        </svg>
      </div>
      {!iconOnly && (
        <div className="flex flex-col">
          <span className="font-bold text-gray-900 tracking-tight text-base leading-none">
            IndexAI
          </span>
          <span className="text-[11px] text-gray-400 font-medium leading-tight mt-0.5">
            Developer workspace
          </span>
        </div>
      )}
    </div>
  )
}
