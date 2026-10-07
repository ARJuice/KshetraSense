export interface LeafClassDefinition {
  id: string;
  crop: 'Apple' | 'Tomato' | 'Potato';
  condition: string;
  pathogen: string;
}

export const PLANT_VILLAGE_17_CLASSES: LeafClassDefinition[] = [
  // Apple (4)
  { id: 'apple-scab', crop: 'Apple', condition: 'Scab', pathogen: 'Venturia inaequalis' },
  { id: 'apple-black-rot', crop: 'Apple', condition: 'Black Rot', pathogen: 'Botryosphaeria obtusa' },
  { id: 'apple-cedar-rust', crop: 'Apple', condition: 'Cedar Apple Rust', pathogen: 'Gymnosporangium juniperi-virginianae' },
  { id: 'apple-healthy', crop: 'Apple', condition: 'Healthy', pathogen: 'None (asymptomatic)' },

  // Tomato (10)
  { id: 'tomato-bacterial-spot', crop: 'Tomato', condition: 'Bacterial Spot', pathogen: 'Xanthomonas campestris' },
  { id: 'tomato-early-blight', crop: 'Tomato', condition: 'Early Blight', pathogen: 'Alternaria solani' },
  { id: 'tomato-late-blight', crop: 'Tomato', condition: 'Late Blight', pathogen: 'Phytophthora infestans' },
  { id: 'tomato-leaf-mold', crop: 'Tomato', condition: 'Leaf Mold', pathogen: 'Passalora fulva' },
  { id: 'tomato-septoria', crop: 'Tomato', condition: 'Septoria Leaf Spot', pathogen: 'Septoria lycopersici' },
  { id: 'tomato-spider-mites', crop: 'Tomato', condition: 'Two-spotted Spider Mite', pathogen: 'Tetranychus urticae' },
  { id: 'tomato-target-spot', crop: 'Tomato', condition: 'Target Spot', pathogen: 'Corynespora cassiicola' },
  { id: 'tomato-ylcv', crop: 'Tomato', condition: 'Yellow Leaf Curl Virus', pathogen: 'Begomovirus / TYLCV' },
  { id: 'tomato-mosaic', crop: 'Tomato', condition: 'Mosaic Virus', pathogen: 'ToMV' },
  { id: 'tomato-healthy', crop: 'Tomato', condition: 'Healthy', pathogen: 'None (asymptomatic)' },

  // Potato (3)
  { id: 'potato-early-blight', crop: 'Potato', condition: 'Early Blight', pathogen: 'Alternaria solani' },
  { id: 'potato-late-blight', crop: 'Potato', condition: 'Late Blight', pathogen: 'Phytophthora infestans' },
  { id: 'potato-healthy', crop: 'Potato', condition: 'Healthy', pathogen: 'None (asymptomatic)' },
];

export interface MockLeafSampleResult {
  fixtureId: string;
  topClass: string;
  topCrop: 'Tomato';
  pathogen: string;
  modelScore: number;
  secondaryClasses: Array<{ label: string; score: number }>;
  modelArchitecture: string;
  version: string;
  calibrationNote: string;
  unsupportedStateNotice: string;
}

export const MOCK_LEAF_SAMPLE: MockLeafSampleResult = {
  fixtureId: 'leaf-sample-tomato-late-blight-v1',
  topClass: 'Tomato — Late Blight',
  topCrop: 'Tomato',
  pathogen: 'Phytophthora infestans',
  modelScore: 0.82,
  secondaryClasses: [
    { label: 'Tomato — Late Blight', score: 0.82 },
    { label: 'Tomato — Early Blight', score: 0.09 },
    { label: 'Tomato — Target Spot', score: 0.04 },
    { label: 'Tomato — Healthy', score: 0.03 },
    { label: 'Potato — Late Blight', score: 0.02 },
  ],
  modelArchitecture: 'MobileNetV3-Small (transfer-learned from ImageNet)',
  version: 'mock-fixture-sample-v1',
  calibrationNote: 'Scores are uncalibrated softmax outputs. Calibration curve not yet evaluated on group-preserving test partition.',
  unsupportedStateNotice: 'Supported labels limited to 17 PlantVillage crop conditions. Complex multi-infection or in-field ambient images require human agronomic review.',
};
