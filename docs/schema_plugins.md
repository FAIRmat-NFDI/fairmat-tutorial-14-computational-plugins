# Part 4 - Extending NOMAD-Simulations to support custom methods and outputs

As you develop your parser, you may find that the `nomad-simulations` package does not include some relevant quantities for your particular use case. You can easily extend upon the schema by adding your own custom schema under the `schema_packages/` directory in your parser plugin. For this, you should utilize and build upon `nomad-simulations` for consistency and future compatibility or integration. Below (click to zoom) is a decision tree which illustrates the schema development process:

<div class="click-zoom">
    <label>
        <input type="checkbox">
        <img src="../assets/schema_plugins/decision_tree.png" alt="Schema extension decision tree." width="80%" title="Click to zoom in">
    </label>
</div>


From this schematic, we can identify 3 distinct uses or extensions of `nomad-simulations`:

1. direct use of existing schema section definitions (no extension)
    - implementation already covered in [Parser Plugins](./parser_plugins.md)

2. semantic extension
    - create classes or sections that refine the context through inheritance from existing sections
    - create brand new sections that widen the scope of the overall schema

3. normalization functionalities
    - the schema normalization functions can be leveraged to perform various tasks, simplifying the code within individual parsers while ensuring consistency and, thus, interoperability


The following demonstrates some simple examples of extending the `nomad-simulations` schema. More detailed documentation about writing schemas packages can be found in [How to write a schema package](https://nomad-lab.eu/prod/v1/docs/howto/plugins/schema_packages.html){:target="_blank"} within the general NOMAD documentation.

To start developing a custom schema, create a python file for your schema, e.g., `<parser_name>_schema.py`, within your parser plugin project, under `schema_packages/`.

Add the following imports to this file:

```python
import numpy as np
import nomad_simulations
from nomad.metainfo import Quantity, SubSection
```

[`SubSection`](https://nomad-lab.eu/prod/v1/docs/reference/glossary.html#section-and-subsection){:target="_blank"} and [`Quantity`](https://nomad-lab.eu/prod/v1/docs/reference/glossary.html#quantity){:target="_blank"} are classes used to populate each section with specific metadata as demonstrated below.

??? note "ArchiveSection"
    All classes in `NOMAD` and `nomad-simulations` inherit from the most abstract class, `ArchiveSection`. This class is using the functionalities defined for a section in NOMAD, which is defined in `MSection`, as well as adding the `normalize()` function. This class function or method is important, as it is executed after parsing and allows to leverage several tasks out of parsing (as explained in point 3. above, and in [Part II - Extra: The `normalize()` class function](nomad_simulations.md#normalize-function)).

## Extending the overarching simulation metadata

Suppose you are developing a parser for a well-defined schema specified within the HDF5 file format. Importantly, the simulation data is harvested from the original simulation files and mapped into this schema/file format by some researcher. The overarching metadata in this file can be represented as

```
hdf5_schema
    +-- version: Integer[3]
    \-- hdf5_generator
    |    +-- name: String[]
    |    +-- version: String[]
    \-- program
        +-- name: String[]
        +-- version: String[]
```

??? note "HDF5 schema syntax"
    `\-- item` &ndash;
    An object within a group, that is either a dataset or a group. If it is a group itself, the objects within the group are indented by five spaces with respect to the group name.

    `+-- attribute:` &ndash;
    An attribute, that relates either to a group or a dataset.

    `\-- data: <type>[dim1][dim2]` &ndash;
    A dataset with array dimensions dim1 by dim2 and of type <type>, following the HDF5 Datatype classes.


!!! abstract "Assignment 4.1"
    Which quantities within this HDF5 schema can we store using existing sections within `nomad-simulations` and which require the creation of new schema sections? For the quantities that directly use the existing schema, write some code to demonstrate how your parser would populate the archive with this information.

??? success "Solution 4.1"
    The program information can be stored under the existing `Program()` sections within `Simulation()`. However the HDF5 schema `version` and `hdf5_generator` information require some extensions to the schema.

    For populating the program information, the parser code would look something like this (NOTE: the specifics of how to access the HDF5 file is not essential to understand for the purposes here):

    ```python
    import h5py
    from nomad_simulations.schema_packages.general import Simulation, Program

    class ParserName(MatchingParser):

        def parse(
            self,
            mainfile: str,
            archive: EntryArchive,
            logger: BoundLogger,
            child_archives: dict[str, EntryArchive] = None,
        ) -> None:

            h5_data = h5py.File(mainfile, 'r')

            simulation = Simulation()
            simulation.program = Program(
                name=h5_data['program'].attrs['name'],
                version=h5_data['program'].attrs['version']
            )

            archive.data = simulation
    ```

The `hdf_generator` information is referring to a secondary software used to create the HDF5 file, so it makes sense to store this in a section very similar to `Program()`. Let's first take a look at the current `Program()` schema:

```python
from nomad_simulations.general import Program
program = Program()
print(program.m_def.all_quantities)
```

```
{'name': nomad_simulations.general.Program.name:Quantity,
 'datetime': nomad.datamodel.metainfo.basesections.BaseSection.datetime:Quantity,
 'lab_id': nomad.datamodel.metainfo.basesections.BaseSection.lab_id:Quantity,
 'description': nomad.datamodel.metainfo.basesections.BaseSection.description:Quantity,
 'version': nomad_simulations.general.Program.version:Quantity,
 'link': nomad_simulations.general.Program.link:Quantity,
 'version_internal': nomad_simulations.general.Program.version_internal:Quantity,
 'compilation_host': nomad_simulations.general.Program.compilation_host:Quantity}
```

Indeed, this section contains `name` and `version` information, along with other quantities that make sense in the context of a software which generates HDF5 files. So, in this case we can simply reuse this section and add a new subsection to `Simulation()`.

!!! abstract "Assignment 4.2"
    Write down a new section that extends `Simulation()` to include a subsection `hdf_generator` of type `Program()`.

    HINT: Here is how the `program` section is defined within the `BaseSimulation()` section (parent of `Simulation()`) within the `nomad-simulations` package:

    ```python
    class BaseSimulation(Activity):
        ...
        program = SubSection(sub_section=Program.m_def, repeats=False)
    ```

??? success "Solution 4.2"
    We need to add a `Simulation()` section to `schema_packages/<parser_name>_schema.py` that inherits all the quantities and subsections from `nomad-simulation`'s `Simulation()` section, and additionally defines a subsection `hdf_generator`:

    ```python
    import nomad_simulations

    class Simulation(nomad_simulations.schema_packages.general.Simulation):

        hdf5_generator = SubSection(
            sub_section=nomad_simulations.schema_packages.general.Program.m_def
        )
    ```

    The `sub_section` argument of `SubSection` specifies that this new section under `Simulation()` is of type `Program()` and will thus inherit all of its attributes.


    Now we can use this new section within our parser to store the hdf generator information:

    ```python
    from nomad_simulations.schema_packages.general import Program
    from <parse_plugin>.schema_packages.<parser_name>_schema.py import Simulation

    class ParserName(MatchingParser):

        def parse(
            self,
            mainfile: str,
            archive: EntryArchive,
            logger: BoundLogger,
            child_archives: dict[str, EntryArchive] = None,
        ) -> None:

            h5_data = h5py.File(mainfile, 'r')

            simulation = Simulation()
            simulation.hdf5_generator = Program(
                name=h5_data['hdf_generator'].attrs['name'],
                version=h5_data['hdf_generator'].attrs['version']
            )

            archive.data = simulation
    ```

Finally, we need to store the hdf5 schema version.

!!! abstract "Assignment 4.3"
    Add a quantity `hdf5_schema_verion` with the appropriate `type`, `shape`, and `description` to your `Simulation()` class in `schema_packages/<parser_name>_schema.py`.

    HINT: You can browse some existing examples of quantity definitions in the [`nomad-simulations` source code](https://github.com/nomad-coe/nomad-simulations/blob/develop/src/nomad_simulations/schema_packages/numerical_settings.py){:target="_blank"}.


??? success "Solution 4.3"

    ```python
    import nomad_simulations

    class Simulation(nomad_simulations.schema_packages.general.Simulation):

        hdf5_schema_version = Quantity(
            type=np.int32,
            shape=[3],
            description="""
            Specifies the version of the HDF5 schema being followed, using sematic versioning.
            """,
        )
    ```

    Since the HDF5 schema apparently uses [semantic versioning](https://semver.org/){:target="_blank"}, we define the `hdf5_schema_version` quantity as a list of 3 integers to ensure that the user provides the relevant information for this quantity.

    And in the parser:

    ```python
    from <parse_plugin>.schema_packages.<parser_name>_schema.py import Simulation

    class ParserName(MatchingParser):

        def parse(
            self,
            mainfile: str,
            archive: EntryArchive,
            logger: BoundLogger,
            child_archives: dict[str, EntryArchive] = None,
        ) -> None:

            h5_data = h5py.File(mainfile, 'r')

            simulation = Simulation()
            simulation.hdf5_schema_version = h5_data.attrs['version']

            archive.data = simulation
    ```


## Extending the simulation outputs

<!-- For this example, we will use the [`nomad-vasp-parser`](https://github.com/FAIRmat-NFDI/nomad-parser-vasp){:target="_blank"} plugin that was referenced in the [Parser Plugins](./parser_plugins.md) as an example. This plugin is currently under preliminary development. However we have prepared a branch with a minimal implementation for demonstration purposes. This branch follows the method of parsing described in [Parser Plugins > Via Instantiation](./parser_plugins.md#via-instantiation).

To get started, clone the `nomad-vasp-parser` repository and checkout the branch `fairmat-tutorial-14` while creating your own local branch:

```sh
git clone https://github.com/FAIRmat-NFDI/nomad-parser-vasp.git
cd nomad-parser-vasp/
git checkout origin/fairmat-tutorial-14 -b fairmat-tutorial-14
```

Now create a virtual environment and install the plugin (see the `READ.md` for full instructions):

```sh
python3 -m venv .pyenv
source .pyenv/bin/activate
pip install --upgrade pip
pip install -e '.[dev]' --index-url https://gitlab.mpcdf.mpg.de/api/v4/projects/2187/packages/pypi/simple
```


Briefly examine the `VASPXMLPaser()` in `nomad_vasp_parser/parsers/xml_parser.py`. NOTE: This is the same parser version examined in [Parser Plugins > Via Instantiation](./parser_plugins.md#via-instantiation). The current `VASPXMLParser.parse()` function populates the archive with a range of metadata including the program, method, and system data. We can view an example archive by running the parser in the terminal with some test data:

```sh
nomad parse --show-archive `tests/data/vasprun.xml.relax` > archive.parser-test.json
```

The beginning of the archive should be:

```json
{
  "run": [
    {
      "program": {
        "name": "VASP",
        "version": "5.3.2 13Sep12 (build Mar 19 2013 10:46:17) complex serial LinuxIFC",
        "compilation_datetime": 1386262891.0
      },
      "method": [
        {
          "x_vasp_incar_in": {
            "ISTART": 0,
            "PREC": "acc",
            "ALGO": "FAST",
            "ISPIN": 2,
            "NELM": [
              60,
              60
            ],
            ...
          }
        }
      ]
    }
  ]
}
```

Feel free to browse the other populated quantities to get a feel for the archive structure.

Now take another look at the bottom of the `VASPXMLParser.parse()` code in your branch. You will find that 3 energy quantities have been extracted from the xml file and placed into variables: -->

In this example, we will use the fabricated `VasprunXMLParser()` introduced in [Parser Plugins > From Parser to NOMAD > Via Instantiation](./parser_plugins.md#via-instantiation). The `VASPXMLParser.parse()` function populates the archive with a range of metadata including the program, method, and system data, but no outputs. Imagine that within `VasprunXMLParser.parse()` we use `xml_get()` function to extract the following energy information from the VASP output file (NOTE: the `xml_get` functionality is not important for the example):

```python
total_energy = xml_get("i[@name='e_fr_energy']", slice(-2, -1))
hartreedc = xml_get("i[@name='hartreedc']", slice(-2, -1))
xcdc = xml_get("i[@name='XCdc']", slice(-2, -1))


```

There already exists a section for total energy within `nomad-simulations`:

```python
class BaseEnergy(PhysicalProperty):
    """
    Abstract class used to define a common `value` quantity with the appropriate units
    for different types of energies, which avoids repeating the definitions for each
    energy class.
    """

    value = Quantity(
        type=np.float64,
        unit='joule',
        description="""
        """,
    )

    def normalize(self, archive: 'EntryArchive', logger: 'BoundLogger') -> None:
        super().normalize(archive, logger)

class EnergyContribution(BaseEnergy, PropertyContribution):
    ...

class TotalEnergy(BaseEnergy):
    """
    The total energy of a system. `contributions` specify individual energetic
    contributions to the `TotalEnergy`.
    """

    contributions = SubSection(sub_section=EnergyContribution.m_def, repeats=True)

    def __init__(
        self, m_def: 'Section' = None, m_context: 'Context' = None, **kwargs
    ) -> None:
        super().__init__(m_def, m_context, **kwargs)
        self.name = self.m_def.name

    def normalize(self, archive: 'EntryArchive', logger: 'BoundLogger') -> None:
        super().normalize(archive, logger)
```

The `BaseEnergy` section simply defines a `PhysicalProperty` with the appropriate units for its `value`. Total energy also contains a subsection `contributions` where other energies contributing to the total energy can be stored. These contribution are of type `EnergyContributions`. In short, this is a section that enables the linking of these energy contributions to specific components of the corresponding method. However, this is not important for the present example.

!!! abstract "Assignment 4.4"
    The parsed hartreedc and xcdc energies are both classified as "double-counting energies". Add 3 new sections in `schema_packages/vasp_parser_schema.py`: one for each of the parsed energies and then an additional abstract class that each of these energy sections inherits from.

??? success "Solution 4.4"

    ```python
    from nomad_simulations.schema_packages.outputs import Outputs
    from nomad_simulations.schema_packages.properties.energies import EnergyContribution

    class DoubleCountingEnergy(EnergyContribution):

        type = Quantity(
            type=MEnum('double_counting'),
        )

        def normalize(self, archive: 'EntryArchive', logger: 'BoundLogger') -> None:
            super().normalize(archive, logger)

            if not self.type:
                self.type = 'double_counting'

    class HartreeDCEnergy(DoubleCountingEnergy):

        def normalize(self, archive: 'EntryArchive', logger: 'BoundLogger') -> None:
            super().normalize(archive, logger)


    class XCdcEnergy(DoubleCountingEnergy):

        def normalize(self, archive: 'EntryArchive', logger: 'BoundLogger') -> None:
            super().normalize(archive, logger)
    ```

    `DoubleCountingEnergy` inherits from `EnergyContribution` so that we can add each of the parsed energies to `total_energy.contributions`. Then each of the newly defined specific energy sections inherits from `DoubleCountingEnergy`.

    We can go one step further and utilize the normalization function of the `DoubleCountingEnergy` section to set the `type` quantity of the `PhysicalProperty()` section as a characterization for each of the child sections. We have also overwritten the `type` quantity to be an `MEnum('double_counting')`, which will trigger an error to be thrown if the parser sets `energy_class.type` to anything other than `double_counting` for any section that inherits from `DoubleCountingEnergy`.

    NOTE: In practice we also need to add detailed descriptions for each section!


The normalization function within each schema section definition allows us to perform consistent operations when particular sections are instantiated or particular quantities are set. This removes complexity from individual parsers and ensures consistency and, thus, interoperability.

!!! abstract "Assignment 4.5"
    Implement a new section for total energy which extends the `nomad-simulations`' `TotalEnergy()` section to include a normalization function that: 1. calculates the difference between the total energy and each of its contributions, and 2. stores this remainder contribution as an additional contribution to the total energy. Make sure that your function has appropriate checks to cover cases where quantities or subsections are not populated. Don't forget to create the appropriate section for the new type of energy contribution.

??? success "Solution 4.5"

    ```python
    from nomad_simulations.schema_packages.outputs import Outputs
    from nomad_simulations.schema_packages.properties.energies import EnergyContribution

    class UnknownEnergy(EnergyContribution):

        def normalize(self, archive: 'EntryArchive', logger: 'BoundLogger') -> None:
            super().normalize(archive, logger)


    class TotalEnergy(nomad_simulations.schema_packages.properties.TotalEnergy):

        def normalize(self, archive: 'EntryArchive', logger: 'BoundLogger') -> None:
            super().normalize(archive, logger)

            if not self.value:
                return
            if not self.contributions:
                return

            value = self.value
            unknown_energy_exists = False
            for contribution in self.contributions:
                if not contribution.value:
                    continue
                if contribution.name == 'UnknownEnergy':
                    unknown_energy_exists = True

                value -= contribution.value
            if not unknown_energy_exists:
                self.contributions.append(UnknownEnergy(value=value))
    ```

!!! abstract "Assignment 4.6"
    <!-- Now add the appropriate code to the vasp parser to populate each of the parsed energies. Run the parser and check that the total energy contributions contains `UnknownEnergy`. -->
    Now write the appropriate code for the `VasprunXMLParser()` to populate each of the parsed energies.

??? success "Solution 4.6"

    ```python
    from nomad_simulations.schema_packages.outputs import Outputs
    from nomad_simulations.schema_packages.properties.energies import BaseEnergy
    from nomad_parser_vasp.schema_packages.vasp_schema_extension.py import (
        TotalEnergy,
        HartreeDCEnergy,
        XCdcEnergy
    )

    class VasprunXMLParser(MatchingParser):
        convert_xc: dict[str, str] = {
            '--': 'GGA_XC_PBE',
            'PE': 'GGA_XC_PBE',
        }

        def parse(
            self,
            mainfile: str,
            archive: EntryArchive,
            logger: BoundLogger,
            child_archives: dict[str, EntryArchive] = None,
        ) -> None:
            logger.info('VasprunXMLParser.parse', parameter=configuration.parameter)
            xml_reader = XMLParser(mainfile=mainfile)  # XPath syntax

            def xml_get(path: str, slicer=slice(0, 1), fallback=None):
                try:
                    return xml_reader.parse(path)._results[path][slicer]
                except KeyError:
                    return fallback

            ...
            ...

            total_energy = xml_get("i[@name='e_fr_energy']", slice(-2, -1))
            hartreedc = xml_get("i[@name='hartreedc']", slice(-2, -1))
            xcdc = xml_get("i[@name='XCdc']", slice(-2, -1))

            output = Outputs()
            archive.simulation.outputs.append(output)
            output.total_energy.append(TotalEnergy())

            output.total_energy[0].contributions.append(HartreeDCEnergy(value=total_energy * ureg.eV))
            output.total_energy[0].contributions.append(XCdcEnergy(value=total_energy * ureg.eV))
    ```

    Notice that we do not need to import or set anything related to `UnknownEnergy`. This will be taken care of automatically by the normalizer that we have implemented in `TotalEnergy()`.








