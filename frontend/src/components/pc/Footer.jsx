export default function Footer() {
  return (
    <footer
      className="mt-16"
      style={{
        background: 'linear-gradient(180deg, var(--mpl-navy-from), var(--mpl-navy-to))',
        boxShadow: '0 -3px 10px rgba(31,44,61,.2)',
      }}
    >
      <div className="mx-auto max-w-5xl px-6 py-7 space-y-3">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.ico" alt="" className="w-6 h-6" />
          <span
            className="font-bold text-sm"
            style={{ color: 'var(--mpl-title-yellow)', textShadow: '1px 1px 0 rgba(31,44,61,.6)' }}
          >
            메이플스토리 유틸리티
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 text-xs" style={{ color: '#8fa2b5' }}>
          <div className="space-y-1">
            <p>This site is not associated with NEXON Korea.</p>
            <p>
              Data based on{' '}
              <a
                href="https://openapi.nexon.com"
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:brightness-125"
                style={{ color: 'var(--mpl-sky-from)' }}
              >
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
