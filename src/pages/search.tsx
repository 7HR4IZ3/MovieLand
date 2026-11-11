import { useContext, useEffect, useState, type FormEvent } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ArrowRightIcon, MagnifyingGlassIcon } from "@phosphor-icons/react"
import { PosterGrid } from "../components/media"
import { EmptyState, HomeLink, InlineError, PosterGridSkeleton } from "../components/states"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { CatalogDataContext } from "../lib/app-context"
import { searchCatalog } from "../lib/catalog"
import type { MediaTitle } from "../lib/types"

export function SearchPage() {
  const serverData = useContext(CatalogDataContext)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const query = params.get("q")?.trim() ?? ""
  const [input, setInput] = useState(query)
  const [items, setItems] = useState<MediaTitle[] | null>(serverData.search?.items ?? null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setInput(query)
    if (serverData.search && attempt === 0) return
    if (!query) { setItems([]); return }
    let live = true
    setItems(null)
    setFailed(false)
    searchCatalog(query).then((result) => { if (live) setItems(result.items) }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [query, serverData.search, attempt])

  function submit(event: FormEvent) {
    event.preventDefault()
    navigate(`/search?q=${encodeURIComponent(input.trim())}`)
  }

  return <div className="page" aria-busy={Boolean(query && !items && !failed)}>
    <form className="field searchbar" action="/search" method="get" onSubmit={submit} role="search">
      <MagnifyingGlassIcon aria-hidden="true" />
      <Input name="q" type="search" aria-label="Search" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Search" autoComplete="off" enterKeyHint="search" />
      <Button type="submit" variant="solid" size="icon" aria-label="Search" title="Search"><ArrowRightIcon /></Button>
    </form>
    {failed ? <InlineError onRetry={() => setAttempt((value) => value + 1)} />
      : !query ? <EmptyState icon={<MagnifyingGlassIcon size={44} weight="thin" />} label="Search for movies and series" />
      : !items ? <PosterGridSkeleton />
      : items.length ? <PosterGrid items={items} />
      : <EmptyState label="No results" action={<HomeLink />} />}
  </div>
}
