import time
from statistics import mean

import yfinance as yf


# ============================================================
# CACHE
# ============================================================

CACHE_TTL_SECONDS = 600  # 10 minutes

_market_cache = {}


# ============================================================
# SYMBOL MAPPING
# ============================================================

YAHOO_SYMBOLS = {
    "INFY": "INFY.NS",
    "TCS": "TCS.NS",
    "RELIANCE": "RELIANCE.NS",
    "HDFCBANK": "HDFCBANK.NS",
}


# ============================================================
# DEMO FALLBACK
# ============================================================

DEMO_MARKET_DATA = {
    "INFY": {
        "price": 1128.00,
        "history": [
            1158.00,
            1148.50,
            1162.00,
            1154.00,
            1142.00,
            1138.00,
            1145.00,
            1132.00,
            1139.20,
            1128.00,
        ],
    },

    "TCS": {
        "price": 3920.50,
        "history": [
            3890.00,
            3905.00,
            3888.00,
            3912.00,
            3900.00,
            3918.00,
            3930.00,
            3910.00,
            3895.50,
            3920.50,
        ],
    },

    "RELIANCE": {
        "price": 2890.20,
        "history": [
            2925.20,
            2915.20,
            2930.20,
            2905.20,
            2918.20,
            2898.20,
            2910.20,
            2895.20,
            2902.20,
            2890.20,
        ],
    },

    "HDFCBANK": {
        "price": 1765.30,
        "history": [
            1815.00,
            1802.00,
            1795.00,
            1788.00,
            1805.00,
            1790.00,
            1780.00,
            1775.00,
            1772.30,
            1765.30,
        ],
    },
}


def _demo_data(symbol: str):

    data = DEMO_MARKET_DATA.get(symbol)

    if not data:
        return None

    prices = data["history"]

    # Use realistic non-zero fallback volumes.
    volumes = [
        420000,
        510000,
        460000,
        580000,
        490000,
        620000,
        540000,
        470000,
        690000,
        820000,
    ]

    history = []

    for i, price in enumerate(prices):

        history.append({
            "date": f"Fallback {i + 1}",
            "close": round(price, 2),
            "volume": volumes[i],
        })

    current_price = prices[-1]
    previous_price = prices[-2]

    price_change = (
        ((current_price - previous_price) / previous_price)
        * 100
    )

    average_volume = mean(volumes[:-1])

    volume_ratio = (
        volumes[-1] / average_volume
        if average_volume
        else 0
    )

    return {
        "price": round(current_price, 2),
        "previous_price": round(previous_price, 2),
        "price_change": round(price_change, 2),

        "volume": volumes[-1],

        "average_volume": round(
            average_volume,
            2,
        ),

        "volume_ratio": round(
            volume_ratio,
            2,
        ),

        "history": history,

        "data_source": "fallback",

        "provider": "Cached fallback",

        "data_as_of": "Fallback dataset",
    }


# ============================================================
# YAHOO FINANCE
# ============================================================

def _fetch_yahoo_data(symbol: str):

    yahoo_symbol = YAHOO_SYMBOLS.get(
        symbol,
        f"{symbol}.NS",
    )

    print(
        f"[Yahoo Finance] Requesting {yahoo_symbol}"
    )

    ticker = yf.Ticker(yahoo_symbol)

    df = ticker.history(
        period="6mo",
        interval="1d",
        auto_adjust=False,
    )

    if df is None or df.empty:

        print(
            f"[Yahoo Finance] No data for "
            f"{yahoo_symbol}"
        )

        return None

    rows = []

    for index, row in df.iterrows():

        try:

            close = float(row["Close"])
            volume = float(row["Volume"])

            if close <= 0:
                continue

            rows.append({
                "date": index.strftime("%Y-%m-%d"),
                "close": round(close, 2),
                "volume": volume,
            })

        except (
            KeyError,
            TypeError,
            ValueError,
        ):
            continue

    if len(rows) < 2:

        return None

    current = rows[-1]
    previous = rows[-2]

    current_price = current["close"]
    previous_price = previous["close"]

    price_change = (
        (
            current_price - previous_price
        )
        / previous_price
    ) * 100

    historical_volumes = [
        row["volume"]
        for row in rows[:-1]
        if row["volume"] > 0
    ]

    average_volume = (
        mean(historical_volumes[-20:])
        if historical_volumes
        else 1
    )

    volume_ratio = (
        current["volume"]
        / average_volume
        if average_volume
        else 0
    )

    return {
        "price": round(current_price, 2),

        "previous_price": round(
            previous_price,
            2,
        ),

        "price_change": round(
            price_change,
            2,
        ),

        "volume": current["volume"],

        "average_volume": round(
            average_volume,
            2,
        ),

        "volume_ratio": round(
            volume_ratio,
            2,
        ),

        # Keep enough history for:
        # 1D / 1W / 1M charts
        "history": rows[-100:],

        "data_source": "real",

        "provider": "Yahoo Finance",

        "data_as_of": current["date"],
    }


# ============================================================
# PUBLIC MARKET DATA FUNCTION
# ============================================================

def get_market_data(symbol: str):

    symbol = symbol.upper().strip()

    # --------------------------------------------------------
    # CACHE
    # --------------------------------------------------------

    cached = _market_cache.get(symbol)

    if cached:

        cached_data, cached_time = cached

        if (
            time.time() - cached_time
            < CACHE_TTL_SECONDS
        ):

            print(
                f"[Market Cache] Using cached "
                f"data for {symbol}"
            )

            return cached_data

    # --------------------------------------------------------
    # YAHOO FINANCE
    # --------------------------------------------------------

    try:

        data = _fetch_yahoo_data(symbol)

        if data:

            print(
                f"[Yahoo Finance] SUCCESS: {symbol}"
            )

            _market_cache[symbol] = (
                data,
                time.time(),
            )

            return data

    except Exception as exc:

        print(
            "[Yahoo Finance] ERROR:",
            repr(exc),
        )

    # --------------------------------------------------------
    # CACHE FALLBACK
    # --------------------------------------------------------

    if cached:

        print(
            f"[Market Cache] Yahoo unavailable. "
            f"Using older data for {symbol}"
        )

        return cached[0]

    # --------------------------------------------------------
    # BUNDLED FALLBACK
    # --------------------------------------------------------

    print(
        f"[Market] Using fallback dataset "
        f"for {symbol}"
    )

    return _demo_data(symbol)