from __future__ import annotations

from dataclasses import dataclass


CLASS_MAP_VERSION = "plantvillage-apple-potato-tomato-17-v1"
REVIEW_POLICY_VERSION = "all-predictions-reviewed-v1"


@dataclass(frozen=True)
class LeafClass:
    class_name: str
    crop: str
    condition: str
    is_healthy: bool


CLASS_MAP = (
    LeafClass("Apple___Apple_scab", "Apple", "Apple scab", False),
    LeafClass("Apple___Black_rot", "Apple", "Black rot", False),
    LeafClass("Apple___Cedar_apple_rust", "Apple", "Cedar apple rust", False),
    LeafClass("Apple___healthy", "Apple", "Healthy", True),
    LeafClass("Potato___Early_blight", "Potato", "Early blight", False),
    LeafClass("Potato___Late_blight", "Potato", "Late blight", False),
    LeafClass("Potato___healthy", "Potato", "Healthy", True),
    LeafClass("Tomato___Bacterial_spot", "Tomato", "Bacterial spot", False),
    LeafClass("Tomato___Early_blight", "Tomato", "Early blight", False),
    LeafClass("Tomato___Late_blight", "Tomato", "Late blight", False),
    LeafClass("Tomato___Leaf_Mold", "Tomato", "Leaf mold", False),
    LeafClass("Tomato___Septoria_leaf_spot", "Tomato", "Septoria leaf spot", False),
    LeafClass("Tomato___Spider_mites Two-spotted_spider_mite", "Tomato", "Spider mites, two-spotted spider mite", False),
    LeafClass("Tomato___Target_Spot", "Tomato", "Target spot", False),
    LeafClass("Tomato___Tomato_Yellow_Leaf_Curl_Virus", "Tomato", "Tomato yellow leaf curl virus", False),
    LeafClass("Tomato___Tomato_mosaic_virus", "Tomato", "Tomato mosaic virus", False),
    LeafClass("Tomato___healthy", "Tomato", "Healthy", True),
)

CLASS_IDS = tuple(item.class_name for item in CLASS_MAP)
CLASS_BY_ID = {item.class_name: item for item in CLASS_MAP}
LIMITATIONS = [
    "Single-label image classification; not a severity estimate or treatment recommendation.",
    "Scores are uncalibrated model outputs. Manual review is required for every result.",
    "Training used controlled PlantVillage images; performance on field and phone photos has not been measured.",
]
