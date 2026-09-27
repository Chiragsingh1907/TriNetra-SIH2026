from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import logging
from nlp_engine import NLPEngine
from staging_db import StagingQueue
from graph_engine import GraphEngine
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="TriNetra Backend API", description="Air-gapped NLP & Knowledge Graph Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize singletons
try:
    nlp = NLPEngine(model_path="ai4bharat/indic-bert")
except Exception as e:
    logger.warning(f"Failed to initialize NLP engine. Please check local model paths. Error: {e}")
    nlp = None

staging_queue = StagingQueue()
graph_db = GraphEngine()

class FIRInput(BaseModel):
    text: str
    officer_id: str = "UNKNOWN"
    jurisdiction: str = "UNKNOWN"

from typing import List
from pydantic import BaseModel

class ExtractionResponse(BaseModel):
    case_summary: str
    identified_suspects: List[str] = []
    identified_plaintiffs: List[str] = []
    phone_anchors: List[str] = []
    financial_anchors: List[str] = []
    vehicle_anchors: List[str] = []

@app.post("/api/upload_fir", response_model=ExtractionResponse)
async def upload_fir(request: FIRInput):
    try:
        fir_text = request.text
        if not fir_text:
            raise HTTPException(status_code=400, detail="No text provided")
        
        # Call the robust extraction engine
        if not nlp:
            raise HTTPException(status_code=500, detail="NLP Engine offline.")
            
        extracted_data = nlp.process_fir_text(fir_text)
        return extracted_data
    except Exception as e:
        print(f"Extraction Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/staging")
async def get_staging_queue():
    """
    Deprecated: Bypassed by direct React state upload.
    """
    return {"pending_firs": []}

@app.get("/api/firs")
async def get_committed_firs():
    """
    Fetch all committed FIR IDs from Neo4j to display in the sidebar.
    """
    try:
        firs = []
        with graph_db.driver.session() as session:
            result = session.run("MATCH (c:Case) RETURN c.id as fir_id")
            for record in result:
                if record["fir_id"]:
                    firs.append(record["fir_id"])
        return {"firs": firs}
    except Exception as e:
        logger.error(f"Failed to fetch FIRs: {e}")
        return {"firs": []}

from schema import FIRCommitRequest

@app.post("/api/commit_fir")
async def commit_fir(payload: FIRCommitRequest):
    """
    Rule 2.3 & 3: Human Investigator explicitly commits verified data to Neo4j.
    """
    data = {
        "fir_id": payload.fir_id,
        "raw_text": payload.raw_text,
        "case_summary": payload.case_summary,
        "identified_plaintiffs": payload.identified_plaintiffs,
        "identified_suspects": payload.identified_suspects,
        "phone_anchors": payload.phone_anchors,
        "financial_anchors": payload.financial_anchors,
        "vehicle_anchors": payload.vehicle_anchors
    }
        
    try:
        graph_db.commit_verified_data(data)
        return {"status": "success", "message": "Verified data committed to Neo4j Knowledge Graph."}
    except Exception as e:
        logger.error(f"Graph commit failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics")
async def get_graph_analytics():
    """
    Rule 4: NetworkX Betweenness Centrality & Scikit-learn clustering to find the 'Hidden Boss'.
    """
    try:
        analytics = graph_db.generate_analytics()
        return analytics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/fir/{fir_id}")
async def delete_fir(fir_id: str):
    try:
        graph_db.delete_case(fir_id)
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to delete FIR {fir_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/cases/{case_id}")
async def get_case_details(case_id: str):
    query = """
    MATCH (c:Case {id: $case_id})
    OPTIONAL MATCH (victim:Person)-[:FILED_COMPLAINT]->(c)
    OPTIONAL MATCH (suspect:Person)-[:ACCUSED_IN]->(c)
    OPTIONAL MATCH (c)-[:LINKED_TO]->(ph:Phone)
    OPTIONAL MATCH (c)-[:LINKED_TO]->(ba:BankAccount)
    OPTIONAL MATCH (c)-[:LINKED_TO]->(v:Vehicle)
    RETURN c.id AS case_id, c.summary AS case_summary, c.raw_text AS raw_text,
           collect(DISTINCT victim.name) AS plaintiffs,
           collect(DISTINCT suspect.name) AS suspects,
           collect(DISTINCT ph.number) AS phones,
           collect(DISTINCT ba.details) AS financials,
           collect(DISTINCT v.plate) AS vehicles
    """
    try:
        with graph_db.driver.session() as session: # Replaced driver with graph_db.driver
            result = session.run(query, case_id=case_id)
            record = result.single()
            if not record or not record["case_id"]:
                raise HTTPException(status_code=404, detail="Case not found")
            return {
                "case_id": record["case_id"],
                "raw_text": record["raw_text"] or "Raw text not available.",
                "case_summary": record["case_summary"] or "",
                "identified_plaintiffs": [p for p in record["plaintiffs"] if p],
                "identified_suspects": [s for s in record["suspects"] if s],
                "phone_anchors": [ph for ph in record["phones"] if ph],
                "financial_anchors": [ba for ba in record["financials"] if ba],
                "vehicle_anchors": [v for v in record["vehicles"] if v]
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/clear_database")
async def clear_database():
    query = "MATCH (n) DETACH DELETE n"
    try:
        with graph_db.driver.session() as session:
            session.run(query)
        return {"status": "success", "message": "Knowledge Graph completely wiped."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
