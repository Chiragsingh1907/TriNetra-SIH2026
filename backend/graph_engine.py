from neo4j import GraphDatabase
import networkx as nx
from sklearn.cluster import KMeans
import numpy as np
import logging
import uuid
import os

logger = logging.getLogger(__name__)

class GraphEngine:
    """
    Neo4j and NetworkX integration for the Core Knowledge Graph.
    Rule 3: Deterministic Anchors.
    Rule 4: NetworkX Betweenness Centrality & Scikit-learn Behavioral Clustering.
    """
    def __init__(self, uri=None, user=None, password=None):
        uri = uri or os.getenv("NEO4J_URI", "bolt://localhost:7687")
        user = user or os.getenv("NEO4J_USER", "neo4j")
        password = password or os.getenv("NEO4J_PASSWORD", "test1234")
        
        try:
            # Production-Grade Error Handling: Wrap connection logic
            self.driver = GraphDatabase.driver(uri, auth=(user, password))
            self.driver.verify_connectivity()
            logger.info("Successfully connected to Neo4j database.")
            self._initialize_constraints()
        except Exception as e:
            logger.error(f"CRITICAL: Failed to connect to Neo4j. Check if database is running and accessible. Error: {e}")
            self.driver = None

    def _initialize_constraints(self):
        # Enforce unique deterministic anchors in Neo4j
        queries = [
            "CREATE CONSTRAINT IF NOT EXISTS FOR (p:Phone) REQUIRE p.number IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (b:BankAccount) REQUIRE b.account_no IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (v:Vehicle) REQUIRE v.reg_no IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (s:Suspect) REQUIRE s.uuid IS UNIQUE"
        ]
        with self.driver.session() as session:
            for query in queries:
                try:
                    session.run(query)
                except Exception as e:
                    logger.warning(f"Constraint creation warning: {e}")

    def close(self):
        self.driver.close()

    def commit_verified_data(self, data: dict):
        """
        Commits investigator-verified data into Neo4j using an ACID-compliant transaction block.
        If any step fails, the entire transaction rolls back, preventing corrupt/partial graph states.
        """
        with self.driver.session() as session:
            session.execute_write(self._execute_commit_transaction, data)

    @staticmethod
    def _execute_commit_transaction(tx, data: dict):
        query = """
        MERGE (c:Case {id: $case_id})
        SET c.summary = $summary, c.date = datetime(), c.raw_text = $raw_text

        FOREACH (p IN $plaintiffs |
            MERGE (victim:Person {name: p})
            MERGE (victim)-[:FILED_COMPLAINT]->(c)
        )

        FOREACH (s IN $suspects |
            MERGE (suspect:Person {name: s})
            MERGE (suspect)-[:ACCUSED_IN]->(c)
        )

        FOREACH (phone IN $phones |
            MERGE (ph:Phone {number: phone})
            MERGE (c)-[:LINKED_TO]->(ph)
        )

        FOREACH (bank IN $financials |
            MERGE (ba:BankAccount {details: bank})
            MERGE (c)-[:LINKED_TO]->(ba)
        )

        FOREACH (veh IN $vehicles |
            MERGE (v:Vehicle {plate: veh})
            MERGE (c)-[:LINKED_TO]->(v)
        )
        """
        tx.run(
            query,
            case_id=data.get("fir_id", str(uuid.uuid4())),
            raw_text=data.get("raw_text", ""),
            summary=data.get("case_summary", ""),
            plaintiffs=data.get("identified_plaintiffs", []),
            suspects=data.get("identified_suspects", []),
            phones=data.get("phone_anchors", []),
            financials=data.get("financial_anchors", []),
            vehicles=data.get("vehicle_anchors", [])
        )

    def delete_case(self, case_id: str):
        """
        Deletes a specific case and cleans up any orphaned entities.
        """
        with self.driver.session() as session:
            session.run("MATCH (c:Case {id: $case_id}) DETACH DELETE c", case_id=case_id)
            session.run("MATCH (n) WHERE NOT (n)--() DELETE n")

    def generate_analytics(self):
        """
        Extracts Neo4j subgraph and uses GraphAnalyticsEngine to run NetworkX and Scikit-Learn logic.
        """
        from analytics_engine import GraphAnalyticsEngine
        
        neo4j_records = []
        with self.driver.session() as session:
            # Fetch entire graph projection
            result = session.run("""
                MATCH (n)-[r]->(m) 
                RETURN id(n) as source_id, labels(n)[0] as source_label, n.name as source_name, n.number as source_num, n.details as source_details, n.plate as source_plate, n.id as source_uuid,
                       id(m) as target_id, labels(m)[0] as target_label, m.name as target_name, m.number as target_num, m.details as target_details, m.plate as target_plate, m.id as target_uuid,
                       type(r) as rel_type
            """)
            
            for record in result:
                neo4j_records.append(dict(record))

        analytics_engine = GraphAnalyticsEngine()
        return analytics_engine.generate_react_payload(neo4j_records)
