from fastapi import APIRouter

router = APIRouter()

@router.get("/insights")
def get_insights():
    return {"message": "Insights endpoint ready!"}