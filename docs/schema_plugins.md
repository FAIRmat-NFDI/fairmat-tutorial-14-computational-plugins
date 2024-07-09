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

## Extending the overarching metadata

Suppose you are developing a parser for a well-defined schema specified within the hdf5 file format. Importantly, the simulation data is harvested from the original simulation files and mapped into this schema/file format by some researcher. The overarching metadata in this file can be represented

```
hdf5_schema
    +-- version: Integer[2]
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

For demonstration purposed, let's assume that your parser grabs this information and stores it in the following dictionary:

```python
hdf_dict = {
'version': <x.x.x>,
'author': {
    'name': <author name of the person who created the hdf5 file>,
    'email': <author email of the person who created the hdf5 file>
},
'hdf5_generator': {
    'name': <name of software used to write hdf5 file>,
    'version': <version of the software used to write the hdf5 file>
},
'program': {
    'name': <name of the program used to run the simulation that generated the data>,
    'version': <version of the program used to run the simulation that generated the data>
},
}
```

!!! abstract "Assignment 4.1"
    Using what you have already learned, how would you store the program information within the archive object in your parser?

??? success "Solution 4.1"
    The program information can be stored under the existing `Program()` class within `nomad-simulations`. We already learned how to implement this in our parser:

    ```python
    from nomad_simulations.schema_packages.general import Simulation, Program

    simulation = Simulation()
    simulation.program = Program(
        name=h5md_dict.get('program', {}).get('name', {}),
        version=h5md_dict.get('program', {}).get('version', {}),
    )
    archive.data = simulation
    ```

 However, we need to create a new class for the rest of the metadata. The "creator" information is referring to a secondary software used to create the hdf5 file, so it makes sense to store this in a class very similar to `Program()`. Let's first take a look at the current `Program()` schema:

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

 Indeed, this class contains `name` and `version` information, along with other quantities that make sense in the context of the H5MD-NOMAD creator. So, in this case we can simply reuse this class. We need to simply add a new section within the `Simulation()` class for the H5MD-NOMAD file creator that is of type `Program()`. In `schema_packages/<parser_name>_schema.py`:

 ```python
class Simulation(nomad_simulations.schema_packages.general.Simulation):

    x_h5md_creator = SubSection(
        sub_section=nomad_simulations.schema_packages.general.Program.m_def
    )
```

Here, we create a new class called `Simulation()` that inherits from `Simulation()` from `nomad-simulations` while adding the additional `x_h5md_creator` section of type `Program()`. Note that the `x_<program_name>_<quantity_name>` notation is our standard notation for specifying program-specific quantities that are not necessarily generalizable.

Now we can use this new class within our parser to store the creator information:

```python
from nomad_simulations.schema_packages.general import Program
from nomad_simulations.schema_packages/<parser_name>_schema.py import Simulation

simulation = Simulation()
simulation.x_h5md_creator = Program(
    name=group_h5md_dict.get('h5md_creator_name'),
    version=group_h5md_dict.get('h5md_creator_version'),
)
```

We now need to extend the schema further to store the h5md-nomad author information. For this, let's make a new class with `name` and `email` quantities in `schema_packages/<parser_name>_schema.py`:

```python
class Author(ArchiveSection):
    """
    Contains the specifications of the program.
    """

    name = Quantity(
        type=str,
        shape=[],
        description="""
        Specifies the name of the author who generated the h5md file.
        """,
    )

    email = Quantity(
        type=str,
        shape=[],
        description="""
        Author's email.
        """,
    )
```

Again, we need to add this to our custom `Simulation()` class:

 ```python
class Simulation(nomad_simulations.schema_packages.general.Simulation):

    x_h5md_creator = SubSection(
        sub_section=nomad_simulations.schema_packages.general.Program.m_def
    )

    x_h5md_author = SubSection(sub_section=Author.m_def)
```

And, in our parser:

```python
from nomad_simulations.schema_packages/<parser_name>_schema.py import Simulation, Author

simulation = Simulation()
simulation.x_h5md_author = Author(
    name=group_h5md_dict.get('h5md_author_name'),
    email=group_h5md_dict.get('h5md_author_email'),
)

```

Finally, we need to store the h5md-nomad schema version. We could simply add a string quantity to `Simulation()`, however since the h5md schema uses semantic versioning, we could store this as a list of 3 integers to ensure that the user provides the relevant information for this quantity. In `schema_packages/<parser_name>_schema.py`:


 ```python
class Simulation(nomad_simulations.schema_packages.general.Simulation):

    x_h5md_creator = SubSection(
        sub_section=nomad_simulations.schema_packages.general.Program.m_def
    )

    x_h5md_author = SubSection(sub_section=Author.m_def)

    x_h5md_version = Quantity(
        type=np.dtype(np.int32),
        shape=[3],
        description="""
        Specifies the version of the h5md schema being followed.
        """,
    )
```

And in the parser:

```python
from nomad_simulations.schema_packages/<parser_name>_schema.py import Simulation, Author

simulation = Simulation()
simulation.x_h5md_version = group_h5md_dict.get('h5md_version')
```


Now, imagine that your simulation outputs some observable that is not yet defined within `nomad-simulations`. We can easily extend the schema following the approach from above (in `schema_packages/<parser_name>_schema.py`):

```python
class Stress(nomad_simulations.schema_packages.physical_property.PhysicalProperty):
    """
    Here you should give a detailed description of this property.
    """

    value = Quantity(
        type=np.dtype(np.float64),
        unit='newton',
    )

class Outputs(nomad_simulations.schema_packages.outputs.Outputs):


    stress = SubSection(
        sub_section=Stress.m_def,
        repeats=True,
    )
```

And in the parser:


```python
from nomad_simulations.schema_packages/<parser_name>_schema.py import Outputs, Stress
from nomad.units import ureg

output = Outputs()
simulation.outputs.append(output)
output.stress.append(
  Stress(value=<value_from_file_parsing> * ureg.newton)
)
```














