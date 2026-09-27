import sqlite3
import json
import uuid
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class StagingQueue:
    """
    SQLite-based in-memory / local staging queue.
    Rule 2.2: FastAPI must place extractions into a staging queue and assign a staging_id.
    Rule 2.3: Data is only committed to Neo4j when investigator clicks "Commit".
    """
    def __init__(self, db_path="staging.db"):
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.cursor = self.conn.cursor()
        self._initialize_db()

    def _initialize_db(self):
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS fir_staging (
                staging_id TEXT PRIMARY KEY,
                raw_text TEXT,
                anchors TEXT,
                nlp_entities TEXT,
                relations TEXT,
                status TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        self.conn.commit()

    def add_to_queue(self, processed_data: Dict[str, Any]) -> str:
        staging_id = str(uuid.uuid4())
        
        raw_text = processed_data.get("raw_text", "")
        anchors = json.dumps(processed_data.get("deterministic_anchors", {}))
        nlp_entities = json.dumps(processed_data.get("nlp_entities", []))
        relations = json.dumps(processed_data.get("relations", []))
        status = "PENDING_VERIFICATION"
        
        self.cursor.execute('''
            INSERT INTO fir_staging (staging_id, raw_text, anchors, nlp_entities, relations, status)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (staging_id, raw_text, anchors, nlp_entities, relations, status))
        self.conn.commit()
        
        logger.info(f"FIR parked in staging queue. Staging ID: {staging_id}")
        return staging_id

    def get_pending_firs(self) -> List[Dict[str, Any]]:
        self.cursor.execute("SELECT staging_id, raw_text, anchors, nlp_entities, relations FROM fir_staging WHERE status = 'PENDING_VERIFICATION'")
        rows = self.cursor.fetchall()
        
        results = []
        for row in rows:
            results.append({
                "staging_id": row[0],
                "raw_text": row[1],
                "deterministic_anchors": json.loads(row[2]),
                "nlp_entities": json.loads(row[3]),
                "relations": json.loads(row[4])
            })
        return results

    def get_fir_by_id(self, staging_id: str) -> Dict[str, Any]:
        self.cursor.execute("SELECT raw_text, anchors, nlp_entities, relations, status FROM fir_staging WHERE staging_id = ?", (staging_id,))
        row = self.cursor.fetchone()
        if not row:
            return None
        return {
            "staging_id": staging_id,
            "raw_text": row[0],
            "deterministic_anchors": json.loads(row[1]),
            "nlp_entities": json.loads(row[2]),
            "relations": json.loads(row[3]),
            "status": row[4]
        }

    def mark_committed(self, staging_id: str):
        self.cursor.execute("UPDATE fir_staging SET status = 'COMMITTED_TO_GRAPH' WHERE staging_id = ?", (staging_id,))
        self.conn.commit()
        logger.info(f"FIR {staging_id} committed to knowledge graph.")

    def mark_rejected(self, staging_id: str):
        self.cursor.execute("UPDATE fir_staging SET status = 'REJECTED' WHERE staging_id = ?", (staging_id,))
        self.conn.commit()
