# Extending NOMAD-Simulations to support custom methods and outputs

As you develop your parser, you may find that the `nomad-simulations` package does not include some relevant quantities for your particular use case. You can easily extend upon the schema by adding your own custom schema under the `schema_packages/` directory in your parser plugin. For this, you should utilize and build upon `nomad-simulations` for consistency and future compatibility or integration. Below (click to zoom) is a decision tree which illustrates the schema development process:

<div class="click-zoom">
    <label>
        <input type="checkbox">
        <img src="../assets/schema_plugins/decision_tree.png" alt="Schema extension decision tree." width="80%" title="Click to zoom in">
    </label>
</div>


different types of extensions

- reuse (no extension)

- semantic extension

- normalization extension



The following demonstrates some simple examples of extending the `nomad-simulations` schema. More detailed documentation about writing schemas packages can be found in [How to write a schema package](https://nomad-lab.eu/prod/v1/docs/howto/plugins/schema_packages.html){:target="_blank"} within the general NOMAD documentation.

To start developing a custom schema, create a python file for your schema, e.g., `<parser_name>_schema.py`, within your parser plugin project, under `schema_packages/`, .

Add the following imports to this file:

```python
import numpy as np
import nomad_simulations
from nomad.datamodel.data import ArchiveSection
from nomad.metainfo import Quantity, SubSection
```

The `ArchiveSection` class should be inherited by every class defined in your schema and provides the base NOMAD functionalities, e.g., normalization function capabilities. [`SubSections`](https://nomad-lab.eu/prod/v1/docs/reference/glossary.html#section-and-subsection){:target="_blank"} and [`Quantities`](https://nomad-lab.eu/prod/v1/docs/reference/glossary.html#quantity){:target="_blank"} are then used to populate each `ArchiveSection` class with specific metadata as demonstrated below.

## Extending the overarching simulation metadata

Suppose you are developing a parser for a well-defined schema specified within the hdf5 file format. Importantly, the simulation data is harvested from the original simulation files and mapped into this schema/file format by some researcher. The overarching metadata in this file can be represented as

```
hdf5_schema
    +-- version: Integer[3]
    \-- author
    |    +-- name: String[]
    |    +-- (email: String[])
    \-- hdf5_generator
    |    +-- name: String[]
    |    +-- version: String[]
    \-- program
        +-- name: String[]
        +-- version: String[]
```

!!! note "hdf5 schema syntax"
    `\-- item` &ndash;
    An object within a group, that is either a dataset or a group. If it is a group itself, the objects within the group are indented by five spaces with respect to the group name.

    `+-- attribute:` -
    An attribute, that relates either to a group or a dataset.

    `\-- data: <type>[dim1][dim2]` -
    A dataset with array dimensions dim1 by dim2 and of type <type>, following the HDF5 Datatype classes.


!!! abstract "Assignment 4.1"
    Which quantities within this hdf5 schema can we store using existing classes within `nomad-simulations` and which require the creation of new schema classes? For the quantities that directly use the existing schema, write some code to demonstrate how your parser would populate the archive with this information.

??? success "Solution 4.1"
    The program information can be stored under the existing `Program()` class within `Simulation()`. However the hdf5 schema `version` and `hdf5_generator` information require some extensions to the schema.

    For populating the program information, the parser code would look something like this (NOTE: the specifics of how to access the hdf5 file is not essential to understand for the purposes here):

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

The `hdf_generator` information is referring to a secondary software used to create the hdf5 file, so it makes sense to store this in a class very similar to `Program()`. Let's first take a look at the current `Program()` schema:

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

Indeed, this class contains `name` and `version` information, along with other quantities that make sense in the context of a software which generates hdf5 files. So, in this case we can simply reuse this class and add a new subsection to `Simulation()`.

!!! abstract "Assignment 4.2"
    Write down a new class that extends `Simulation()` to include a subsection `hdf_generator` of type `Program()`.

    HINT: Here is how the `program` section is defined within the `BaseSimulation()` class (parent of `Simulation()`) of `nomad-simulations`:

    ```python
    class BaseSimulation(Activity):
    """
    """

        program = SubSection(sub_section=Program.m_def, repeats=False)
    ```

??? success "Solution 4.2"
    We need to add a `Simulation()` class to `schema_packages/<parser_name>_schema.py` that inherits all the quantities and subsections from `nomad-simulation`'s `Simulation()` class, and additionally defines a subsection `hdf_generator`:

    ```python
    class Simulation(nomad_simulations.schema_packages.general.Simulation):

        h5md_generator = SubSection(
            sub_section=nomad_simulations.schema_packages.general.Program.m_def
        )
    ```

    The `sub_section` argument of `SubSection` specifies that this new section under `Simulation()` is of type `Program()` and will thus inherit all of its attributes.


    Now we can use this new class within our parser to store the hdf generator information:

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
            simulation.h5md_generator = Program(
                name=h5_data['hdf_generator'].attrs['name'],
                version=h5_data['hdf_generator'].attrs['version']
            )

            archive.data = simulation
    ```

Finally, we need to store the h5md schema version.

!!! abstract "Assignment 4.3"
    Add a quantity `hdf5_schema_verion` with the appropriate `type`, `shape`, and `description` to your `Simulation()` class in `schema_packages/<parser_name>_schema.py`.

    HINT: You can browse some existing examples of quantity definitions in the [`nomad-simulations` source code](https://github.com/nomad-coe/nomad-simulations/blob/develop/src/nomad_simulations/schema_packages/numerical_settings.py){:target="_blank"}.


??? success "Solution 4.3"

    ```python
    class Simulation(nomad_simulations.schema_packages.general.Simulation):

        hdf5_schema_version = Quantity(
            type=np.dtype(np.int32),
            shape=[3],
            description="""
            Specifies the version of the hdf5 schema being followed, using sematic versioning.
            """,
        )
    ```

    Since the hdf5 schema appears to use [semantic versioning](https://semver.org/){:target="_blank"}, we define the `hdf5_schema_version` quantity as a list of 3 integers to ensure that the user provides the relevant information for this quantity.

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

For this example, we will use the [`nomad-vasp-parser`](https://github.com/FAIRmat-NFDI/nomad-parser-vasp){:target="_blank"} plugin that was referenced in the [parser plugins](./parser_plugins.md) as an example. This plugin is currently under preliminary development. However we have prepared a branch with a minimal implementation for demonstration purposes. This branch follows the method of parsing described in [parser plugins > via instantiation](./parser_plugins.md#via-instantiation).

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
TODO install nomad-simulations??

Briefly examine the `VASPXMLPaser()` in `nomad_vasp_parser/parsers/xml_parser.py`. NOTE: This is the same parser version examined in [parser plugins > via instantiation](./parser_plugins.md#via-instantiation). The current `VASPXMLParser.parse()` function populates the archive with a range of metadata including the program, method, and system data. We can view an example archive by running the parser in the terminal with some test data:

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

Now take another look at the bottom of the `VASPXMLParser.parse()` code in your branch. You will find that 3 energy quantities have been extracted from the xml file and placed into variables:

```python
total_energy = xml_get(<path to total energy>)
hartreedc = xml_get(<path to hartreedc energy>)
xcdc = xml_get(<path to xcdc energy>)
```

There already exists a class for total energy within `nomad-simulations`:

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

The class `BaseEnergy` simply defines a `PhysicalProperty` with the appropriate units for its `value`. Total energy also contains a subsection `contributions` where other energies contributing to the total energy can be stored. These contribution are of type `EnergyContributions`. In short, this is a class that enables the linking of these energy contributions to specific components of the corresponding method. However, this is not important for the present example.

!!! abstract "Assignment 4.4"
    The parsed hartreedc and xcdc energies are both classified as "double-counting energies". Add 3 new classes in `schema_packages/<parser_name>_schema.py`: one for each of the parsed energies and then an additional abstract class that each of these energy classes inherits from.

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

    `DoubleCountingEnergy` should inherit from `EnergyContribution` so that we can add each of the parsed energies under `total_energy.contributions`. Then each of the newly defined specific energy classes inherit from `DoubleCountingEnergy`. We can go one step further and utilize the normalization function of the `DoubleCountingEnergy` class to set the `type` quantity of the `PhysicalProperty()` class as a characterization for each of the child classes. We have also overwritten the `type` quantity to be an `MEnum('double_counting`)`, which will cause an error to be thrown if the parser sets `energy_class.type` to anything other than `double_counting` for any class that inherits from `DoubleCountingEnergy`.

    NOTE: In practice we also need to add detailed descriptions for each class!


The normalization function within each schema class allows us to perform consistent operations when particular classes are instantiated or particular quantities are set. This removes complexity from individual parsers and ensures consistency and, thus, interoperability.

!!! abstract "Assignment 4.4"
    Implement a new class for total energy which extends the `nomad-simulations`' class to include a normalization function that: 1. calculates the difference between the total energy and each of its contributions, and 2. stores this remainder contribution as an additional contribution to the total energy. Make sure that your function has appropriate checks to cover cases where quantities or subsections are not populated. Don't forget to create the appropriate class for this new contribution.

??? success "Solution 4.4"

    ```python
    from nomad_simulations.schema_packages.outputs import Outputs
    from nomad_simulations.schema_packages.properties.energies import EnergyContribution

    class UnknownEnergy(EnergyContribution):

        def normalize(self, archive: 'EntryArchive', logger: 'BoundLogger') -> None:
            super().normalize(archive, logger)


    class TotalEnergy(nomad_simulations.schema_packages.properties.TotalEnergy):

        def normalize(self, archive: 'EntryArchive', logger: 'BoundLogger') -> None:
            super().normalize(archive, logger)

            if self.total_energy:
                for total_energy in self.total_energy:
                    if not total_energy.value:
                        return
                    if not total_energy.contributions:
                        return

                    value = total_energy.value
                    unknown_energy_exists = False
                    for contribution in total_energy.contributions:
                        value -= contribution.value
                        if contribution.name == 'UnknownEnergy':
                            unknown_energy_exists = True
                    total_energy.rest_energy.append(UnkownEnergy(value=value))
    ```

!!! abstract "Assignment 4.5"
    Now add the appropriate code to the vasp parser to populate each of the parsed energies. Run the parser and check that the total energy contributions contains `UnknownEnergy`.

??? success "Solution 4.4"

    ```python
    from nomad_simulations.schema_packages.outputs import Outputs
    from nomad_simulations.schema_packages.properties.energies import BaseEnergy
    from nomad_parser_vasp.schema_packages.vasp_schema_extension.py import (
        TotalEnergy,
        UnknownEnergy,
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

            total_energy = xml_get(<path to total energy>)
            hartreedc = xml_get(<path to hartreedc energy>)
            xcdc = xml_get(<path to xcdc energy>)

            output = Outputs()
            archive.simulation.outputs.append(output)
            output.total_energy.append(TotalEnergy())

            output.total_energy[0].contributions.append(HartreeDCEnergy(value=total_energy * ureg.eV))
            output.total_energy[0].contributions.append(XCdcEnergy(value=total_energy * ureg.eV))
        ```








