import { useQuery } from '@tanstack/react-query'
import { API } from '../api/endpoints'

async function fetchOfficialEvents() {
  const res = await fetch(API.officialEvents)
  if (!res.ok) {
    throw new Error('官方活动数据加载失败')
  }
  const data = await res.json()
  return data
}

export function useOfficialEvents() {
  return useQuery({
    queryKey: ['officialEvents'],
    queryFn: fetchOfficialEvents,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}
