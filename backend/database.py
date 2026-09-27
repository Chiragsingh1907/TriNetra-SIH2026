from neo4j import GraphDatabase
import os

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

class Neo4jConnection:
    def __init__(self, uri, user, pwd):
        self.__uri = uri
        self.__user = user
        self.__pwd = pwd
        self.__driver = None
        try:
            self.__driver = GraphDatabase.driver(self.__uri, auth=(self.__user, self.__pwd))
        except Exception as e:
            print("Failed to create the driver:", e)
        
    def close(self):
        if self.__driver is not None:
            self.__driver.close()
        
    def query(self, query, parameters=None, db=None):
        assert self.__driver is not None, "Driver not initialized!"
        session = None
        response = None
        try: 
            session = self.__driver.session(database=db) if db is not None else self.__driver.session() 
            response = list(session.run(query, parameters))
        except Exception as e:
            print("Query failed:", e)
        finally: 
            if session is not None:
                session.close()
        return response

db_conn = Neo4jConnection(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)

def init_db():
    db_conn.query("CREATE CONSTRAINT IF NOT EXISTS FOR (c:Case) REQUIRE c.id IS UNIQUE")
    db_conn.query("CREATE CONSTRAINT IF NOT EXISTS FOR (p:Person) REQUIRE p.name IS UNIQUE")
    db_conn.query("CREATE CONSTRAINT IF NOT EXISTS FOR (ph:Phone) REQUIRE ph.number IS UNIQUE")
    db_conn.query("CREATE CONSTRAINT IF NOT EXISTS FOR (l:Location) REQUIRE l.name IS UNIQUE")
    db_conn.query("CREATE CONSTRAINT IF NOT EXISTS FOR (e:Entity) REQUIRE e.name IS UNIQUE")

def commit_fir_to_db(fir_id: str, raw_text: str, extraction: dict):
    # Create Case node
    query = """
    MERGE (c:Case {id: $fir_id})
    SET c.raw_text = $raw_text, c.summary = $summary
    """
    db_conn.query(query, {"fir_id": fir_id, "raw_text": raw_text, "summary": extraction.get("case_summary", "")})

    # Add plaintiffs (Person)
    for p in extraction.get("plaintiffs", []):
        if p.strip():
            db_conn.query("""
            MERGE (person:Person {name: $name})
            WITH person
            MATCH (c:Case {id: $fir_id})
            MERGE (person)-[:INVOLVED_IN {role: 'plaintiff'}]->(c)
            """, {"name": p.strip(), "fir_id": fir_id})

    # Add suspects (Person)
    for s in extraction.get("suspects", []):
        if s.strip():
            db_conn.query("""
            MERGE (person:Person {name: $name})
            WITH person
            MATCH (c:Case {id: $fir_id})
            MERGE (person)-[:INVOLVED_IN {role: 'suspect'}]->(c)
            """, {"name": s.strip(), "fir_id": fir_id})

    # Add phone numbers
    for ph in extraction.get("phone_numbers", []):
        if ph.strip():
            db_conn.query("""
            MERGE (phone:Phone {number: $number})
            WITH phone
            MATCH (c:Case {id: $fir_id})
            MERGE (phone)-[:LINKED_TO]->(c)
            """, {"number": ph.strip(), "fir_id": fir_id})

    # Add locations
    for loc in extraction.get("locations", []):
        if loc.strip():
            db_conn.query("""
            MERGE (location:Location {name: $name})
            WITH location
            MATCH (c:Case {id: $fir_id})
            MERGE (location)-[:LINKED_TO]->(c)
            """, {"name": loc.strip(), "fir_id": fir_id})

    # Add connected entities
    for ent in extraction.get("connected_entities", []):
        if ent.strip():
            db_conn.query("""
            MERGE (entity:Entity {name: $name})
            WITH entity
            MATCH (c:Case {id: $fir_id})
            MERGE (entity)-[:LINKED_TO]->(c)
            """, {"name": ent.strip(), "fir_id": fir_id})

def get_all_firs():
    result = db_conn.query("MATCH (c:Case) RETURN c.id AS id")
    if result:
        return [record["id"] for record in result]
    return []

