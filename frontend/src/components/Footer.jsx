export default function Footer() {
  return (
    <footer className="border-t border-white/5 mt-16">
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-4">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.ico" alt="" className="w-6 h-6" />
          <span className="font-bold text-sm">메이플스토리 유틸리티</span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 text-xs text-gray-500">
          <div>
            <p>이 사이트는 NEXON Korea의 공식 사이트가 아닙니다.</p>
            <p>MapleStory의 모든 저작권은 NEXON Korea에 있습니다.</p>
          </div>
          <div className="sm:text-right">
            <p>
              데이터 출처: <a href="https://openapi.nexon.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400/80 hover:text-emerald-300 transition">NEXON Open API</a>
            </p>
            <p>© {new Date().getFullYear()} caadiq</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
