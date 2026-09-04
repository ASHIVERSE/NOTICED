"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ReactNode } from "react";


const API =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";


// =========================================================
// TYPES
// =========================================================

type HistoryPoint = {
  date: string;
  close: number;
  volume: number;
};


type Signal = {
  type: string;
  label: string;
  description: string;
  impact: number;
};


type Stock = {
  symbol: string;
  name: string;
  sector: string | null;

  price: number;
  previous_price: number;
  price_change: number;

  volume: number;
  average_volume: number;
  volume_ratio: number;

  market_change: number;
  relative_to_market: number;
  sector_change?: number;
  relative_to_sector: number;

  typical_move?: number;
  self_move_ratio?: number;

  attention_score: number;

  attention_level:
    | "HIGH"
    | "MEDIUM"
    | "LOW";

  signals: Signal[];

  history?: HistoryPoint[];

  data_source?:
    | "real"
    | "fallback";

  provider?: string;
  data_as_of?: string;
};


type Preferences = {
  price: number;
  volume: number;
  context: number;
};


type LastSeen = {
  timestamp: number;
  scores: Record<string, number>;
  prices: Record<string, number>;
};


type ChartRange =
  | "1D"
  | "1W"
  | "1M";


// =========================================================
// HELPERS
// =========================================================

function formatPrice(
  value: number
) {
  return `₹${value.toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 2,
    }
  )}`;
}


function formatPercent(
  value: number
) {
  return `${
    value >= 0 ? "+" : ""
  }${value.toFixed(2)}%`;
}


function getInitials(
  symbol: string
) {
  return symbol.slice(0, 2);
}


