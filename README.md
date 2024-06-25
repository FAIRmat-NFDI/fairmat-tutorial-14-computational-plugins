# fairmat-tutorial-14-computational-plugins
FAIRmat Tutorial 14: Developing schemas and parsers for FAIR computational data storage using NOMAD-Simulations

NOMAD is an open-source, community-driven data infrastructure, focusing on materials science data. Originally built as a repository for data from DFT calculations, the NOMAD software can automatically extract data from the output of a large variety of simulation codes. Our previous computation-focused tutorials (CECAM workshop, Tutorial 10, and Tutorial 7) have highlighted the extension of NOMAD’s functionalities to support advanced many-body calculations, classical molecular dynamics simulations, and complex simulation workflows.

But how can you utilize this infrastructure and associated suite of tools if your simulation code or method is not yet supported? This tutorial will provide foundational knowledge for customizing NOMAD to fit the specific needs of your computational research project. The following provides an outline of the major topics that will be covered:

- Introduction to the NOMAD software and repository
- Working with the NOMAD-Simulations schema plugin
- Extending NOMAD-Simulations to support custom methods and outputs
- Creating parser plugins from scratch
- Extra: Interfacing complex simulation and analysis workflows with NOMAD
