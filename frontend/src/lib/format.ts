export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('ko-KR') : '-'

export const formatDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('ko-KR') : '-'
