import pandas as pd

def analyze_dataframe(df: pd.DataFrame) -> dict:
    summary = {}

    # Basic stats
    summary["total_rows"] = len(df)
    summary["columns"] = list(df.columns)

    # Detect numeric columns
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    summary["numeric_columns"] = numeric_cols

    # Stats for numeric columns
    stats = {}
    for col in numeric_cols:
        stats[col] = {
            "sum":   round(float(df[col].sum()), 2),
            "mean":  round(float(df[col].mean()), 2),
            "max":   round(float(df[col].max()), 2),
            "min":   round(float(df[col].min()), 2),
        }
    summary["stats"] = stats

    # Detect date column
    for col in df.columns:
        if "date" in col.lower() or "time" in col.lower():
            try:
                df[col] = pd.to_datetime(df[col])
                summary["date_column"] = col
                summary["date_range"] = {
                    "start": str(df[col].min()),
                    "end":   str(df[col].max()),
                }
            except:
                pass

    # Top product if product/item column exists
    for col in df.columns:
        if any(k in col.lower() for k in ["product", "item", "name", "category"]):
            top = df.groupby(col)[numeric_cols[0]].sum().idxmax() if numeric_cols else None
            summary["top_product"] = {"column": col, "value": str(top)}
            break

    return summary

