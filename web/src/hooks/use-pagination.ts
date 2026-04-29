import { useMemo, useState } from "react"

export function usePagination(initialPageSize = 20) {
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(initialPageSize)

  return useMemo(
    () => ({
      pageIndex,
      pageSize,
      offset: pageIndex * pageSize,
      limit: pageSize,
      setPageIndex,
      setPageSize,
      reset: () => setPageIndex(0),
    }),
    [pageIndex, pageSize],
  )
}
