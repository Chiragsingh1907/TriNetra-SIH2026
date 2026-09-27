from pydantic import BaseModel, Field
from typing import List

class FIRExtraction(BaseModel):
    case_summary: str = Field(default="")
    identified_plaintiffs: List[str] = Field(default_factory=list)
    identified_suspects: List[str] = Field(default_factory=list)
    phone_anchors: List[str] = Field(default_factory=list)
    financial_anchors: List[str] = Field(default_factory=list)
    vehicle_anchors: List[str] = Field(default_factory=list)

class FIRCommitRequest(BaseModel):
    fir_id: str = ""
    raw_text: str = ""
    case_summary: str = ""
    identified_plaintiffs: List[str] = Field(default_factory=list)
    identified_suspects: List[str] = Field(default_factory=list)
    phone_anchors: List[str] = Field(default_factory=list)
    financial_anchors: List[str] = Field(default_factory=list)
    vehicle_anchors: List[str] = Field(default_factory=list)
