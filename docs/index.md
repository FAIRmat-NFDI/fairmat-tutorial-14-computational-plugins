# Developing schemas and parsers for FAIR computational data storage using NOMAD-Simulations

This tutorial will provide foundational knowledge for customizing NOMAD to fit the specific needs of your computational research project.

## Tutorial information and preparation

The FAIRmat Tutorial 14, presented by FAIRmat Area C Computation, will take place on Wednesday, July 10, 2024, at 13:00 via Zoom. Check your email for the link if you have already registered, or register at the [Event Page](https://events.fairmat-nfdi.eu/event/22/){:target="_blank"}

To help facilitate discussions and provide prolonged assistance beyond the tutorial, we have created a [Tutorial 14 event channel](https://discord.gg/qgpHtPZwkt) in the NOMAD Discord server.

The focus of this tutorial is the `nomad-simulations` schema package. If you are interested in getting some hands-on experience during the tutorial, it would be useful to install the software in advance to solve any unforeseen complications:

First, create the directory and the virtual environment in the terminal. Note that the Python version must be 3.9 for `nomad-simulations` to work:

    mkdir test_nomadsimulations
    cd test_nomadsimulations/
    python3.9 -m venv .pyenv
    source .pyenv/bin/activate


Once this is done, we can pip install the `nomad-simulations` package:

    pip install --upgrade pip
    pip install nomad-simulations --index-url https://gitlab.mpcdf.mpg.de/api/v4/projects/2187/packages/pypi/simple`

If you have any problems, please contact us via the Discord event channel.

### Approximate Program

- Introduction to the NOMAD software and repository (13:00 - 13:15)
- Working with the NOMAD-Simulations schema plugin (13:15 - 14:15)
- Coffee Break (14:15 - 14:30)
- Creating parser plugins from scratch (14:30 - 15:10)
- Extending NOMAD-Simulations to support custom methods and outputs (15:10 - 15:50)
- Extra: Interfacing complex simulation and analysis workflows with NOMAD (15:50 - 16)


### Background

[NOMAD](nomad-lab.edu){:target="_blank"} is an open-source, community-driven data infrastructure, focusing on materials science data. Originally built as a repository for data from DFT calculations, the NOMAD software can automatically extract data from the output of a large variety of simulation codes. Our previous computation-focused tutorials ([CECAM workshop](https://fairmat-nfdi.github.io/AreaC-Tutorial-CECAM-2023/){:target="_blank"}, [Tutorial 10](https://fairmat-nfdi.github.io/AreaC-Tutorial10_2023/){:target="_blank"}, and [Tutorial 7](https://www.fairmat-nfdi.eu/events/fairmat-tutorial-7/tutorial-7-materials){:target="_blank"}) have highlighted the extension of NOMAD’s functionalities to support advanced many-body calculations, classical molecular dynamics simulations, and complex simulation workflows.


