from fastapi import APIRouter, UploadFile, File, HTTPException
import pandas as pd
import io
from services.analyzer import analyze_dataframe
from backend.services.ai_engine import generate_insights

router = APIRouter()

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith((".csv", ".xlsx")):
        raise HTTPException(status_code=400, detail="Only CSV or Excel files allowed")

    contents = await file.read()

    if file.filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(contents))
    else:
        df = pd.read_excel(io.BytesIO(contents))

    # Analyze the data
    summary = analyze_dataframe(df)

    # Generate AI insights
    insights = generate_insights(summary)

    return {
        "filename":  file.filename,
        "rows":      len(df),
        "columns":   list(df.columns),
        "preview":   df.head(5).to_dict(orient="records"),
        "summary":   summary,
        "insights":  insights
    }

