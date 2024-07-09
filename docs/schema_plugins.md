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
    from nomad_simulations.schema_packages/<parser_name>_schema.py import Simulation

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

We could simply add a string quantity to `Simulation()`, however since the h5md schema uses [semantic versioning](https://semver.org/){:target="_blank"}, we could store this as a list of 3 integers to ensure that the user provides the relevant information for this quantity. In `schema_packages/<parser_name>_schema.py`:

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
            Specifies the version of the h5md schema being followed.
            """,
        )
    ```

    And in the parser:

    ```python
    from nomad_simulations.schema_packages/<parser_name>_schema.py import Simulation

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
    ```


## Extending the simulation outputs


```python
from nomad_simulations.schema_packages.outputs import Outputs
from nomad_simulations.schema_packages.properties.energies import BaseEnergy

class DoubleCountingEnergy(BaseEnergy):
    value = Quantity(
        type=np.dtype(np.float64),
        unit='eV',
    )

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

class RestEnergy(BaseEnergy):

    def normalize(self, archive: 'EntryArchive', logger: 'BoundLogger') -> None:
        super().normalize(archive, logger)


class TotalEnergy(nomad_simulations.schema_packages.properties.TotalEnergy):

    def normalize(self, archive: 'EntryArchive', logger: 'BoundLogger') -> None:
        super().normalize(archive, logger)

        if self.total_energy:
            for total_energy in self.total_energy:
                if total_energy.value and total_energy.contributions:
                    value = total_energy.value
                    for contribution in total_energy.contributions:
                        value -= contribution.value
                    total_energy.rest_energy.append(RestEnergy(value=value))

class Outputs(Outputs):

    # add a new section for the custom output
    hartreedc = SubSection(
        sub_section=HartreeDCEnergy.m_def,
        repeats=True,
    )

    xcdc = SubSection(
        sub_section=XCdcEnergy.m_def,
        repeats=True,
    )
```



```python
from nomad_simulations.schema_packages.outputs import Outputs
from nomad_simulations.schema_packages.properties.energies import BaseEnergy


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


        total_energy = xml_get(<path to total energy>)
        hartreedc = xml_get(<path to hartreedc energy>)
        xcdc = xml_get(<path to xcdc energy>)

        simulation = Simulation()
        output = Outputs()
        simulation.outputs.append(output)
        output.total_energy.append(TotalEnergy())

        output.total_energy[0].contributions.append(HartreeDCEnergy(value=total_energy * ureg.eV))
        output.total_energy[0].contributions.append(XCdcEnergy(value=total_energy * ureg.eV))
```