function timeAgo(
  timestamp: number
) {
  const seconds = Math.floor(
    (Date.now() - timestamp) /
      1000
  );

  if (seconds < 60) {
    return "just now";
  }

  const minutes = Math.floor(
    seconds / 60
  );

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(
    hours / 24
  )}d ago`;
}


// =========================================================
// CHART
// =========================================================

function MiniChart({
  history = [],
  range,
}: {
  history?: HistoryPoint[];
  range: ChartRange;
}) {

  const filtered = useMemo(() => {

    if (!history.length) {
      return [];
    }

    if (range === "1D") {
      return history.slice(-2);
    }

    if (range === "1W") {
      return history.slice(-5);
    }

    return history.slice(-22);

  }, [history, range]);


  if (filtered.length < 2) {

    return (
      <div className="flex h-36 items-center justify-center text-xs text-slate-500">
        Historical data unavailable
      </div>
    );
  }


  const prices = filtered.map(
    (item) => item.close
  );


  const min = Math.min(
    ...prices
  );

  const max = Math.max(
    ...prices
  );

  const valueRange =
    max - min || 1;


  const points = prices
    .map(
      (price, index) => {

        const x =
          (index /
            Math.max(
              filtered.length - 1,
              1
            )) *
          234;

        const y =
          90 -
          ((price - min) /
            valueRange) *
            72;

        return `${x},${y}`;
      }
    )
    .join(" ");


  const positive =
    prices[
      prices.length - 1
    ] >= prices[0];


  return (
    <div>

      <svg
        viewBox="0 0 234 100"
        className={`h-36 w-full ${
          positive
            ? "text-cyan-400"
            : "text-red-400"
        }`}
        preserveAspectRatio="none"
      >

        <line
          x1="0"
          y1="20"
          x2="234"
          y2="20"
          stroke="currentColor"
          opacity="0.08"
        />

        <line
          x1="0"
          y1="55"
          x2="234"
          y2="55"
          stroke="currentColor"
          opacity="0.08"
        />

        <line
          x1="0"
          y1="90"
          x2="234"
          y2="90"
          stroke="currentColor"
          opacity="0.08"
        />

        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

      </svg>


      <div className="flex justify-between text-[10px] text-slate-600">

        <span>
          {filtered[0]?.date}
        </span>

        <span>
          {
            filtered[
              filtered.length - 1
            ]?.date
          }
        </span>

      </div>

    </div>
  );
}


// =========================================================
// MAIN PAGE
// =========================================================

export default function Home() {

  const [stocks, setStocks] =
    useState<Stock[]>([]);

  const [selected, setSelected] =
    useState<Stock | null>(null);

  const [filter, setFilter] =
    useState<
      "ALL" |
      "HIGH" |
      "MEDIUM" |
      "QUIET"
    >("ALL");

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [range, setRange] =
    useState<ChartRange>("1W");

  const [
    expandedSignal,
    setExpandedSignal,
  ] = useState<string | null>(
    null
  );

  const [
    showPreferences,
    setShowPreferences,
  ] = useState(false);

  const [
    preferences,
    setPreferences,
  ] = useState<Preferences>({
    price: 1,
    volume: 1,
    context: 1,
  });

  const [lastSeen, setLastSeen] =
    useState<LastSeen | null>(
      null
    );

  const [addSymbol, setAddSymbol] =
    useState("");

  const [addName, setAddName] =
    useState("");

  const [adding, setAdding] =
    useState(false);

  const evidenceRef =
    useRef<HTMLDivElement>(null);


  // =======================================================
  // LOAD LOCAL STATE
  // =======================================================

  useEffect(() => {

    try {

      const stored =
        localStorage.getItem(
          "noticed_last_seen"
        );

      if (stored) {

        setLastSeen(
          JSON.parse(stored)
        );
      }

      const storedPreferences =
        localStorage.getItem(
          "noticed_preferences"
        );

      if (storedPreferences) {

        setPreferences(
          JSON.parse(
            storedPreferences
          )
        );
      }

    } catch {
      // Ignore localStorage errors.
    }

  }, []);


  // =======================================================
  // SAVE PREFERENCES
  // =======================================================

  useEffect(() => {

    try {

      localStorage.setItem(
        "noticed_preferences",
        JSON.stringify(
          preferences
        )
      );

    } catch {
      // Ignore storage errors.
    }

  }, [preferences]);


  // =======================================================
  // FETCH DATA
  // =======================================================

  async function loadData() {

    try {

      setRefreshing(true);
      setError("");

      const response =
        await fetch(
          `${API}/attention/`,
          {
            cache: "no-store",
          }
        );

      if (!response.ok) {

        throw new Error(
          "Unable to load market data"
        );
      }

      const result =
        await response.json();

      const feed: Stock[] =
        result.feed || [];

      setStocks(feed);


      if (feed.length > 0) {

        setSelected(
          (current) => {

            if (!current) {
              return feed[0];
            }

            return (
              feed.find(
                (item) =>
                  item.symbol ===
                  current.symbol
              ) ||
              feed[0]
            );
          }
        );
      }

    } catch (err) {

      console.error(err);

      setError(
        "Could not connect to NOTICED API. Make sure the backend is running."
      );

    } finally {

      setLoading(false);
      setRefreshing(false);
    }
  }


  // =======================================================
  // INITIAL LOAD + REFRESH
  // =======================================================

  useEffect(() => {

    loadData();

    const interval =
      setInterval(
        loadData,
        60_000
      );

    return () =>
      clearInterval(
        interval
      );

  }, []);


  // =======================================================
  // PERSONALIZED SCORE
  // =======================================================

  function personalizedScore(
    stock: Stock
  ) {

    let priceSignal = 0;
    let volumeSignal = 0;
    let contextSignal = 0;


    // Self-relative price signal
    if (
      stock.signals.some(
        (signal) =>
          signal.type ===
          "SELF_RELATIVE_ANOMALY"
      )
    ) {

      priceSignal += 30;
    }


    // Absolute price signal
    if (
      stock.signals.some(
        (signal) =>
          signal.type ===
          "PRICE_ANOMALY"
      )
    ) {

      priceSignal += 25;
    }


    // Volume signal
    if (
      stock.signals.some(
        (signal) =>
          signal.type ===
          "VOLUME_ANOMALY"
      )
    ) {

      volumeSignal += 25;
    }


    // Context signals
    if (
      stock.signals.some(
        (signal) =>
          signal.type ===
            "WATCHLIST_DIVERGENCE" ||
          signal.type ===
            "MARKET_DIVERGENCE" ||
          signal.type ===
            "SECTOR_DIVERGENCE"
      )
    ) {

      contextSignal += 20;
    }


    // Signal conjunction
    if (
      stock.signals.some(
        (signal) =>
          signal.type ===
          "SIGNAL_CONJUNCTION"
      )
    ) {

      contextSignal += 15;
    }


    const score =
      priceSignal *
        preferences.price +

      volumeSignal *
        preferences.volume +

      contextSignal *
        preferences.context;


    // Minimum connection to actual
    // underlying attention score.
    const baseScore =
      stock.attention_score;


    const finalScore =
      Math.max(
        Math.round(
          score
        ),
        Math.round(
          baseScore * 0.5
        )
      );


    return Math.min(
      finalScore,
      100
    );
  }


  // =======================================================
  // FILTERING + PERSONALIZED RANKING
  // =======================================================

  const visibleStocks =
    useMemo(() => {

      let result = [
        ...stocks,
      ];


      if (filter === "HIGH") {

        result =
          result.filter(
            (stock) =>
              stock.attention_level ===
              "HIGH"
          );
      }


      if (filter === "MEDIUM") {

        result =
          result.filter(
            (stock) =>
              stock.attention_level ===
              "MEDIUM"
          );
      }


      if (filter === "QUIET") {

        result =
          result.filter(
            (stock) =>
              stock.attention_level ===
              "LOW"
          );
      }


      if (search.trim()) {

        const query =
          search
            .toLowerCase()
            .trim();

        result =
          result.filter(
            (stock) =>
              stock.symbol
                .toLowerCase()
                .includes(query) ||

              stock.name
                .toLowerCase()
                .includes(query)
          );
      }


      result.sort(
        (a, b) =>
          personalizedScore(b) -
          personalizedScore(a)
      );


      return result;

    }, [
      stocks,
      filter,
      search,
      preferences,
    ]);


  // =======================================================
  // COUNTS
  // =======================================================

  const highCount =
    stocks.filter(
      (stock) =>
        stock.attention_level ===
        "HIGH"
    ).length;


  const mediumCount =
    stocks.filter(
      (stock) =>
        stock.attention_level ===
        "MEDIUM"
    ).length;


  const quietCount =
    stocks.filter(
      (stock) =>
        stock.attention_level ===
        "LOW"
    ).length;


  // =======================================================
  // MARKET MEMORY
  // =======================================================

  const changedStocks =
    stocks.filter(
      (stock) => {

        if (!lastSeen) {
          return false;
        }


        const oldScore =
          lastSeen.scores[
            stock.symbol
          ];


        const oldPrice =
          lastSeen.prices[
            stock.symbol
          ];


        if (
          oldScore === undefined ||
          oldPrice === undefined
        ) {

          return false;
        }


        const priceDifference =
          Math.abs(
            (
              (stock.price -
                oldPrice) /
              oldPrice
            ) * 100
          );


        const scoreDifference =
          Math.abs(
            stock.attention_score -
            oldScore
          );


        return (
          priceDifference >= 1 ||
          scoreDifference >= 10
        );
      }
    );


  // =======================================================
  // MARK AS CHECKED
  // =======================================================

  function markAsChecked() {

    if (!stocks.length) {
      return;
    }


    const state: LastSeen = {

      timestamp:
        Date.now(),

      scores:
        Object.fromEntries(
          stocks.map(
            (stock) => [
              stock.symbol,
              stock.attention_score,
            ]
          )
        ),

      prices:
        Object.fromEntries(
          stocks.map(
            (stock) => [
              stock.symbol,
              stock.price,
            ]
          )
        ),
    };


    try {

      localStorage.setItem(
        "noticed_last_seen",
        JSON.stringify(state)
      );

    } catch {
      // Ignore storage errors.
    }


    setLastSeen(state);
  }


  // =======================================================
  // SELECT STOCK
  // =======================================================

  function selectStock(
    stock: Stock
  ) {

    setSelected(stock);

    setExpandedSignal(
      null
    );


    setTimeout(() => {

      evidenceRef.current?.scrollIntoView(
        {
          behavior: "smooth",
          block: "start",
        }
      );

    }, 100);
  }


  // =======================================================
  // ADD STOCK
  // =======================================================

  async function addStock() {

    if (
      !addSymbol.trim() ||
      !addName.trim()
    ) {

      setError(
        "Enter both a stock symbol and company name."
      );

      return;
    }


    try {

      setAdding(true);
      setError("");


      const params =
        new URLSearchParams({
          symbol:
            addSymbol
              .trim()
              .toUpperCase(),

          name:
            addName.trim(),
        });


      const response =
        await fetch(
          `${API}/watchlist/?${params.toString()}`,
          {
            method: "POST",
          }
        );


      if (!response.ok) {

        throw new Error(
          "Could not add stock"
        );
      }


      setAddSymbol("");
      setAddName("");


      await loadData();

    } catch (err) {

      console.error(err);

      setError(
        "Could not add this stock."
      );

    } finally {

      setAdding(false);
    }
  }


  // =======================================================
  // REMOVE STOCK
  // =======================================================

  async function removeStock(
    symbol: string
  ) {

    try {

      setError("");


      const response =
        await fetch(
          `${API}/watchlist/${symbol}`,
          {
            method: "DELETE",
          }
        );


      if (!response.ok) {

        throw new Error(
          "Could not remove stock"
        );
      }


      const remaining =
        stocks.filter(
          (stock) =>
            stock.symbol !==
            symbol
        );


      setStocks(
        remaining
      );


      if (
        selected?.symbol ===
        symbol
      ) {

        setSelected(
          remaining[0] ||
          null
        );
      }

    } catch (err) {

      console.error(err);

      setError(
        "Could not remove this stock."
      );
    }
  }


  // =======================================================
  // LOADING
  // =======================================================

  if (
    loading &&
    !stocks.length
  ) {

    return (

      <main className="flex min-h-screen items-center justify-center bg-[#07090c] text-white">

        <div className="text-center">

          <div className="text-3xl font-black tracking-tight">

            NOTICED
            <span className="text-cyan-400">
              .
            </span>

          </div>

          <p className="mt-3 text-sm text-slate-500">
            Loading market signals...
          </p>

        </div>

      </main>
    );
  }


  // =======================================================
  // PAGE
  // =======================================================

  return (

    <main className="min-h-screen bg-[#07090c] text-white">

      {/* HEADER */}

      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#07090c]/95 backdrop-blur-xl">

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">

          <div>

            <div className="text-2xl font-black tracking-tight">

              NOTICED
              <span className="text-cyan-400">
                .
              </span>

            </div>

            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
              Your market attention engine
            </div>

          </div>


          <div className="flex items-center gap-2">

            <div className="hidden items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400 sm:flex">

              <span>
                ●
              </span>

              Market data connected

            </div>


            <button
              type="button"
              onClick={() =>
                setShowPreferences(
                  !showPreferences
                )
              }
              className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300 hover:border-white/20 hover:bg-white/5"
            >
              Preferences
            </button>


            <button
              type="button"
              onClick={loadData}
              disabled={refreshing}
              className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
              title="Refresh market data"
            >
              {refreshing
                ? "..."
                : "↻"}
            </button>

          </div>

        </div>

      </header>


      <div className="mx-auto max-w-7xl px-5 py-8">


        {/* HERO */}

        <section className="mb-9">

          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">
            Attention feed
          </div>


          <h1 className="mt-4 max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.045em] sm:text-6xl lg:text-7xl">

            Don&apos;t watch
            everything.

            <br />

            Watch what{" "}

            <span className="text-cyan-400">
              changed.
            </span>

          </h1>


          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">

            NOTICED detects unusual behaviour,
            compares it with the stock&apos;s own
            history and market context, then ranks
            the changes that deserve your attention.

          </p>

        </section>


        {/* ERROR */}

        {error && (

          <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">

            {error}

          </div>

        )}


        {/* STATS */}

        <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">

          <StatCard
            label="Watching"
            value={stocks.length}
            description="stocks"
          />

          <StatCard
            label="High"
            value={highCount}
            description="needs attention"
          />

          <StatCard
            label="Medium"
            value={mediumCount}
            description="worth checking"
          />

          <StatCard
            label="Quiet"
            value={quietCount}
            description="nothing unusual"
          />

        </section>


        {/* MARKET MEMORY */}

        <section className="mb-8 rounded-2xl border border-white/10 bg-[#0c1015] p-5">

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

            <div className="flex items-start gap-3">

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-cyan-400">
                ✦
              </div>


              <div>

                <div className="font-semibold">
                  Since your last check
                </div>


                <div className="mt-1 text-xs text-slate-500">

                  {!lastSeen

                    ? "This is your first check. NOTICED will remember what you saw."

                    : changedStocks.length === 0

                    ? "No meaningful changes across your watchlist."

                    : `${changedStocks.length} stock${
                        changedStocks.length >
                        1
                          ? "s"
                          : ""
                      } changed meaningfully since your last check.`}

                </div>

              </div>

            </div>


            <div className="flex items-center gap-3">

              {lastSeen && (

                <span className="text-xs text-slate-600">

                  Last checked{" "}

                  {timeAgo(
                    lastSeen.timestamp
                  )}

                </span>

              )}


              <button
                type="button"
                onClick={
                  markAsChecked
                }
                className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-black hover:bg-cyan-300"
              >
                Mark as checked
              </button>

            </div>

          </div>


          {changedStocks.length > 0 && (

            <div className="mt-4 flex flex-wrap gap-2">

              {changedStocks.map(
                (stock) => (

                  <button
                    key={
                      stock.symbol
                    }
                    type="button"
                    onClick={() =>
                      selectStock(
                        stock
                      )
                    }
                    className="rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-xs text-cyan-300"
                  >

                    {stock.symbol}{" "}

                    {formatPercent(
                      stock.price_change
                    )}

                  </button>

                )
              )}

            </div>

          )}

        </section>


        {/* PREFERENCES */}

        {showPreferences && (

          <section className="mb-8 rounded-2xl border border-white/10 bg-[#0c1015] p-5">

            <div className="mb-5">

              <div className="text-xs uppercase tracking-[0.2em] text-cyan-400">
                Personalization
              </div>


              <h2 className="mt-2 text-xl font-bold">
                What matters more to you?
              </h2>


              <p className="mt-1 text-xs text-slate-500">

                Preferences change ranking,
                not the underlying market signals.

              </p>

            </div>


            <div className="grid gap-6 md:grid-cols-3">

              <PreferenceSlider
                label="Price movement"
                value={
                  preferences.price
                }
                onChange={(value) =>
                  setPreferences({
                    ...preferences,
                    price: value,
                  })
                }
              />


              <PreferenceSlider
                label="Volume anomalies"
                value={
                  preferences.volume
                }
                onChange={(value) =>
                  setPreferences({
                    ...preferences,
                    volume: value,
                  })
                }
              />


              <PreferenceSlider
                label="Market context"
                value={
                  preferences.context
                }
                onChange={(value) =>
                  setPreferences({
                    ...preferences,
                    context: value,
                  })
                }
              />

            </div>

          </section>

        )}


        {/* MAIN CONTENT */}

        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">


          {/* LEFT */}

          <div>

            <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">

              <div>

                <h2 className="text-2xl font-bold">
                  What deserves attention
                </h2>


                <p className="mt-1 text-xs text-slate-500">
                  Ranked by personalized significance
                </p>

              </div>


              <div className="flex flex-wrap gap-2">

                <FilterButton
                  active={
                    filter === "ALL"
                  }
                  onClick={() =>
                    setFilter("ALL")
                  }
                >
                  All {stocks.length}
                </FilterButton>


                <FilterButton
                  active={
                    filter === "HIGH"
                  }
                  onClick={() =>
                    setFilter("HIGH")
                  }
                >
                  High {highCount}
                </FilterButton>


                <FilterButton
                  active={
                    filter === "MEDIUM"
                  }
                  onClick={() =>
                    setFilter("MEDIUM")
                  }
                >
                  Medium {mediumCount}
                </FilterButton>


                <FilterButton
                  active={
                    filter === "QUIET"
                  }
                  onClick={() =>
                    setFilter("QUIET")
                  }
                >
                  Quiet {quietCount}
                </FilterButton>

              </div>

            </div>


            {/* SEARCH + ADD */}

            <div className="mb-5 grid gap-2 sm:grid-cols-[1fr_110px_180px_auto]">

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search stocks..."
                className="rounded-xl border border-white/10 bg-[#0c1015] px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
              />


              <input
                value={addSymbol}
                onChange={(event) =>
                  setAddSymbol(
                    event.target.value
                  )
                }
                placeholder="Symbol"
                className="rounded-xl border border-white/10 bg-[#0c1015] px-4 py-3 text-sm uppercase outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
              />


              <input
                value={addName}
                onChange={(event) =>
                  setAddName(
                    event.target.value
                  )
                }
                placeholder="Company name"
                className="rounded-xl border border-white/10 bg-[#0c1015] px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
              />


              <button
                type="button"
                onClick={
                  addStock
                }
                disabled={adding}
                className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-black hover:bg-cyan-300 disabled:opacity-50"
              >
                {adding
                  ? "..."
                  : "+ Add"}
              </button>

            </div>


            {/* STOCK CARDS */}

            <div className="space-y-3">

              {visibleStocks.map(
                (stock) => {

                  const score =
                    personalizedScore(
                      stock
                    );


                  const isSelected =
                    selected?.symbol ===
                    stock.symbol;


                  return (

                    <div
                      key={
                        stock.symbol
                      }
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        selectStock(
                          stock
                        )
                      }
                      onKeyDown={(
                        event
                      ) => {

                        if (
                          event.key ===
                            "Enter" ||
                          event.key ===
                            " "
                        ) {

                          event.preventDefault();

                          selectStock(
                            stock
                          );
                        }
                      }}
                      className={`w-full cursor-pointer rounded-2xl border p-5 text-left transition ${
                        isSelected
                          ? "border-cyan-400/50 bg-[#0c151b]"
                          : "border-white/10 bg-[#0c1015] hover:border-white/20"
                      }`}
                    >

                      {/* HEADER */}

                      <div className="flex items-start justify-between gap-4">

                        <div className="flex items-center gap-3">

                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-sm font-bold">
                            {getInitials(
                              stock.symbol
                            )}
                          </div>


                          <div>

                            <div className="flex items-center gap-2">

                              <span className="font-bold">
                                {stock.symbol}
                              </span>


                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider ${
                                  stock.attention_level ===
                                  "HIGH"
                                    ? "bg-red-500/10 text-red-400"
                                    : stock.attention_level ===
                                      "MEDIUM"
                                    ? "bg-amber-500/10 text-amber-400"
                                    : "bg-white/5 text-slate-500"
                                }`}
                              >
                                {
                                  stock.attention_level
                                }
                              </span>

                            </div>


                            <div className="mt-1 text-xs text-slate-500">
                              {stock.name}
                            </div>

                          </div>

                        </div>


                        <div className="text-right">

                          <div className="font-bold">
                            {formatPrice(
                              stock.price
                            )}
                          </div>


                          <div
                            className={`text-xs font-semibold ${
                              stock.price_change >=
                              0
                                ? "text-emerald-400"
                                : "text-red-400"
                            }`}
                          >

                            {stock.price_change >=
                            0
                              ? "↑"
                              : "↓"}{" "}

                            {Math.abs(
                              stock.price_change
                            ).toFixed(
                              2
                            )}
                            %

                          </div>

                        </div>

                      </div>


                      {/* PRIMARY SIGNAL */}

                      {stock.signals.length >
                        0 && (

                        <div className="mt-4 rounded-xl border border-cyan-400/10 bg-cyan-400/[0.03] px-3 py-2">

                          <div className="text-xs font-semibold text-cyan-300">

                            {stock.signals[0]
                              ?.label}

                          </div>


                          <div className="mt-1 text-[10px] text-slate-500">

                            {stock.signals[0]
                              ?.description}

                          </div>

                        </div>

                      )}


                      {/* METRICS */}

                      <div className="mt-5 grid grid-cols-3 gap-4 border-t border-white/5 pt-4">

                        <Metric
                          label="Volume"
                          value={`${stock.volume_ratio.toFixed(
                            2
                          )}×`}
                        />


                        <Metric
                          label="Vs watchlist"
                          value={formatPercent(
                            stock.relative_to_market
                          )}
                          positive={
                            stock.relative_to_market >=
                            0
                          }
                        />


                        <Metric
                          label="Attention"
                          value={String(
                            score
                          )}
                        />

                      </div>


                      {/* EXTRA CONTEXT */}

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-600">

                        {stock.self_move_ratio !==
                          undefined && (

                          <span>
                            {stock.self_move_ratio.toFixed(
                              1
                            )}× typical move
                          </span>

                        )}


                        <span>
                          Sector{" "}
                          {formatPercent(
                            stock.relative_to_sector
                          )}
                        </span>

                      </div>


                      {/* SCORE BAR */}

                      <div className="mt-4 flex items-center">

                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">

                          <div
                            className={`h-full rounded-full ${
                              score >= 70
                                ? "bg-red-400"
                                : score >= 40
                                ? "bg-amber-400"
                                : "bg-slate-700"
                            }`}
                            style={{
                              width: `${score}%`,
                            }}
                          />

                        </div>


                        <button
                          type="button"
                          onClick={(
                            event
                          ) => {

                            event.stopPropagation();

                            removeStock(
                              stock.symbol
                            );

                          }}
                          className="ml-4 text-[10px] text-slate-600 hover:text-red-400"
                        >
                          Remove
                        </button>

                      </div>


                      {/* DATA SOURCE */}

                      <div className="mt-3 flex items-center justify-between">

                        <span
                          className={`rounded-full px-2 py-1 text-[9px] font-bold ${
                            stock.data_source ===
                            "real"
                              ? "bg-emerald-400/10 text-emerald-400"
                              : "bg-amber-400/10 text-amber-400"
                          }`}
                        >

                          {stock.data_source ===
                          "real"
                            ? "● REAL DATA"
                            : "● FALLBACK DATA"}

                        </span>


                        <span className="text-[9px] text-slate-700">

                          {stock.provider}

                        </span>

                      </div>

                    </div>
                  );
                }
              )}


              {!visibleStocks.length && (

                <div className="rounded-2xl border border-white/10 bg-[#0c1015] p-10 text-center text-sm text-slate-500">

                  No stocks match this filter.

                </div>

              )}

            </div>

          </div>


          {/* RIGHT / EVIDENCE */}

          <aside
            ref={evidenceRef}
            className="scroll-mt-24 lg:sticky lg:top-24 lg:h-fit"
          >

            {selected && (

              <EvidencePanel
                stock={selected}
                range={range}
                setRange={setRange}
                expandedSignal={
                  expandedSignal
                }
                setExpandedSignal={
                  setExpandedSignal
                }
              />

            )}

          </aside>

        </section>


        {/* FOOTER */}

        <footer className="mt-10 border-t border-white/5 pb-10 pt-6">

          <div className="flex flex-col justify-between gap-3 text-[10px] text-slate-600 sm:flex-row">

            <span>
              NOTICED surfaces attention signals
              from observed market behaviour.
            </span>

            <span>
              Not investment advice.
            </span>

          </div>

        </footer>

      </div>

    </main>
  );
}


