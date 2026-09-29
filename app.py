import os
import json
import numpy as np
import pandas as pd
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
import tensorflow as tf

# Initialize FastAPI App
app = FastAPI(
    title="Vehicle Mileage & Fuel Efficiency Prediction Service",
    description="Professional vehicle mileage estimation engine powered by TensorFlow Deep Learning",
    version="2.0.0"
)

DATA_PATH = "auto-mpg.csv"
MODEL_PATH = os.path.join("outputs", "fuel_efficiency_model.keras")

df_clean = None
preset_cars = []
dataset_stats = {}

try:
    if os.path.exists(DATA_PATH):
        df = pd.read_csv(DATA_PATH)
        df = df[df['horsepower'] != '?']
        df['horsepower'] = df['horsepower'].astype(int)
        df_clean = df

        dedup_cars = df.drop_duplicates(subset=['car name']).sort_values('car name')
        preset_cars = dedup_cars[['car name', 'cylinders', 'horsepower', 'weight', 'acceleration', 'model year', 'origin', 'mpg']].to_dict(orient='records')

        avg_mpg = float(df['mpg'].mean())
        dataset_stats = {
            "total_vehicles": len(df),
            "unique_models": df['car name'].nunique(),
            "avg_mpg": round(avg_mpg, 2),
            "avg_kml": round(avg_mpg * 0.425144, 2),
            "min_mpg": round(float(df['mpg'].min()), 2),
            "max_mpg": round(float(df['mpg'].max()), 2),
            "cylinders_distribution": df['cylinders'].value_counts().to_dict(),
            "origin_avg_kml": {
                "USA": round(float(df[df['origin'] == 1]['mpg'].mean()) * 0.425144, 2),
                "Europe": round(float(df[df['origin'] == 2]['mpg'].mean()) * 0.425144, 2),
                "Japan": round(float(df[df['origin'] == 3]['mpg'].mean()) * 0.425144, 2)
            }
        }
except Exception as e:
    print(f"Warning loading dataset: {e}")

# Load TensorFlow Model
model = None
try:
    if os.path.exists(MODEL_PATH):
        model = tf.keras.models.load_model(MODEL_PATH)
        print("TensorFlow model loaded successfully.")
    else:
        print(f"Warning: Model file not found at {MODEL_PATH}")
except Exception as e:
    print(f"Error loading model: {e}")

# Input Schema
class CarSpecs(BaseModel):
    cylinders: int = Field(..., ge=3, le=8, description="Number of engine cylinders (3, 4, 5, 6, 8)")
    horsepower: float = Field(..., ge=30, le=400, description="Engine Horsepower")
    weight: float = Field(..., ge=800, le=6000, description="Vehicle Weight in lbs")
    acceleration: float = Field(..., ge=4.0, le=30.0, description="0 to 100 km/h acceleration time in seconds")
    model_year: int = Field(..., ge=1970, le=2026, description="Model Year (1970 to 2026)")
    origin: int = Field(..., ge=1, le=3, description="Origin: 1 (USA), 2 (Europe), 3 (Japan / Asia)")
    fuel_type: str = Field("petrol", description="Fuel Type: 'petrol' or 'diesel'")
    ethanol_blend: str = Field("E10", description="Ethanol blend for petrol: 'E0', 'E10', or 'E20'")
    annual_distance_km: Optional[float] = Field(15000, ge=500, le=200000, description="Estimated annual driving distance in km")
    fuel_price_inr: Optional[float] = Field(102.50, ge=50.0, le=300.0, description="Fuel price per Liter in INR (Rupees)")

def calculate_grade(kml: float) -> dict:
    if kml >= 16.0:
        return {"grade": "A+", "label": "Exceptional Efficiency", "color": "#FFFFFF"}
    elif kml >= 12.5:
        return {"grade": "A", "label": "High Efficiency", "color": "#E2E8F0"}
    elif kml >= 9.5:
        return {"grade": "B", "label": "Moderate Efficiency", "color": "#CBD5E1"}
    elif kml >= 7.0:
        return {"grade": "C", "label": "Standard Efficiency", "color": "#94A3B8"}
    else:
        return {"grade": "D", "label": "High Consumption", "color": "#64748B"}

@app.get("/api/cars")
def get_preset_cars():
    """Returns list of preset vehicle specifications."""
    return {"cars": preset_cars, "count": len(preset_cars)}

@app.get("/api/stats")
def get_stats():
    """Returns aggregate statistical metrics in km/L and standard units."""
    return dataset_stats

