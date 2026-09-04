from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.database import Base, engine

from app.models.stock import Stock
from app.models.market_snapshot import MarketSnapshot

from app.routes.watchlist import router as watchlist_router
from app.routes.market import router as market_router
from app.routes.attention import router as attention_router


Base.metadata.create_all(
    bind=engine
)


app = FastAPI(
    title="NOTICED API",
    description=(
        "A market watchlist that learns "
        "what deserves your attention."
    ),
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


app.include_router(
    watchlist_router
)

app.include_router(
    market_router
)

app.include_router(
    attention_router
)


@app.get("/")
def root():

    return {
        "message": "NOTICED API is running",
        "status": "ok",
    }


@app.get("/health")
def health():

    return {
        "status": "healthy"
    }