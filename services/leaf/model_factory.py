from __future__ import annotations

from typing import Any

from .classes import CLASS_IDS
from .preprocessing import INPUT_SIZE


FINE_TUNE_LAST_LAYERS = 30


def build_model(keras: Any) -> Any:
    inputs = keras.Input(shape=(*INPUT_SIZE, 3), name="leaf_rgb_224")
    augmentation = keras.Sequential(
        [
            keras.layers.RandomFlip("horizontal"),
            keras.layers.RandomRotation(0.08),
            keras.layers.RandomZoom(0.08),
        ],
        name="training_augmentation",
    )
    backbone = keras.applications.MobileNetV3Small(
        input_shape=(*INPUT_SIZE, 3),
        alpha=1.0,
        include_top=False,
        pooling="avg",
        weights="imagenet",
        include_preprocessing=True,
        name="MobileNetV3Small",
    )
    backbone.trainable = False
    features = backbone(augmentation(inputs), training=False)
    outputs = keras.layers.Dense(len(CLASS_IDS), activation="softmax", name="plant_condition_scores")(
        keras.layers.Dropout(0.2, name="classifier_dropout")(features)
    )
    return keras.Model(inputs, outputs, name="kshetrasense_leaf_mobilenetv3_small")


def enable_fine_tuning(model: Any, keras: Any) -> None:
    backbone = model.get_layer("MobileNetV3Small")
    backbone.trainable = True
    start = max(0, len(backbone.layers) - FINE_TUNE_LAST_LAYERS)
    for index, layer in enumerate(backbone.layers):
        layer.trainable = index >= start and not isinstance(layer, keras.layers.BatchNormalization)
