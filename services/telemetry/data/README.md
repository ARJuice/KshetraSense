# Historical telemetry benchmark data

The raw files are unchanged from Mendeley Data version 2, [DOI 10.17632/35wh56287y.2](https://data.mendeley.com/datasets/35wh56287y/2), published by Laura Belli, Luca Davoli, Giulia Oddi, Luca Preite, Martina Galaverni, Tommaso Ganino, and Gianluigi Ferrari. The dataset page lists CC BY 4.0. Cite the authors and dataset DOI when reusing the data. The related description is Belli et al., *Smart agriculture dataset in a tomato cultivation under different irrigation regimes*, Data in Brief 60 (2025), [DOI 10.1016/j.dib.2025.111521](https://doi.org/10.1016/j.dib.2025.111521).

The trial is a HEINZ 1301 tomato crop in Parma, Italy, during summer 2023. Its three experimental irrigation lines received 100%, 60%, and 30% of the Irriframe-recommended quantity. The raw source says soil humidity is `%RH` (not volumetric water content), soil EC is µS/cm, soil sensors were positioned at 20 cm, and the shared environmental sensor reports air humidity `%RH` and air temperature °C. The source labels `current_volume` as m³; KshetraSense preserves it as a source-reported reading and does not infer flow, liters, or valve state.

`manifest.json` records the source identity, license, byte sizes, and SHA-256 checksums verified immediately after download. The API verifies these checksums before loading the benchmark. `README.TXT` is retained as downloaded; its soil filename description predates the current `stuard_soil_data.csv` name. Two CSVs also contain repeated header rows in the body; the loader excludes and counts them.

This is a historical demonstration dataset, not a live KshetraSense farm feed. Its trial lines are not management zones from the user's field.
