from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.discovery_run import DiscoveryRun
from app.schemas.device import DiscoveryRunResponse
from app.services.discovery.runner import run_discovery

router = APIRouter(prefix="/api/discovery", tags=["discovery"])


@router.post("/run", response_model=DiscoveryRunResponse)
def trigger_discovery(db: Session = Depends(get_db)):
    return run_discovery(db)


@router.get("/runs", response_model=list[DiscoveryRunResponse])
def list_discovery_runs(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return db.query(DiscoveryRun).order_by(DiscoveryRun.started_at.desc()).limit(limit).all()


@router.delete("/runs/clear")
def clear_discovery_runs(db: Session = Depends(get_db)):
    db.query(DiscoveryRun).delete()
    db.commit()
    return {"status": "ok", "message": "Histórico de descobertas removido com sucesso"}