// =========================================================
// STAT CARD
// =========================================================

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {

  return (

    <div className="rounded-2xl border border-white/10 bg-[#0c1015] p-5">

      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-600">
        {label}
      </div>


      <div className="mt-3 text-4xl font-black">
        {value}
      </div>


      <div className="mt-1 text-xs text-slate-600">
        {description}
      </div>

    </div>
  );
}


// =========================================================
// FILTER BUTTON
// =========================================================

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {

  return (

    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
        active
          ? "bg-cyan-400 text-black"
          : "border border-white/10 text-slate-400 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}


// =========================================================
// METRIC
// =========================================================

function Metric({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {

  return (

    <div>

      <div className="text-[9px] uppercase tracking-[0.16em] text-slate-600">
        {label}
      </div>


      <div
        className={`mt-1 text-sm font-semibold ${
          positive === undefined
            ? "text-slate-300"
            : positive
            ? "text-emerald-400"
            : "text-red-400"
        }`}
      >
        {value}
      </div>

    </div>
  );
}


// =========================================================
// PREFERENCE SLIDER
// =========================================================

function PreferenceSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (
    value: number
  ) => void;
}) {

  return (

    <div>

      <div className="flex justify-between text-xs">

        <span className="text-slate-300">
          {label}
        </span>


        <span className="text-cyan-400">
          {value.toFixed(1)}×
        </span>

      </div>


      <input
        type="range"
        min="0.5"
        max="1.5"
        step="0.1"
        value={value}
        onChange={(event) =>
          onChange(
            Number(
              event.target.value
            )
          )
        }
        className="mt-3 w-full accent-cyan-400"
      />


      <div className="mt-1 flex justify-between text-[9px] text-slate-600">

        <span>
          Less
        </span>

        <span>
          More
        </span>

      </div>

    </div>
  );
}


// =========================================================
// EVIDENCE PANEL
// =========================================================

function EvidencePanel({
  stock,
  range,
  setRange,
  expandedSignal,
  setExpandedSignal,
}: {
  stock: Stock;
  range: ChartRange;
  setRange: (
    range: ChartRange
  ) => void;
  expandedSignal:
    | string
    | null;
  setExpandedSignal: (
    value: string | null
  ) => void;
}) {

  const meaningful =
    stock.attention_score >= 30;


  return (

    <div className="overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#0b1117]">


      {/* HEADER */}

      <div className="border-b border-white/10 p-6">

        <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-400">
          Evidence trail
        </div>


        <div className="mt-3 flex items-start justify-between gap-4">

          <div>

            <h2 className="text-3xl font-black">
              {stock.symbol}
            </h2>


            <p className="mt-1 text-xs text-slate-500">

              {stock.name}

              {stock.sector
                ? ` · ${stock.sector}`
                : ""}

            </p>

          </div>


          <div className="text-right">

            <div className="text-3xl font-black">
              {stock.attention_score}
            </div>


            <div className="text-[9px] uppercase tracking-widest text-slate-600">
              attention
            </div>

          </div>

        </div>


        {/* DATA SOURCE */}

        <div className="mt-5 flex flex-wrap items-center gap-2">

          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
              stock.data_source ===
              "real"
                ? "bg-emerald-400/10 text-emerald-400"
                : "bg-amber-400/10 text-amber-400"
            }`}
          >

            {stock.data_source ===
            "real"
              ? "● REAL MARKET DATA"
              : "● FALLBACK DATA"}

          </span>


          <span className="text-[10px] text-slate-600">
            {stock.provider}
          </span>

        </div>


        <div className="mt-2 text-[10px] text-slate-600">

          Daily data through{" "}

          {stock.data_as_of ||
            "latest available session"}

        </div>

      </div>


      {/* PRICE + CHART */}

      <div className="p-6">

        <div className="flex justify-between gap-4">

          <div>

            <div className="text-[10px] uppercase tracking-widest text-slate-600">
              Price movement
            </div>


            <div className="mt-2 text-xl font-black">
              {formatPrice(
                stock.price
              )}
            </div>

          </div>


          <div
            className={`text-sm font-bold ${
              stock.price_change >=
              0
                ? "text-emerald-400"
                : "text-red-400"
            }`}
          >

            {formatPercent(
              stock.price_change
            )}

            <div className="text-right text-[9px] font-normal text-slate-600">
              latest session
            </div>

          </div>

        </div>


        {/* CHART */}

        <div className="mt-5 rounded-xl border border-white/10 bg-[#0e141b] p-4">

          <MiniChart
            history={
              stock.history
            }
            range={range}
          />

        </div>


        {/* RANGE */}

        <div className="mt-3 flex gap-2">

          {(
            [
              "1D",
              "1W",
              "1M",
            ] as ChartRange[]
          ).map(
            (item) => (

              <button
                key={item}
                type="button"
                onClick={() =>
                  setRange(
                    item
                  )
                }
                className={`rounded-lg px-3 py-1.5 text-[10px] font-bold ${
                  range === item
                    ? "bg-white text-black"
                    : "text-slate-600 hover:text-slate-300"
                }`}
              >
                {item}
              </button>

            )
          )}

        </div>

      </div>


      {/* WHY FLAGGED */}

      <div className="border-t border-white/10 p-6">

        <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-400">
          Why was this flagged?
        </div>


        <h3 className="mt-3 text-lg font-bold">

          {meaningful
            ? "Meaningful behaviour detected."
            : "Nothing meaningful detected."}

        </h3>


        {stock.signals.length >
        0 ? (

          <div className="mt-5 space-y-2">

            {stock.signals.map(
              (signal) => {

                const expanded =
                  expandedSignal ===
                  signal.type;


                return (

                  <div
                    key={
                      signal.type
                    }
                    className="rounded-xl border border-white/10 bg-white/[0.02]"
                  >

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSignal(
                          expanded
                            ? null
                            : signal.type
                        )
                      }
                      className="flex w-full items-center justify-between gap-4 p-4 text-left"
                    >

                      <div className="flex items-start gap-3">

                        <span className="mt-0.5 text-cyan-400">
                          ✓
                        </span>


                        <div>

                          <div className="text-sm font-medium">

                            {
                              signal.label
                            }

                          </div>


                          <div className="mt-1 text-xs text-slate-500">

                            {
                              signal.description
                            }

                          </div>

                        </div>

                      </div>


                      <span className="text-slate-600">

                        {expanded
                          ? "−"
                          : "+"}

                      </span>

                    </button>


                    {expanded && (

                      <div className="border-t border-white/5 px-4 pb-4 pt-3 text-xs leading-6 text-slate-500">

                        <strong className="text-slate-300">
                          Evidence:
                        </strong>{" "}

                        {getEvidenceExplanation(
                          signal,
                          stock
                        )}

                      </div>

                    )}

                  </div>

                );
              }
            )}

          </div>

        ) : (

          /* WHY NOT FLAGGED */

          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">

            <div className="space-y-3 text-xs text-slate-500">

              <div>
                ✓ Price movement is within
                the meaningfulness threshold.
              </div>


              <div>
                ✓ Trading volume is{" "}
                {stock.volume_ratio.toFixed(
                  2
                )}
                × normal.
              </div>


              <div>
                ✓ Watchlist-relative movement is{" "}
                {formatPercent(
                  stock.relative_to_market
                )}
                .
              </div>


              <div>
                ✓ Sector-relative movement is{" "}
                {formatPercent(
                  stock.relative_to_sector
                )}
                .
              </div>

            </div>


            <div className="mt-5 border-t border-white/5 pt-4">

              <div className="text-xs font-bold text-slate-300">
                NOTICED kept this stock quiet.
              </div>


              <p className="mt-2 text-xs leading-5 text-slate-600">

                The absence of an alert is intentional.
                NOTICED is designed to reduce monitoring
                noise rather than surface every movement.

              </p>

            </div>

          </div>

        )}

      </div>


      {/* MARKET CONTEXT */}

      <div className="border-t border-white/10 p-6">

        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-600">
          Market context
        </div>


        <div className="mt-4 grid grid-cols-2 gap-4">

          <div>

            <div className="text-[10px] text-slate-600">
              Watchlist relative
            </div>


            <div
              className={`mt-1 font-bold ${
                stock.relative_to_market >=
                0
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
            >

              {formatPercent(
                stock.relative_to_market
              )}

            </div>

          </div>


          <div>

            <div className="text-[10px] text-slate-600">
              Sector relative
            </div>


            <div
              className={`mt-1 font-bold ${
                stock.relative_to_sector >=
                0
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
            >

              {formatPercent(
                stock.relative_to_sector
              )}

            </div>

          </div>

        </div>


        {/* SELF RELATIVE */}

        {stock.self_move_ratio !==
          undefined && (

          <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] p-4">

            <div className="text-[10px] uppercase tracking-wider text-slate-600">
              Self-relative behaviour
            </div>


            <div className="mt-2 text-xl font-black">

              {stock.self_move_ratio.toFixed(
                1
              )}
              ×

            </div>


            <div className="mt-1 text-xs text-slate-500">

              today&apos;s movement vs the stock&apos;s
              recent typical movement

            </div>

          </div>

        )}

      </div>


      {/* DISCLAIMER */}

      <div className="border-t border-white/10 bg-black/10 p-5 text-[10px] leading-5 text-slate-600">

        Market information is provided for
        informational purposes. NOTICED detects
        unusual market behaviour and does not
        provide investment recommendations.

      </div>

    </div>
  );
}


// =========================================================
// EVIDENCE EXPLANATIONS
// =========================================================

function getEvidenceExplanation(
  signal: Signal,
  stock: Stock
) {

  switch (
    signal.type
  ) {

    case "SELF_RELATIVE_ANOMALY":

      return (
        `Today's movement is ${stock.self_move_ratio?.toFixed(
          1
        )}× the stock's recent typical daily movement. This makes the change unusual relative to the stock's own behaviour.`
      );


    case "PRICE_ANOMALY":

      return (
        `The latest session moved ${Math.abs(
          stock.price_change
        ).toFixed(
          2
        )}% from the previous close, crossing NOTICED's price-movement threshold.`
      );


    case "VOLUME_ANOMALY":

      return (
        `Trading volume reached ${stock.volume_ratio.toFixed(
          2
        )}× the recent average volume, indicating unusually high activity.`
      );


    case "WATCHLIST_DIVERGENCE":

      return (
        `The stock moved ${formatPercent(
          stock.relative_to_market
        )} relative to the average movement of the current watchlist.`
      );


    case "MARKET_DIVERGENCE":

      return (
        `The stock moved differently from the other stocks being monitored. NOTICED uses this contextual difference when ranking attention.`
      );


    case "SECTOR_DIVERGENCE":

      return (
        `The stock's movement differs materially from the other stocks assigned to the same sector.`
      );


    case "SIGNAL_CONJUNCTION":

      return (
        `Price movement and trading activity became unusual at the same time. NOTICED gives this combination additional importance because multiple independent signals agree.`
      );


    default:

      return signal.description;
  }
}