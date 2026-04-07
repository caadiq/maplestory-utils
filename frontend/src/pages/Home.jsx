import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="flex flex-col items-center gap-8 pt-16">
      <h1 className="text-4xl font-bold">메이플스토리 도우미</h1>
      <p className="text-gray-400">메이플스토리 유틸리티 모음</p>
      <div className="grid gap-4 w-full max-w-md">
        <Link
          to="/boss"
          className="flex items-center gap-4 rounded-lg border border-gray-800 p-6 hover:border-gray-600 transition"
        >
          <span className="text-3xl">💎</span>
          <div>
            <h2 className="text-lg font-semibold">주간 보스 수익 계산기</h2>
            <p className="text-sm text-gray-400">캐릭터별 보스 결정석 수익을 계산합니다</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
