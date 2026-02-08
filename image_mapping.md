# Category Image Mapping

To ensure the game motor can load images for each category, please place `.jpg` or `.png` files in `assets/categories/` with the following names (case-insensitive, spaces replaced by underscores, no accents):

| Category in Dataset | Expected Filename |
| :--- | :--- |
| Neurodesarrollo | `neurodesarrollo.jpg` |
| Psicóticos | `psicoticos.jpg` |
| Bipolares | `bipolares.jpg` |
| Depresivos | `depresivos.jpg` |
| Ansiedad | `ansiedad.jpg` |
| TOC y relacionados | `toc_y_relacionados.jpg` |
| Trauma y estrés | `trauma_y_estres.jpg` |
| Disociativos | `disociativos.jpg` |
| Somáticos y relacionados | `somaticos_y_relacionados.jpg` |
| Alimentación e ingesta | `alimentacion_e_ingesta.jpg` |
| Eliminación | `eliminacion.jpg` |
| Sueño-vigilia | `sueno_vigilia.jpg` |
| Disfunciones sexuales | `disfunciones_sexuales.jpg` |
| Disforia de género | `disforia_de_genero.jpg` |
| Disruptivos e impulsos | `disruptivos_e_impulsos.jpg` |
| Sustancias y adictivos | `sustancias_y_adictivos.jpg` |
| Neurocognitivos | `neurocognitivos.jpg` |
| Personalidad | `personalidad.jpg` |
| Parafílicos | `parafilicos.jpg` |
| Semiología | `semiologia.jpg` |
| Psicofarmacología | `psicofarmacologia.jpg` |
| Urgencias | `urgencias.jpg` |
| Neuroanatomía | `neuroanatomia.jpg` |

> [!TIP]
> Use `.jpg` as the default extension. If using `.png`, make sure to update the `bg_path` logic in the UI if you implement specific loading logic.
