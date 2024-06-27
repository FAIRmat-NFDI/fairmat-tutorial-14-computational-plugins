# Working with the NOMAD-Simulations schema plugin

In NOMAD, all the simulation metadata is defined under the `Simulation` section. You can find its Python schema defined in the [`nomad-simulations`](https://github.com/nomad-coe/nomad-simulations/) repository. The entry point for the schema is in the [general.py](https://github.com/nomad-coe/nomad-simulations/blob/develop/src/nomad_simulations/schema_packages/general.py) module. This section will appear under the `data` section for each NOMAD [*entry*](https://nomad-lab.eu/prod/v1/staging/docs/reference/glossary.html#entry). There is a [specialized documentation page](https://nomad-coe.github.io/nomad-simulations/) in the `nomad-simulations` repository.

The `Simulation` section inherits from a more abstract concept called `BaseSimulation`, which at the same time inherits from a concept called `Activity`. 

??? question "Inheritance and composition"
    During this part, we will identify **is a** relationships with inheritance of one class into another (e.g., a `Simulation` _is an_ `Activity`) and **has a** with composition of one class under another (e.g., a `Simulation` **has a** `ModelSystem` defined under it and on which the simulation is performed). Strictly speaking, this equivalency is not entirely true, as we loosen it in some cases. But for the purpose of learning the complicated rules of inheritance and composition, we will conceptually maintain this equivalency during this Tutorial.

In NOMAD, a set of [base sections](https://nomad-lab.eu/prod/v1/staging/docs/howto/customization/base_sections.html) derived from the [Basic Formal Ontology (BFO)](https://basic-formal-ontology.org/) are defined. This inheritance allows us to define `Simulation` at the same level of other activities in Materials Science, e.g., `Experiment`, `Measurement`, `Analysis`. We do this in order to achieve a common metadata structure with the experimental and analysis fields in Materials Science. The relationship tree from the most abstract classes until `Simulation` is thus:

<div class="click-zoom">
    <label>
        <input type="checkbox">
        <img src="../assets/part2-nomad-simulations/simulation_base_details_bckgr.png" alt="Simulation base section diagram." width="80%" title="Click to zoom in">
    </label>
</div>

Note that the white-headed arrow here indicates _inheritance_ / _is a_ relationship. `BaseSimulation` contains the general information about the `Program` used (see [Program](#program)), as well as general times of the simulation, e.g., the datetime at which it started (`datetime`) and ended (`datetime_end`). `Simulation` contains further information about the specific input and output sections ([see below](#sub-sections-in-simulation)).

??? question "Notation for the section attributes in the UML diagram"
    We included the information of each attributes / quantities after its definition. The notation is:

        <name-of-quantity>: <type-of-quantity>, <units-of-quantity>

    Thus, `cpu1_start: np.float64, s` means that there is a quantity named `'cpu1_start'` of type `numpy.float64` and whose units are `'s'` (seconds).
    We also include the existance of sub-sections by bolding the name, i.e.:

        <name-of-sub-section>: <sub-section-definition>

    E.g., there is a sub-section under `Simulation` named `'model_method'` whose section defintion can be found in the `ModelMethod` section. We will represent this sub-section containment in more complex UML diagrams in the future using the containment arrow (see below for [an example using `Program`](#program)).

We use double inheritance from `EntryData` in order to populate the `data` section in the NOMAD archive. All of the base sections discussed here are subject to the [public normalize function](normalize.md) in NOMAD. The private function `set_system_branch_depth()` is related with the [ModelSystem base section](model_system/model_system.md).

## Main sub-sections in `Simulation` {#sub-sections-in-simulation}

The `Simulation` section is composed of 4 main sub-sections:

1. `Program` {#program}: contains all the program metadata, e.g., `name` of the program, `version`, etc.
2. `ModelSystem` {#modelsystem}: contains all the system metadata about geometrical positions of atoms, their states, simulation cells, symmetry information, etc.
3. `ModelMethod` {#modelmethod}: contains all the methodological metadata, and it is divided in two main aspects: the mathematical model or approximation used in the simulation (e.g., `DFT`, `GW`, `ForceFields`, etc.) and the numerical settings used to compute the properties (e.g., meshes, self-consistent parameters, basis sets settings, etc.).
4. `Outputs` {#outputs}: contains all the output properties, as well as references to the `ModelSystem` used to obtain such properties.

!!! note "Self-consistent steps, SinglePoint entries, and more complex workflows."
    The minimal unit for storing data in the NOMAD archive is an [*entry*](https://nomad-lab.eu/prod/v1/staging/docs/reference/glossary.html#entry). In the context of simulation data, an entry may contain data from a calculation on an individual system configuration (e.g., a single-point DFT calculation) using **only** the above-mentioned sections of the `Simulation` section. Information from self-consistent iterations to converge properties for this configuration are also contained within these sections.

    More complex calculations that involve multiple configurations require the definition of a *workflow* section within the archive. Depending on the situation, the information from individual workflow steps may be stored within a single or multiple entries. For example, for efficiency, the data from workflows involving a large amount of configurations, e.g., molecular dynamics trajectories, are stored within a single entry. Other standard workflows store the single-point data in separate entries, e.g.,  a `GW` calculation is composed of a `DFT SinglePoint` entry and a `GW SinglePoint` entry. Higher-level workflows, which simply connect a series of standard or custom workflows, are typically stored as a separate entry.
<!--Mention here Part V?-->

The following schematic represents a simplified representation of the `Simulation` section (note that the arrows here are a simple way of visually defining _inputs_ and _outputs_):

<div class="click-zoom">
    <label>
        <input type="checkbox">
        <img src="../assets/part2-nomad-simulations/simulation_composition.png" alt="Simulation composition diagram." width="80%" title="Click to zoom in">
    </label>
</div>

## `Program` {#program}

The `Program` section contains all the information about the program / software / code used to perform the simulation. The detailed relationship tree is:

<div class="click-zoom">
    <label>
        <input type="checkbox">
        <img src="../assets/part2-nomad-simulations/program.png" alt="Program quantities and functions UML diagram." width="80%" title="Click to zoom in">
    </label>
</div>

Note that the rhombo-headed arrow here indicates a _composition_ / _has a_ relationship, so that `BaseSimulation` has a `Program` sub-section under it.

When [writing a parser](https://nomad-lab.eu/prod/v1/staging/docs/howto/customization/parsers.html), we recommend to start by instantiating the `Program` section and populating its quantities, in order to get acquainted with the NOMAD parsing infrastructure.

For example, imagine we have a file which we want to parse with the following information:
```txt
! * * * * * * *
! Welcome to SUPERCODE, version 7.0
...
```

We can parse the program `name` and `version` by matching the texts (see, e.g., [Wikipedia page for Regular expressions, also called _regex_](https://en.wikipedia.org/wiki/Regular_expression)):

```python
from nomad.parsing.file_parser import TextParser, Quantity
from nomad_simulations import Simulation, Program


class SUPERCODEParser:
    """
    Class responsible to populate the NOMAD `archive` from the files given by a
    SUPERCODE simulation.
    """

    def parse(self, filepath, archive, logger):
        output_parser = TextParser(
            quantities=[
                Quantity('program_version', r'version *([\d\.]+) *', repeats=False)
            ]
        )
        output_parser.mainfile = filepath

        simulation = Simulation()
        simulation.program = Program(
            name='SUPERCODE',
            version=output_parser.get('program_version'),
        )
        # append `Simulation` as an `archive.data` section
        archive.data.append(simulation)
```


## `ModelSystem` {#modelsystem}

## `ModelMethod` {#modelmethod}

<div class="click-zoom">
    <label>
        <input type="checkbox">
        <img src="../assets/part2-nomad-simulations/model_method.png" alt="ModelMethod quantities and functions UML diagram." width="80%" title="Click to zoom in">
    </label>
</div>

## `Outputs` {#outputs}