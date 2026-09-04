from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer

from app.database.database import Base


class MarketSnapshot(Base):
    __tablename__ = "market_snapshots"

    id = Column(Integer, primary_key=True, index=True)

    stock_id = Column(
        Integer,
        ForeignKey("stocks.id"),
        nullable=False,
        index=True,
    )

    price = Column(Float, nullable=False)

    volume = Column(Float, nullable=False)

    timestamp = Column(
        DateTime,
        default=datetime.utcnow,
        index=True,
    )