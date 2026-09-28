import { useEffect, useState } from 'react'

/**
 * active 가 true 인 동안 1초마다 증가하는 경과 초를 돌려준다.
 * 지연이 큰 API(수 초~30초) 를 기다릴 때 "멈춘 게 아니다"를 보여주는 용도.
 */
export function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!active) return
    const start = Date.now()
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [active])

  // active 가 아니면 이전 값이 남아 있어도 0 으로 보여준다(다음 활성화 때 자연히 다시 갱신된다).
  return active ? seconds : 0
}
