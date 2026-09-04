import math
import time
from statistics import mean

import yfinance as yf


CACHE_TTL_SECONDS = 600

_market_cache = {}


YAHOO_SYMBOLS = {
    "INFY": "INFY.NS",
    "TCS": "TCS.NS",
    "RELIANCE": "RELIANCE.NS",
    "HDFCBANK": "HDFCBANK.NS",
    "ITC": "ITC.NS",
}


DEMO_MARKET_DATA = {
    "INFY": {
        "price": 1128.00,
        "history": [
            1158.00, 1148.50, 1162.00, 1154.00, 1142.00,
            1138.00, 1145.00, 1132.00, 1139.20, 1128.00,
        ],
    },
    "TCS": {
        "price": 3920.50,
        "history": [
            3890.00, 3905.00, 3888.00, 3912.00, 3900.00,
            3918.00, 3930.00, 3910.00, 3895.50, 3920.50,
        ],
    },
    "RELIANCE": {
        "price": 2890.20,
        "history": [
            2925.20, 2915.20, 2930.20, 2905.20, 2918.20,
            2898.20, 2910.20, 2895.20, 2902.20, 2890.20,
        ],
    },
    "HDFCBANK": {
        "price": 1765.30,
        "history": [
            1815.00, 1802.00, 1795.00, 1788.00, 1805.00,
            1790.00, 1780.00, 1775.00, 1772.30, 1765.30,
        ],
    },
    "ITC": {
        "price": 410.00,
        "history": [
            414.00, 412.50, 415.00, 413.20, 411.80,
            412.40, 410.90, 411.50, 409.80, 410.00,
        ],
    },
}


def _finite_number(value, default=0.0):
    """
    Convert a value to a safe finite float.

    Prevents NaN and infinity from reaching FastAPI JSON responses.
    """
    try:
        number = float(value)

        if not math.isfinite(number):
            return default

        return number

    except (TypeError, ValueError):
        return default


def _demo_data(symbol: str):
    data = DEMO_MARKET_DATA.get(symbol)

    if not data:
        return None

    prices = data["history"]

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
        safe_price = _finite_number(price)

        history.append(
            {
                "date": f"Fallback {i + 1}",
                "close": round(safe_price, 2),
                "volume": _finite_number(volumes[i]),
            }
        )

    current_price = history[-1]["close"]
    previous_price = history[-2]["close"]

    if previous_price != 0:
        price_change = (
            (current_price - previous_price)
            / previous_price
        ) * 100
    else:
        price_change = 0.0

    average_volume = mean(
        row["volume"]
        for row in history[:-1]
        if row["volume"] > 0
    )

    if average_volume > 0:
        volume_ratio = (
            history[-1]["volume"]
            / average_volume
        )
    else:
        volume_ratio = 0.0

    return {
        "price": round(_finite_number(current_price), 2),
        "previous_price": round(
            _finite_number(previous_price),
            2,
        ),
        "price_change": round(
            _finite_number(price_change),
            2,
        ),
        "volume": _finite_number(
            history[-1]["volume"]
        ),
        "average_volume": round(
            _finite_number(average_volume),
            2,
        ),
        "volume_ratio": round(
            _finite_number(volume_ratio),
            2,
        ),
        "history": history,
        "data_source": "fallback",
        "provider": "Cached fallback",
        "data_as_of": "Fallback dataset",
    }


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
            f"[Yahoo Finance] No data for {yahoo_symbol}"
        )
        return None

    rows = []

    for index, row in df.iterrows():

        try:
            close = _finite_number(row["Close"], None)
            volume = _finite_number(row["Volume"], None)

            # Reject invalid Yahoo rows.
            if close is None or volume is None:
                print(
                    f"[Yahoo Finance] Skipping invalid row "
                    f"for {symbol}"
                )
                continue

            if close <= 0:
                continue

            if volume < 0:
                volume = 0.0

            rows.append(
                {
                    "date": index.strftime("%Y-%m-%d"),
                    "close": round(close, 2),
                    "volume": volume,
                }
            )

        except (
            KeyError,
            TypeError,
            ValueError,
        ):
            continue

    if len(rows) < 2:
        print(
            f"[Yahoo Finance] Not enough valid data "
            f"for {yahoo_symbol}"
        )
        return None

    current = rows[-1]
    previous = rows[-2]

    current_price = _finite_number(
        current["close"]
    )

    previous_price = _finite_number(
        previous["close"]
    )

    if previous_price != 0:
        price_change = (
            (current_price - previous_price)
            / previous_price
        ) * 100
    else:
        price_change = 0.0

    historical_volumes = [
        _finite_number(row["volume"])
        for row in rows[:-1]
        if _finite_number(row["volume"]) > 0
    ]

    if historical_volumes:
        average_volume = mean(
            historical_volumes[-20:]
        )
    else:
        average_volume = 1.0

    if average_volume > 0:
        volume_ratio = (
            current["volume"]
            / average_volume
        )
    else:
        volume_ratio = 0.0

    # Final safety checks.
    price_change = _finite_number(price_change)
    average_volume = _finite_number(
        average_volume,
        1.0,
    )
    volume_ratio = _finite_number(
        volume_ratio
    )

    # Make absolutely sure history contains
    # only JSON-safe numbers.
    safe_history = []

    for row in rows[-100:]:
        safe_history.append(
            {
                "date": row["date"],
                "close": round(
                    _finite_number(row["close"]),
                    2,
                ),
                "volume": _finite_number(
                    row["volume"]
                ),
            }
        )

    return {
        "price": round(
            _finite_number(current_price),
            2,
        ),
        "previous_price": round(
            _finite_number(previous_price),
            2,
        ),
        "price_change": round(
            price_change,
            2,
        ),
        "volume": _finite_number(
            current["volume"]
        ),
        "average_volume": round(
            average_volume,
            2,
        ),
        "volume_ratio": round(
            volume_ratio,
            2,
        ),
        "history": safe_history,
        "data_source": "real",
        "provider": "Yahoo Finance",
        "data_as_of": current["date"],
    }


def get_market_data(symbol: str):
    symbol = symbol.upper().strip()

    cached = _market_cache.get(symbol)

    if cached:
        cached_data, cached_time = cached

        if (
            time.time() - cached_time
            < CACHE_TTL_SECONDS
        ):
            print(
                f"[Market Cache] Using cached data "
                f"for {symbol}"
            )
            return cached_data

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

    if cached:
        print(
            f"[Market Cache] Yahoo unavailable. "
            f"Using older data for {symbol}"
        )

        return cached[0]

    print(
        f"[Market] Using fallback dataset "
        f"for {symbol}"
    )

    return _demo_data(symbol)