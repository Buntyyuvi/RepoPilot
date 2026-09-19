export function Footer() {
  return (
    <footer className="w-full py-6 text-center text-xs text-gray-400 font-normal z-20">
      <div className="flex items-center justify-center gap-6">
        <a href="#privacy" className="hover:text-gray-600 transition-colors">
          Privacy
        </a>
        <a href="#terms" className="hover:text-gray-600 transition-colors">
          Terms
        </a>
        <a href="#contact" className="hover:text-gray-600 transition-colors">
          Contact
        </a>
        <span>•</span>
        <span>© 2025 RepoMind AI</span>
      </div>
    </footer>
  )
}
