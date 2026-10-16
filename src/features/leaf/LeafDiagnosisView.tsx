import { useEffect, useRef, useState } from 'react';
import { FileImage, LoaderCircle, ShieldCheck, Sparkles, Upload, X } from 'lucide-react';
import { LeafApiError, runLeafDiagnosis } from '../../services/leafApi';
import type { LeafPrediction } from '../../services/leafApi';
import './leaf-diagnosis.css';


const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function LeafDiagnosisView() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<LeafPrediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function chooseFile(nextFile: File | null) {
    setPrediction(null);
    setError(null);
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(nextFile.type)) {
      setFile(null);
      setError('Choose a JPEG or PNG image. The service also checks the actual image content.');
      return;
    }
    if (nextFile.size > MAX_UPLOAD_BYTES) {
      setFile(null);
      setError('Image exceeds the 10 MiB upload limit.');
      return;
    }
    setFile(nextFile);
  }

  async function submit() {
    if (!file || isLoading) return;
    setPrediction(null);
    setError(null);
    setIsLoading(true);
    try {
      setPrediction(await runLeafDiagnosis(file));
    } catch (reason) {
      setError(reason instanceof LeafApiError ? reason.message : 'Leaf diagnosis could not be completed.');
    } finally {
      setIsLoading(false);
    }
  }

  function clearFile() {
    setFile(null);
    setPrediction(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <section className="workspace leaf-diagnosis">
      <header className="workspace__header">
        <p className="eyebrow">Independent image-only workflow</p>
        <h1>Leaf Diagnosis</h1>
        <p className="workspace__lede">
          Compare one leaf image against 17 PlantVillage crop-condition labels. Soil measurements, zones, and satellite data are not sent to this model.
        </p>
      </header>

      <div className="leaf-diagnosis__layout">
        <section className="panel leaf-upload" aria-labelledby="leaf-upload-title">
          <div className="leaf-upload__heading">
            <div>
              <p className="eyebrow">Image input</p>
              <h2 id="leaf-upload-title">Choose a leaf photo</h2>
            </div>
            <span className="leaf-upload__tag"><ShieldCheck size={14} /> Image only</span>
          </div>

          <input
            ref={inputRef}
            className="leaf-upload__input"
            id="leaf-image"
            type="file"
            accept="image/jpeg,image/png"
            aria-describedby="leaf-upload-guidance"
            disabled={isLoading}
            onChange={(event) => chooseFile(event.currentTarget.files?.[0] ?? null)}
          />
          <label className="leaf-upload__dropzone" htmlFor="leaf-image">
            {previewUrl ? (
              <img className="leaf-upload__preview" src={previewUrl} alt="Selected leaf image preview" />
            ) : (
              <span className="leaf-upload__placeholder"><FileImage size={28} /></span>
            )}
            <strong>{file ? file.name : 'Select one JPEG or PNG image'}</strong>
            <span>{file ? `${(file.size / 1024).toFixed(0)} KiB · ${file.type}` : 'Maximum file size: 10 MiB'}</span>
          </label>

          <p className="leaf-upload__guidance" id="leaf-upload-guidance">
            Image bytes are processed for this request and are not saved by the module. EXIF/location metadata is excluded before inference. Images outside the supported crop-condition labels can still receive a ranked class.
          </p>
          <div className="leaf-upload__actions">
            <button className="button button--secondary" type="button" onClick={() => inputRef.current?.click()} disabled={isLoading}>
              <Upload size={15} /> {file ? 'Change image' : 'Choose image'}
            </button>
            {file && (
              <button className="button button--secondary" type="button" onClick={clearFile} disabled={isLoading}>
                <X size={15} /> Clear
              </button>
            )}
            <button className="button button--primary leaf-upload__submit" type="button" onClick={submit} disabled={!file || isLoading}>
              {isLoading ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}
              {isLoading ? 'Analyzing image…' : 'Run image analysis'}
            </button>
          </div>
          {error && <p className="leaf-upload__error" role="alert">{error}</p>}
        </section>

        <section className="panel leaf-result" aria-live="polite" aria-busy={isLoading}>
          {isLoading ? (
            <div className="leaf-result__empty">
              <LoaderCircle className="spin" size={22} />
              <strong>Analyzing the selected image</strong>
              <span>Waiting for the configured analysis service.</span>
            </div>
          ) : prediction ? (
            <PredictionResult prediction={prediction} />
          ) : (
            <div className="leaf-result__empty">
              <FileImage size={22} />
              <strong>No image result yet</strong>
              <span>Select a JPEG or PNG and run the image-only classifier.</span>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function PredictionResult({ prediction }: { prediction: LeafPrediction }) {
  return (
    <div className="leaf-result__content">
      <div className="leaf-result__title">
        <div>
          <p className="eyebrow">Top supported class</p>
          <h2>{prediction.crop}</h2>
          <p className="leaf-result__condition">{prediction.condition}</p>
          <span className="leaf-result__class-id">{prediction.topClass}</span>
        </div>
        <span className="leaf-result__review">Manual review required</span>
      </div>

      <p className="leaf-result__disclosure">
        {prediction.isHealthy ? 'The top class is a healthy label.' : 'The top class is disease-associated.'} This is a single-label image match, not a confirmed diagnosis, severity estimate, or treatment recommendation.
      </p>

      <div className="leaf-result__ranking">
        <div className="leaf-result__section-title">
          <h3>Ranked supported classes</h3>
          <span>Uncalibrated model score</span>
        </div>
        <ol>
          {prediction.rankedClasses.map((item, index) => (
            <li key={item.className} className={index === 0 ? 'is-top' : ''}>
              <span className="leaf-result__rank">{String(index + 1).padStart(2, '0')}</span>
              <span className="leaf-result__rank-label">
                <strong>{item.className.split('___')[0]}</strong>
                <small>{item.className.split('___')[1]?.replace(/_/g, ' ') ?? item.className}</small>
              </span>
              <code>{item.score.toFixed(4)}</code>
            </li>
          ))}
        </ol>
      </div>

      <div className="leaf-result__metadata">
        <div><span>Architecture</span><strong>{prediction.modelMetadata.architecture}</strong></div>
        <div><span>Model weights</span><strong>{prediction.modelMetadata.weightsVersion}</strong></div>
        <div><span>Preprocessing</span><strong>{prediction.modelMetadata.preprocessingVersion}</strong></div>
        <div><span>Class map</span><strong>{prediction.modelMetadata.classMapVersion}</strong></div>
        <div><span>Server inference</span><strong>{prediction.modelMetadata.inferenceLatencyMs.toFixed(1)} ms</strong></div>
      </div>

      <ul className="leaf-result__limitations">
        {prediction.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
      </ul>
    </div>
  );
}
