from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import logging

from ..services.data_service import DataService
from ..models.schemas import (
    TradingDaysResponse, TradingDayData, DaySummary, 
    APIResponse, AvailableFiltersResponse
)

logger = logging.getLogger(__name__)

router = APIRouter()
data_service = DataService()

@router.get("/trading-days", response_model=APIResponse)
async def get_trading_days():
    """Get all available trading days"""
    try:
        available_dates = data_service.get_available_trading_days()
        response_data = TradingDaysResponse(
            available_dates=available_dates,
            total_days=len(available_dates)
        )
        return APIResponse(
            success=True,
            data=response_data.dict(),
            message=f"Found {len(available_dates)} trading days"
        )
    except Exception as e:
        logger.error(f"Error getting trading days: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving trading days: {str(e)}")

@router.get("/data/{date}/filters", response_model=APIResponse)
async def get_day_filters(date: str):
    """Get available underlying/expiry filters for a given trading day"""
    try:
        filters = data_service.get_available_filters(date)
        if filters is None:
             raise HTTPException(status_code=404, detail=f"No data found for date: {date}")
        
        response_data = AvailableFiltersResponse(filters=filters)
        return APIResponse(
            success=True,
            data=response_data.dict(),
            message=f"Found {len(filters)} filter options for {date}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting filters for {date}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving filters for {date}: {str(e)}")

@router.get("/data/{date}", response_model=APIResponse)
async def get_trading_day_data(date: str, filters: Optional[List[str]] = Query(None)):
    """Get complete trading day data, with optional filtering"""
    try:
        from datetime import datetime
        try:
            datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        data = data_service.get_trading_day_data(date, filters)
        if data is None:
            raise HTTPException(status_code=404, detail=f"No data found for date: {date}")
        
        return APIResponse(
            success=True, data=data,
            message=f"Successfully retrieved data for {date}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting trading day data for {date}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving data for {date}: {str(e)}")

@router.get("/data/{date}/summary", response_model=APIResponse)
async def get_day_summary(date: str, filters: Optional[List[str]] = Query(None)):
    """Get summary data for a trading day, with optional filtering"""
    try:
        from datetime import datetime
        try:
            datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        summary = data_service.get_day_summary_only(date, filters)
        if summary is None:
            raise HTTPException(status_code=404, detail=f"No data found for date: {date}")
        
        return APIResponse(
            success=True, data=summary.dict(),
            message=f"Successfully retrieved summary for {date}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting summary for {date}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving summary for {date}: {str(e)}")

@router.post("/refresh-cache")
async def refresh_cache():
    """Clear all cached data to force fresh reload"""
    try:
        data_service.clear_cache()
        return APIResponse(
            success=True,
            message="Cache cleared successfully",
            data={"cache_cleared": True}
        )
    except Exception as e:
        logger.error(f"Error clearing cache: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error clearing cache: {str(e)}")

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return APIResponse(
        success=True,
        message="Trading Dashboard API is running",
        data={
            "status": "healthy",
            "data_folder": str(data_service.data_folder),
            "available_days": len(data_service.get_available_trading_days())
        }
    )