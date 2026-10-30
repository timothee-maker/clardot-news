import Link from "next/link";
import { Suspense } from "react";
import {
  NO_SUBTYPE,
  PAGE_SIZE,
  listPublications,
  listSubtypes,
  parseFilters,
  type Filters,
} from "@/lib/publications";

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));

function pageHref(f: Filters, page: number) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.type) p.set("type", f.type);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return qs ? `/?${qs}` : "/";
}

const input =
  "rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// Lire searchParams et la base se fait à la requête : on isole ça derrière Suspense (cacheComponents).
export default function Home({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-8 text-zinc-500">Chargement…</p>}>
      <Publications searchParams={searchParams} />
    </Suspense>
  );
}

async function Publications({ searchParams }: { searchParams: SearchParams }) {
  const f = parseFilters(await searchParams);
  const [{ rows, total }, subtypes] = await Promise.all([listPublications(f), listSubtypes()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Publications réglementées</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Source : info-financiere.gouv.fr (AMF) · {total} résultat{total > 1 ? "s" : ""}
      </p>

      <form className="mt-6 flex flex-wrap items-end gap-3" method="GET">
        <label className="flex flex-col gap-1 text-sm">
          Société
          <input className={input} name="q" defaultValue={f.q} placeholder="ex. Eutelsat" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Type d&apos;information
          <select className={`${input} max-w-xs`} name="type" defaultValue={f.type}>
            <option value="">Tous</option>
            {subtypes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value={NO_SUBTYPE}>Non renseigné</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Du
          <input className={input} type="date" name="from" defaultValue={f.from} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Au
          <input className={input} type="date" name="to" defaultValue={f.to} />
        </label>
        <button className="rounded bg-zinc-900 px-4 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
          Filtrer
        </button>
        <Link href="/" className="py-1.5 text-sm text-zinc-500 underline">
          Réinitialiser
        </Link>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-300 text-zinc-500 dark:border-zinc-700">
            <tr>
              <th className="py-2 pr-4 font-medium">Date</th>
              <th className="py-2 pr-4 font-medium">Société</th>
              <th className="py-2 pr-4 font-medium">Titre</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 font-medium">Doc</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 align-top dark:border-zinc-800">
                <td className="whitespace-nowrap py-2 pr-4">{fmtDate(r.published_at)}</td>
                <td className="py-2 pr-4">
                  {r.company_name}
                  {r.is_cac40 && (
                    <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
                      CAC 40
                    </span>
                  )}
                  {r.isin && <div className="text-xs text-zinc-500">{r.isin}</div>}
                </td>
                <td className="py-2 pr-4">
                  {r.title ?? <span className="text-zinc-400">(sans titre)</span>}
                  {r.language && <span className="ml-2 text-xs text-zinc-400">{r.language}</span>}
                </td>
                <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                  {r.info_subtype ?? <span className="text-zinc-400">Non renseigné</span>}
                </td>
                <td className="py-2">
                  {r.doc_url && (
                    <a className="underline" href={r.doc_url} target="_blank" rel="noreferrer">
                      PDF
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-zinc-500">
                  Aucune publication ne correspond à ces filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav className="mt-6 flex items-center gap-4 text-sm">
        {f.page > 1 ? (
          <Link className="underline" href={pageHref(f, f.page - 1)}>
            ← Précédent
          </Link>
        ) : (
          <span className="text-zinc-400">← Précédent</span>
        )}
        <span>
          Page {f.page} / {pages}
        </span>
        {f.page < pages ? (
          <Link className="underline" href={pageHref(f, f.page + 1)}>
            Suivant →
          </Link>
        ) : (
          <span className="text-zinc-400">Suivant →</span>
        )}
      </nav>
    </main>
  );
}
