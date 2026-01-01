from pydantic import BaseModel
from enum import Enum


class Interpretation(Enum):
    INCREASE_POSITIVE = "Increase = positive, Decrease = negative"
    INCREASE_NEGATIVE = "Increase = negative, Decrease = positive"


class EvaluationParameters(BaseModel):
    parameter_name: str
    definition: str
    importance: str
    interpretation: Interpretation
    benchmark_or_note: str | None = None
