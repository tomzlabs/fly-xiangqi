# Sources and attribution

- **Model and packaged connectivity source:** Philip K. Shiu and collaborators, [Drosophila_brain_model](https://github.com/philshiu/Drosophila_brain_model), pinned commit in `data/sources.json`. The upstream repository carries the MIT license; its complete notice is retained in [shiu-model-LICENSE.txt](shiu-model.txt). The Rust implementation was written for this project from the published model equations and scheduling conventions; it is not an unmodified port of Brian2 itself.
- **Model paper:** Shiu et al., *A Drosophila computational brain model reveals sensorimotor processing*, Nature 634, 210–219 (2024). https://doi.org/10.1038/s41586-024-07763-9 .
- **Connectome:** FlyWire / FAFB adult female Drosophila, as supplied by the above authors in their v783 model release. Credit the underlying FlyWire Consortium and contributors. The counts here describe this particular author export; they must not be substituted for counts in other full-brain releases.
- **Neuron annotations and anchor positions:** [flyconnectome/flywire_annotations](https://github.com/flyconnectome/flywire_annotations), pinned commit in the manifest. Schlegel et al., *Whole-brain annotation and multi-connectome cell typing of Drosophila*, Nature 634, 139–152 (2024), https://doi.org/10.1038/s41586-024-07686-5 . The pinned table includes later annotation updates; it is not presented as an unchanged 2024 table. Its authors retain ownership of their data. See their repository and publication for source attribution and reuse terms.
- **Application upstream:** [tolatolatop/fly-chess](https://github.com/tolatolatop/fly-chess). The neural loader, Rust/WASM simulation and data preparation descend from this application. The current product is a continuous fly-world experiment.
- **Rendering:** Three.js, MIT.
- **Fonts:** Space Grotesk and IBM Plex Mono, SIL Open Font License; distributed locally through Fontsource with upstream notices in the corresponding packages.

The habitat and fly geometry are illustrative simulation graphics, not a measured anatomical reconstruction.

`eonsystemspbc/fly-brain` (GPL-2.0) and `vaibhavkedarisetti/fruit-fly-lab` were inspected as related projects, not incorporated as code or binary dependencies. No license grant is inferred from a GitHub repository merely being public.