def get_fir_details(fir_id: str):
    result = db_conn.query("MATCH (c:Case {id: $fir_id}) RETURN c.raw_text AS raw_text, c.summary AS summary", {"fir_id": fir_id})
    if not result:
        return None
    
    raw_text = result[0]["raw_text"]
    summary = result[0]["summary"]

    extraction = {
        "case_summary": summary,
        "plaintiffs": [],
        "suspects": [],
        "phone_numbers": [],
        "locations": [],
        "connected_entities": []
    }

    pl_res = db_conn.query("MATCH (p:Person)-[:INVOLVED_IN {role: 'plaintiff'}]->(c:Case {id: $fir_id}) RETURN p.name AS name", {"fir_id": fir_id})
    if pl_res: extraction["plaintiffs"] = [r["name"] for r in pl_res]

    su_res = db_conn.query("MATCH (p:Person)-[:INVOLVED_IN {role: 'suspect'}]->(c:Case {id: $fir_id}) RETURN p.name AS name", {"fir_id": fir_id})
    if su_res: extraction["suspects"] = [r["name"] for r in su_res]

    ph_res = db_conn.query("MATCH (p:Phone)-[:LINKED_TO]->(c:Case {id: $fir_id}) RETURN p.number AS number", {"fir_id": fir_id})
    if ph_res: extraction["phone_numbers"] = [r["number"] for r in ph_res]

    loc_res = db_conn.query("MATCH (l:Location)-[:LINKED_TO]->(c:Case {id: $fir_id}) RETURN l.name AS name", {"fir_id": fir_id})
    if loc_res: extraction["locations"] = [r["name"] for r in loc_res]

    ent_res = db_conn.query("MATCH (e:Entity)-[:LINKED_TO]->(c:Case {id: $fir_id}) RETURN e.name AS name", {"fir_id": fir_id})
    if ent_res: extraction["connected_entities"] = [r["name"] for r in ent_res]

    graph_res = db_conn.query("""
    MATCH path=(c:Case {id: $fir_id})-[*1..4]-(connected)
    RETURN path
    """, {"fir_id": fir_id})

    nodes = {}
    edges = []

    def add_node(node):
        try:
            node_id = str(node.element_id)
        except AttributeError:
            node_id = str(node.id)
            
        if node_id not in nodes:
            label = node.labels
            shape = "dot"
            if "Case" in label:
                shape = "square"
                title = node.get("id")
            elif "Person" in label:
                shape = "dot"
                title = node.get("name")
            elif "Phone" in label:
                shape = "triangle"
                title = node.get("number")
            elif "Location" in label:
                shape = "hexagon"
                title = node.get("name")
            else:
                shape = "star"
                title = node.get("name")
            
            nodes[node_id] = {
                "id": node_id,
                "label": title,
                "shape": shape,
                "group": list(label)[0] if label else "Unknown",
                "properties": dict(node)
            }
        return node_id

    # Always ensure the root Case node is added even if no relations exist
    case_res = db_conn.query("MATCH (c:Case {id: $fir_id}) RETURN c", {"fir_id": fir_id})
    if case_res:
        add_node(case_res[0]["c"])

    if graph_res:
        for record in graph_res:
            path = record["path"]
            for node in path.nodes:
                add_node(node)
            for rel in path.relationships:
                start_id = str(rel.start_node.element_id if hasattr(rel.start_node, "element_id") else rel.start_node.id)
                end_id = str(rel.end_node.element_id if hasattr(rel.end_node, "element_id") else rel.end_node.id)
                edge = {"from": start_id, "to": end_id, "label": type(rel).__name__}
                if edge not in edges and {"from": end_id, "to": start_id, "label": type(rel).__name__} not in edges:
                    edges.append(edge)

    graph_data = {
        "nodes": list(nodes.values()),
        "edges": edges
    }

    return {
        "fir_id": fir_id,
        "raw_text": raw_text,
        "extraction": extraction,
        "graph": graph_data
    }

def delete_fir(fir_id: str):
    db_conn.query("""
    MATCH (c:Case {id: $fir_id})
    DETACH DELETE c
    """, {"fir_id": fir_id})
    db_conn.query("""
    MATCH (n)
    WHERE size((n)--()) = 0
    DELETE n
    """)
