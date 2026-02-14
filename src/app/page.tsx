import { createDailyReport, createEntry } from "@/app/actions";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

type SearchParams =
  | {
      q?: string | string[];
      from?: string | string[];
      to?: string | string[];
      reportDate?: string | string[];
    }
  | Promise<{
      q?: string | string[];
      from?: string | string[];
      to?: string | string[];
      reportDate?: string | string[];
    }>;

function formatDateTime(value: Date) {
  return value.toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function normalizeQuery(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return (value[0] ?? "").trim();
  }

  return (value ?? "").trim();
}

function parseDateStart(value: string | string[] | undefined) {
  const normalized = normalizeQuery(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function parseDateEndExclusive(value: string | string[] | undefined) {
  const start = parseDateStart(value);
  if (!start) {
    return null;
  }

  const endExclusive = new Date(start);
  endExclusive.setDate(endExclusive.getDate() + 1);
  return endExclusive;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildReportEditHref({
  reportDate,
  query,
  fromValue,
  toValue,
}: {
  reportDate: Date;
  query: string;
  fromValue: string;
  toValue: string;
}) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }
  if (fromValue) {
    params.set("from", fromValue);
  }
  if (toValue) {
    params.set("to", toValue);
  }

  params.set("reportDate", formatDateInput(reportDate));
  return `/?${params.toString()}#daily-report-editor`;
}

function formatEntryLine(entry: { createdAt: Date; text: string; workMinutes: number }) {
  const time = entry.createdAt.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `[${time}] (${entry.workMinutes}分) ${entry.text}`;
}

export default async function Home({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolvedSearchParams = searchParams
    ? await Promise.resolve(searchParams)
    : {};

  const query = normalizeQuery(resolvedSearchParams.q);
  const fromValue = normalizeQuery(resolvedSearchParams.from);
  const toValue = normalizeQuery(resolvedSearchParams.to);
  const fromDate = parseDateStart(resolvedSearchParams.from);
  const toDateExclusive = parseDateEndExclusive(resolvedSearchParams.to);
  const hasDateRange = Boolean(fromDate || toDateExclusive);
  const isFiltering = query.length > 0 || hasDateRange;

  const today = new Date();
  const todayStart = new Date(`${formatDateInput(today)}T00:00:00`);
  const reportDate = parseDateStart(resolvedSearchParams.reportDate) ?? todayStart;
  const reportDateValue = formatDateInput(reportDate);
  const reportDateEndExclusive = new Date(reportDate);
  reportDateEndExclusive.setDate(reportDateEndExclusive.getDate() + 1);

  const userId = await getDefaultUserId();

  const [entries, reports, selectedReport, selectedDayEntries] = await Promise.all([
    db.entry.findMany({
      where: {
        userId,
        AND: [
          query.length > 0
            ? {
                text: {
                  contains: query,
                },
              }
            : {},
          fromDate
            ? {
                createdAt: {
                  gte: fromDate,
                },
              }
            : {},
          toDateExclusive
            ? {
                createdAt: {
                  lt: toDateExclusive,
                },
              }
            : {},
        ],
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        attachments: true,
      },
      take: 50,
    }),
    db.dailyReport.findMany({
      where: {
        userId,
      },
      orderBy: {
        date: "desc",
      },
      take: 30,
    }),
    db.dailyReport.findUnique({
      where: {
        userId_date: {
          userId,
          date: reportDate,
        },
      },
    }),
    db.entry.findMany({
      where: {
        userId,
        createdAt: {
          gte: reportDate,
          lt: reportDateEndExclusive,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        createdAt: true,
        text: true,
        workMinutes: true,
      },
    }),
  ]);

  const totalWorkMinutes = selectedDayEntries.reduce(
    (acc, entry) => acc + entry.workMinutes,
    0,
  );
  const aggregatedPreview = selectedDayEntries.map(formatEntryLine).join("\n");

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-12">
        <header className="flex flex-col gap-4">
          <div className="inline-flex w-fit items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            KirokuFlow
          </div>
          <h1 className="text-4xl font-semibold leading-tight text-[var(--foreground)] sm:text-5xl">
            作業記録と日報を一つの流れで。
          </h1>
          <p className="max-w-2xl text-base text-[var(--muted)] sm:text-lg">
            その日の作業を記録し、日報をまとめて保存できます。画像も添付できるので
            作業の文脈を逃しません。
          </p>
        </header>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <form
            action={createEntry}
            className="flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_20px_60px_-50px_rgba(0,0,0,0.4)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">作業記録</h2>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                自動で日時記録
              </span>
            </div>
            <textarea
              name="text"
              required
              placeholder="今日取り組んだこと、気づき、次にやることを自由に書く"
              className="min-h-[160px] rounded-2xl border border-[var(--border)] bg-transparent p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-[var(--muted)]">作業時間（分）</label>
              <input
                type="number"
                name="workMinutes"
                min={0}
                step={5}
                defaultValue={0}
                className="w-32 rounded-full border border-[var(--border)] bg-transparent px-4 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <label className="flex cursor-pointer items-center gap-3 rounded-full border border-dashed border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] hover:border-[var(--accent)]">
                画像を添付
                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  className="hidden"
                />
              </label>
              <button
                type="submit"
                className="rounded-full bg-[var(--accent)] px-6 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              >
                記録する
              </button>
            </div>
          </form>

          <div
            id="daily-report-editor"
            className="flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">日報</h2>
              <span className="rounded-full bg-[var(--highlight)]/20 px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                手動要約 + 自動集計
              </span>
            </div>

            <form method="get" className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="q" value={query} />
              <input type="hidden" name="from" value={fromValue} />
              <input type="hidden" name="to" value={toValue} />
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                編集する日付
              </label>
              <input
                type="date"
                name="reportDate"
                defaultValue={reportDateValue}
                className="rounded-full border border-[var(--border)] bg-transparent px-4 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm"
              >
                読み込む
              </button>
            </form>

            <form action={createDailyReport} className="flex flex-col gap-4">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                対象日
              </label>
              <input
                type="date"
                name="date"
                defaultValue={reportDateValue}
                className="w-fit rounded-full border border-[var(--border)] bg-transparent px-4 py-2 text-sm"
              />

              <div className="rounded-2xl border border-[var(--border)] bg-white/60 p-4 text-sm">
                <div className="mb-2 font-semibold">
                  当日集計: {totalWorkMinutes} 分 / {selectedDayEntries.length} 件
                </div>
                <pre className="max-h-36 overflow-auto whitespace-pre-wrap text-xs text-[var(--muted)]">
                  {aggregatedPreview || "当日の作業記録がありません。"}
                </pre>
              </div>

              <textarea
                name="summary"
                required
                defaultValue={selectedReport?.summary ?? ""}
                placeholder="今日の成果、課題、明日の予定を要約"
                className="min-h-[140px] rounded-2xl border border-[var(--border)] bg-transparent p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <button
                type="submit"
                className="rounded-full bg-[var(--foreground)] px-6 py-2 text-sm font-semibold text-white transition hover:translate-y-[-1px]"
              >
                日報を保存
              </button>
            </form>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold">最新の記録</h2>
              <span className="text-xs text-[var(--muted)]">{entries.length} 件</span>
            </div>
            <form className="flex flex-wrap items-center gap-3" method="get">
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="記録本文を検索"
                className="min-w-[220px] flex-1 rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <input
                type="date"
                name="from"
                defaultValue={fromValue}
                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm"
              />
              <input
                type="date"
                name="to"
                defaultValue={toValue}
                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm"
              />
              <input type="hidden" name="reportDate" value={reportDateValue} />
              <button
                type="submit"
                className="rounded-full bg-[var(--foreground)] px-5 py-2 text-sm font-semibold text-white"
              >
                検索
              </button>
              {isFiltering && (
                <Link
                  href={`/?reportDate=${reportDateValue}`}
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)]"
                >
                  クリア
                </Link>
              )}
            </form>
            {isFiltering && (
              <p className="text-sm text-[var(--muted)]">
                {query ? `「${query}」` : "全件"} / 期間 {fromValue || "-"} 〜{" "}
                {toValue || "-"} の検索結果
              </p>
            )}
            <div className="grid gap-4">
              {entries.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-3xl border border-[var(--border)] bg-white/80 p-5 backdrop-blur"
                >
                  <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    <span>{formatDateTime(entry.createdAt)}</span>
                    <span>{entry.workMinutes} 分</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                    {entry.text}
                  </p>
                  {entry.attachments.length > 0 && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {entry.attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white"
                        >
                          <Image
                            src={attachment.url}
                            alt="添付画像"
                            width={1200}
                            height={800}
                            className="h-48 w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
              {entries.length === 0 && (
                <div className="rounded-3xl border border-dashed border-[var(--border)] bg-white/60 p-6 text-sm text-[var(--muted)]">
                  {isFiltering
                    ? "検索条件に一致する記録がありません。"
                    : "まだ記録がありません。上のフォームから最初の作業記録を追加しましょう。"}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">日報アーカイブ</h2>
              <span className="text-xs text-[var(--muted)]">{reports.length} 件</span>
            </div>
            <div className="grid gap-4">
              {reports.map((report) => (
                <article
                  key={report.id}
                  className="rounded-3xl border border-[var(--border)] bg-white/80 p-5"
                >
                  <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    <span>{report.date.toLocaleDateString("ja-JP")}</span>
                    <span>{report.totalWorkMinutes} 分</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                    {report.summary}
                  </p>
                  <div className="mt-4">
                    <Link
                      href={buildReportEditHref({
                        reportDate: report.date,
                        query,
                        fromValue,
                        toValue,
                      })}
                      className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)]"
                    >
                      この日報を編集
                    </Link>
                  </div>
                </article>
              ))}
              {reports.length === 0 && (
                <div className="rounded-3xl border border-dashed border-[var(--border)] bg-white/60 p-6 text-sm text-[var(--muted)]">
                  まだ日報がありません。右上のフォームで要約を保存できます。
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
