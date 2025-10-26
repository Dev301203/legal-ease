from fastapi import APIRouter

router = APIRouter()


@router.get("/health-check")
def health_check() -> dict[str, str]:
    """
    Health check endpoint for monitoring and load balancers.
    Returns a simple OK status to indicate the service is running.
    """
    return {"status": "ok"}
