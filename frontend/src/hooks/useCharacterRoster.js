import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../api/client'

/**
 * 캐릭터 검색·추가 폼 상태 — 여러 계산기가 같은 골격을 쓴다.
 *
 * 입력(addName)·에러(addError)·자동완성 드롭다운(dropdownOpen)·앵커 ref와
 * 조회 뮤테이션·제출 핸들러를 한 번에 제공한다.
 *
 * @param endpoint (name) => 조회 URL
 * @param onResult 응답 처리. 문자열을 반환하면 그 값이 에러로 표시되고 입력은 유지된다
 *                 (예: 중복 캐릭터). 아무것도 반환하지 않으면 성공으로 보고 입력을 비운다.
 */
export function useCharacterRoster({ endpoint, onResult }) {
  const [addName, setAddName] = useState('')
  const [addError, setAddError] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const addAnchorRef = useRef(null)

  const searchMutation = useMutation({
    mutationFn: (name) => api(endpoint(name)),
    onSuccess: (data) => {
      const err = onResult(data)
      if (err) { setAddError(err); return }
      setAddError('')
      setAddName('')
    },
    onError: (e) => setAddError(e.message || '조회 실패'),
  })

  const handleSearch = (e) => {
    e.preventDefault()
    const n = addName.trim()
    if (!n) return
    setAddError('')
    searchMutation.mutate(n)
  }

  return {
    addName, setAddName, addError, setAddError,
    dropdownOpen, setDropdownOpen, addAnchorRef,
    searchMutation, handleSearch,
  }
}
