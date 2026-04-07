import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

export function useCharacters() {
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchCharacters = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api('/api/characters')
      setCharacters(data)
    } catch {
      setCharacters([])
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshCharacters = async () => {
    setLoading(true)
    try {
      const data = await api('/api/characters/refresh', { method: 'POST' })
      setCharacters(data)
    } catch {
      // 무시
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCharacters() }, [fetchCharacters])

  return { characters, loading, refreshCharacters }
}
