from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database.database import get_db
from app.models.stock import Stock


router = APIRouter(
    prefix="/watchlist",
    tags=["Watchlist"],
)


@router.get("/")
def get_watchlist(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user_id = current_user["id"]

    stocks = (
        db.query(Stock)
        .filter(Stock.user_id == user_id)
        .order_by(Stock.created_at.asc())
        .all()
    )

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
    current_user=Depends(get_current_user),
):
    user_id = current_user["id"]

    symbol = symbol.upper().strip()
    name = name.strip()

    if not symbol or not name:
        raise HTTPException(
            status_code=400,
            detail="Symbol and name are required",
        )

    existing = (
        db.query(Stock)
        .filter(
            Stock.user_id == user_id,
            Stock.symbol == symbol,
        )
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
        user_id=user_id,
        symbol=symbol,
        name=name,
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
    current_user=Depends(get_current_user),
):
    user_id = current_user["id"]
    symbol = symbol.upper().strip()

    stock = (
        db.query(Stock)
        .filter(
            Stock.user_id == user_id,
            Stock.symbol == symbol,
        )
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
        "message": f"{symbol} removed from watchlist"
    }