export default function Footer() {
  return (
    <footer
      className="border-t mt-16 transition-colors duration-300"
      style={{ borderColor: 'var(--header-border)' }}
    >
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-4">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.ico" alt="" className="w-6 h-6" />
          <span className="font-bold text-sm">메이플스토리 유틸리티</span>
        </div>

        <div
          className="grid gap-2 sm:grid-cols-2 text-xs transition-colors duration-300"
          style={{ color: 'var(--text-dim)' }}
        >
          <div className="space-y-1">
            <p>This site is not associated with NEXON Korea.</p>
            <p>
              Data based on{' '}
              <a href="https://openapi.nexon.com" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:text-emerald-400 transition">
                NEXON Open API
              </a>
              .
            </p>
          </div>
          <div className="sm:text-right">
            <p>© {new Date().getFullYear()} caadiq</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
