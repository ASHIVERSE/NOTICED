from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.stock import Stock
from app.services.market_engine import get_market_data

router = APIRouter(prefix="/attention", tags=["Attention"])


PRICE_ANOMALY_THRESHOLD = 1.25
VOLUME_ANOMALY_THRESHOLD = 1.15
RELATIVE_MOVE_THRESHOLD = 1.0
SELF_MOVE_RATIO_THRESHOLD = 1.5


def calculate_typical_move(history):
    """
    Estimate the stock's typical daily movement from recent history.
    This gives us a self-relative baseline instead of using one
    fixed percentage for every stock.
    """

    if not history or len(history) < 6:
        return 1.0

    moves = []

    for i in range(1, len(history)):
        previous = history[i - 1]["close"]
        current = history[i]["close"]

        if previous:
            move = abs((current - previous) / previous) * 100
            moves.append(move)

    if not moves:
        return 1.0

    recent_moves = moves[-20:]

    return max(
        sum(recent_moves) / len(recent_moves),
        0.25,
    )


def calculate_attention(stock, data, market_change, sector_change):

    signals = []
    score = 0

    price_change = data["price_change"]
    volume_ratio = data["volume_ratio"]

    typical_move = calculate_typical_move(data["history"])

    self_move_ratio = (
        abs(price_change) / typical_move
        if typical_move
        else 0
    )

    relative_to_market = price_change - market_change
    relative_to_sector = price_change - sector_change

    # ---------------------------------------------------------
    # 1. SELF-RELATIVE PRICE ANOMALY
    # ---------------------------------------------------------

    if self_move_ratio >= SELF_MOVE_RATIO_THRESHOLD:

        score += 30

        signals.append({
            "type": "SELF_RELATIVE_ANOMALY",
            "label": "Unusual for this stock",
            "description": (
                f"Today's {abs(price_change):.2f}% move is "
                f"{self_move_ratio:.1f}× the stock's recent "
                f"typical daily movement."
            ),
            "impact": 30,
        })

    # ---------------------------------------------------------
    # 2. ABSOLUTE PRICE MOVEMENT
    # ---------------------------------------------------------

    if abs(price_change) >= PRICE_ANOMALY_THRESHOLD:

        score += 25

        signals.append({
            "type": "PRICE_ANOMALY",
            "label": "Unusual price movement",
            "description": (
                f"{stock.symbol} moved {price_change:+.2f}% "
                "since the previous session."
            ),
            "impact": 25,
        })

    # ---------------------------------------------------------
    # 3. VOLUME ANOMALY
    # ---------------------------------------------------------

    if volume_ratio >= VOLUME_ANOMALY_THRESHOLD:

        score += 25

        signals.append({
            "type": "VOLUME_ANOMALY",
            "label": "Unusual trading volume",
            "description": (
                f"Trading volume is {volume_ratio:.2f}× "
                "the recent average."
            ),
            "impact": 25,
        })

    # ---------------------------------------------------------
    # 4. WATCHLIST RELATIVE MOVEMENT
    # ---------------------------------------------------------

    if abs(relative_to_market) >= RELATIVE_MOVE_THRESHOLD:

        score += 15

        signals.append({
            "type": "WATCHLIST_DIVERGENCE",
            "label": "Moved differently from watchlist",
            "description": (
                f"{stock.symbol} moved "
                f"{relative_to_market:+.2f}% relative "
                "to the watchlist."
            ),
            "impact": 15,
        })

    # ---------------------------------------------------------
    # 5. SECTOR RELATIVE MOVEMENT
    # ---------------------------------------------------------

    if abs(relative_to_sector) >= RELATIVE_MOVE_THRESHOLD:

        score += 15

        signals.append({
            "type": "SECTOR_DIVERGENCE",
            "label": "Moved differently from sector",
            "description": (
                f"{stock.symbol} moved "
                f"{relative_to_sector:+.2f}% relative "
                "to its sector peers."
            ),
            "impact": 15,
        })

    # ---------------------------------------------------------
    # 6. SIGNAL CONJUNCTION
    # ---------------------------------------------------------

    if (
        abs(price_change) >= PRICE_ANOMALY_THRESHOLD
        and volume_ratio >= VOLUME_ANOMALY_THRESHOLD
    ):

        score += 20

        signals.append({
            "type": "SIGNAL_CONJUNCTION",
            "label": "Price + volume changed together",
            "description": (
                "An unusual price move occurred together "
                "with unusually high trading volume."
            ),
            "impact": 20,
        })

    score = min(score, 100)

    if score >= 60:
        level = "HIGH"
    elif score >= 30:
        level = "MEDIUM"
    else:
        level = "LOW"

    return {
        "attention_score": score,
        "attention_level": level,
        "signals": signals,

        "typical_move": round(typical_move, 2),
        "self_move_ratio": round(self_move_ratio, 2),

        "relative_to_market": round(
            relative_to_market,
            2,
        ),

        "relative_to_sector": round(
            relative_to_sector,
            2,
        ),
    }


