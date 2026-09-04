from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.stock import Stock

router = APIRouter(
    prefix="/watchlist",
    tags=["Watchlist"],
)


@router.get("/")
def get_watchlist(db: Session = Depends(get_db)):
    stocks = db.query(Stock).all()

    return [
        {
            "id": stock.id,
            "symbol": stock.symbol,
            "name": stock.name,
            "sector": stock.sector,
        }
        for stock in stocks
    ]


@router.post("/")
def add_stock(
    symbol: str,
    name: str,
    sector: str = None,
    db: Session = Depends(get_db),
):
    symbol = symbol.upper().strip()

    existing = (
        db.query(Stock)
        .filter(Stock.symbol == symbol)
        .first()
    )

    if existing:
        return {
            "message": "Stock already in watchlist",
            "stock": {
                "id": existing.id,
                "symbol": existing.symbol,
                "name": existing.name,
                "sector": existing.sector,
            },
        }

    stock = Stock(
        symbol=symbol,
        name=name.strip(),
        sector=sector.strip() if sector else None,
    )

    db.add(stock)
    db.commit()
    db.refresh(stock)

    return {
        "message": "Stock added",
        "stock": {
            "id": stock.id,
            "symbol": stock.symbol,
            "name": stock.name,
            "sector": stock.sector,
        },
    }


@router.delete("/{symbol}")
def remove_stock(
    symbol: str,
    db: Session = Depends(get_db),
):
    stock = (
        db.query(Stock)
        .filter(Stock.symbol == symbol.upper())
        .first()
    )

    if not stock:
        raise HTTPException(
            status_code=404,
            detail="Stock not found",
        )

    db.delete(stock)
    db.commit()

    return {
        "message": f"{symbol.upper()} removed from watchlist"
    }