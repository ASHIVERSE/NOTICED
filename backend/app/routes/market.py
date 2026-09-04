from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.stock import Stock
from app.models.market_snapshot import MarketSnapshot
from app.services.market_engine import get_market_data

router = APIRouter(prefix="/market", tags=["Market"])


@router.get("/{symbol}")
def get_stock_market_data(
    symbol: str,
    db: Session = Depends(get_db),
):
    symbol = symbol.upper().strip()

    stock = (
        db.query(Stock)
        .filter(Stock.symbol == symbol)
        .first()
    )

    if not stock:
        raise HTTPException(
            status_code=404,
            detail=f"{symbol} not found in watchlist",
        )

    data = get_market_data(symbol)

    if not data:
        raise HTTPException(
            status_code=404,
            detail=f"No market data available for {symbol}",
        )

    snapshot = MarketSnapshot(
        stock_id=stock.id,
        price=data["price"],
        volume=data["volume"],
    )

    db.add(snapshot)
    db.commit()

    return {
        "symbol": stock.symbol,
        "name": stock.name,
        "sector": stock.sector,
        **data,
    }