@router.get("/")
def get_attention_feed(
    db: Session = Depends(get_db),
):

    stocks = db.query(Stock).all()

    market_data = {}

    # ---------------------------------------------------------
    # Fetch market data
    # ---------------------------------------------------------

    for stock in stocks:

        data = get_market_data(stock.symbol)

        if data:
            market_data[stock.symbol] = data

    if not market_data:
        return {
            "count": 0,
            "feed": [],
        }

    # ---------------------------------------------------------
    # Watchlist baseline
    # ---------------------------------------------------------

    changes = [
        data["price_change"]
        for data in market_data.values()
    ]

    market_change = (
        sum(changes) / len(changes)
        if changes
        else 0
    )

    feed = []

    # ---------------------------------------------------------
    # Calculate attention for every stock
    # ---------------------------------------------------------

    for stock in stocks:

        data = market_data.get(stock.symbol)

        if not data:
            continue

        sector_changes = []

        for other_stock in stocks:

            if (
                other_stock.symbol != stock.symbol
                and other_stock.sector == stock.sector
                and other_stock.symbol in market_data
            ):

                sector_changes.append(
                    market_data[
                        other_stock.symbol
                    ]["price_change"]
                )

        sector_change = (
            sum(sector_changes) /
            len(sector_changes)
            if sector_changes
            else 0
        )

        attention = calculate_attention(
            stock,
            data,
            market_change,
            sector_change,
        )

        feed.append({

            "symbol": stock.symbol,
            "name": stock.name,
            "sector": stock.sector,

            "price": data["price"],
            "previous_price": data["previous_price"],
            "price_change": data["price_change"],

            "volume": data["volume"],
            "average_volume": data["average_volume"],
            "volume_ratio": data["volume_ratio"],

            "market_change": round(
                market_change,
                2,
            ),

            "relative_to_market":
                attention[
                    "relative_to_market"
                ],

            "sector_change": round(
                sector_change,
                2,
            ),

            "relative_to_sector":
                attention[
                    "relative_to_sector"
                ],

            "typical_move":
                attention[
                    "typical_move"
                ],

            "self_move_ratio":
                attention[
                    "self_move_ratio"
                ],

            "attention_score":
                attention[
                    "attention_score"
                ],

            "attention_level":
                attention[
                    "attention_level"
                ],

            "signals":
                attention[
                    "signals"
                ],

            "history":
                data[
                    "history"
                ],

            "data_source":
                data[
                    "data_source"
                ],

            "provider":
                data[
                    "provider"
                ],

            "data_as_of":
                data[
                    "data_as_of"
                ],
        })

    # Highest attention first
    feed.sort(
        key=lambda item:
            item["attention_score"],
        reverse=True,
    )

    return {
        "count": len(feed),
        "feed": feed,
    }