@app.post("/api/predict")
def predict_mileage(specs: CarSpecs):
    """Predicts vehicle fuel mileage in km/L and MPG with fuel & ethanol blending adjustments."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded on server.")

    # Convert full year (1970-2026) to dataset scale (70 to 82+)
    if specs.model_year <= 1982:
        model_year_feat = float(specs.model_year - 1900)
    else:
        # Cap baseline feature at 82 and calculate modern efficiency technology multiplier
        model_year_feat = 82.0

    input_features = np.array([[
        float(specs.cylinders),
        float(specs.horsepower),
        float(specs.weight),
        float(specs.acceleration),
        float(model_year_feat),
        float(specs.origin)
    ]], dtype=np.float32)

    try:
        raw_prediction = model.predict(input_features, verbose=0)
        base_mpg = float(raw_prediction[0][0])
        base_mpg = max(6.0, base_mpg)

        # 1. Year Technological Improvement Adjustment for modern vehicles (1983-2026)
        if specs.model_year > 1982:
            years_past = specs.model_year - 1982
            # Modern EFI, variable valve timing, aerodynamics (+0.6% per year improvement capped)
            tech_multiplier = 1.0 + min(0.35, years_past * 0.007)
            base_mpg *= tech_multiplier

        # 2. Fuel Type Adjustment:
        # Diesel engines have higher compression ratio and higher energy density per liter (~ +18%)
        fuel_multiplier = 1.0
        if specs.fuel_type.lower() == "diesel":
            fuel_multiplier = 1.20

        # 3. Ethanol Blend Adjustment (for Petrol):
        # E0: pure petrol (100% baseline energy)
        # E10: 10% ethanol (~97.5% energy content)
        # E20: 20% ethanol (~95.0% energy content)
        ethanol_multiplier = 1.0
        if specs.fuel_type.lower() == "petrol":
            if specs.ethanol_blend == "E0":
                ethanol_multiplier = 1.025
            elif specs.ethanol_blend == "E10":
                ethanol_multiplier = 1.000
            elif specs.ethanol_blend == "E20":
                ethanol_multiplier = 0.955

        final_mpg = round(base_mpg * fuel_multiplier * ethanol_multiplier, 2)
        final_kml = round(final_mpg * 0.425144, 2)
        liters_per_100km = round(100.0 / final_kml, 2) if final_kml > 0 else 0

        # Financial Calculations in Indian Rupees (INR ₹)
        annual_liters_consumed = round(specs.annual_distance_km / final_kml, 1)
        annual_fuel_cost_inr = round(annual_liters_consumed * specs.fuel_price_inr, 2)
        monthly_fuel_cost_inr = round(annual_fuel_cost_inr / 12, 2)
        cost_per_km_inr = round(specs.fuel_price_inr / final_kml, 2)

        # Efficiency Grade
        rating = calculate_grade(final_kml)

        # Comparison with baseline average
        baseline_kml = dataset_stats.get("avg_kml", 9.97)
        diff_from_avg = round(final_kml - baseline_kml, 2)
        diff_percentage = round((diff_from_avg / baseline_kml) * 100, 1)

        origin_names = {1: "USA", 2: "Europe", 3: "Japan / Asia"}

        return {
            "predicted_kml": final_kml,
            "predicted_mpg": final_mpg,
            "liters_per_100km": liters_per_100km,
            "rating": rating,
            "annual_fuel_cost_inr": annual_fuel_cost_inr,
            "monthly_fuel_cost_inr": monthly_fuel_cost_inr,
            "cost_per_km_inr": cost_per_km_inr,
            "annual_liters_consumed": annual_liters_consumed,
            "fuel_details": {
                "fuel_type": specs.fuel_type.capitalize(),
                "ethanol_blend": specs.ethanol_blend if specs.fuel_type.lower() == "petrol" else "N/A (Diesel)",
                "fuel_price_per_liter": specs.fuel_price_inr
            },
            "comparison": {
                "baseline_avg_kml": baseline_kml,
                "diff_from_avg": diff_from_avg,
                "diff_percentage": diff_percentage,
                "is_better_than_avg": final_kml >= baseline_kml
            },
            "input_specs": {
                "cylinders": specs.cylinders,
                "horsepower": specs.horsepower,
                "weight": specs.weight,
                "acceleration": specs.acceleration,
                "model_year": specs.model_year,
                "origin": origin_names.get(specs.origin, "Unknown")
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction calculation failed: {str(e)}")

# Mount static files
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def index():
    return FileResponse("static/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
