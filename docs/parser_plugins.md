# Creating Parser Plugins from Scratch

One of NOMAD's most recognized features is drag-and-drop parsing. The NOMAD parsers, which automate the conversion of raw simulation files into the standardized NOMAD format, significantly offload the burden of data annotation from researchers, reducing their data management responsibilities while also improving the accessibility of their data.

### Getting Started

To create your own parser plugin, visit our [plugin template](https://github.com/FAIRmat-NFDI/nomad-plugin-template) and click the “Use this template” button.
Follow the [How to get started with plugins](https://nomad-lab.eu/prod/v1/staging/docs/howto/plugins/plugins.html) documentation for detailed setup instructions.
The template will appear bare-bones at the start.
Following the instructions in the `README.md`  and the `cruft` setup will allow you to tune the project to your needs.

By the end, your repository should look like the example below.
Make sure to include both a `parsers` and a `schema_packages` folder.
Each file parser under `parsers` gets its own `.py` file.
For schemas, one file typically suffices, unless you want to heavily extend them (see [Extending NOMAD-Simulations](schema_plugins.md)).
Note that `myparser.py` and `mypackage.py` just act as a blueprints.
They should not be edited or exposed directly.

The `README.md` should remain a copy of the template, in case anyone wants to fork the project.
Instead, place plugin descriptions in the entry points or GitHub repository metadata.
More elaborate explanations should go under `docs`.
You can deploy them on GitHub or locally via `mkdocs`.
Lastly, NOMAD uses the Apache 2.0 license (option 4 in the `cruft` setup).
Please select the same license for maximal legal compatibility.

```bash
├── nomad-plugin-parser
│   ├── src
|   │   ├── nomad_plugin_parser
|   |   │   ├── parsers
|   |   │   │   ├── myparser.py  "(target functionality)"
|   |   │   │   ├── __init__.py  "(entry point)"
|   |   │   ├── schema_packages
|   |   │   │   ├── mypackage.py
|   |   │   │   ├── __init__.py
│   ├── docs
│   ├── tests
│   ├── pyproject.toml           "(module setup file)"
│   ├── LICENSE.txt
│   ├── README.md
-------------------------------------------------------------
├── nomad.yaml                   "(NOMAD configuration file)"
```

This examples also highlights the files containing _entry point_ information between parentheses.
They are explained in greater detail in section [[Extra: Managing Entry Points]].
For now, it suffices to understand them as the official mechanism for `pip` installing modules.
The dependence runs bottom up, i.e. the `module setup file` refers to `entry point` that refers to `target functionality`.

The final entry point piece (`NOMAD configuration file`) resides in `nomad.yaml` and refers back to the `module setup file`.
Normally, you don't have to touch anything there for NOMAD to pick up on your parser.
It does allows you to control the loading of plugins and their options.
Closing the "dependence" cycle, `myparser.py` has to read in these options.

## Fundamentals of Parsing

As parsing involves the mapping between two well-defined formats, one could expect it to be trivial.
In practice, however, parser developers have to manage discrepancies in semantics, shape, data type or units.
This has lead to five distinct categories of responsibility for the developer to manage.
Here, they are ordered to match the parser's execution:

1. **file selection** - navigate the upload's folder structure and select the relevant files.
2. **source extraction** - read the files into Python. This step may already include some level of data field filtering.
3. **source to target** - map the data of interest with their counterparts in the target/NOMAD schema. This is where the bulk of the filtering happens.
4. **data mangling** - manipulate the data to match the target/NOMAD `Quantity`s' specification, e.g. dimensionality, shape. This may include computing derived properties not present in the original source files.
5. **archive construction** - build up a Python `EntryArchive` object using the classes provided by the target/NOMAD schema. NOMAD will automatically write it commit it to the database as an `archive.json`

Blurring these responsibilities leads to a wild-growth in parser design and added complexity, especially in larger, more feature-rich parsers.
NOMAD therefore offers powerful _tools_ and documentation on _best practices_ to help the parser developer manage each distinct responsibility.
The exact solutions are, in the same order:

1. `MatchingParser` - This class passes the file contents on to the parser class, which extends it via inheritance. Since it interfaces with the NOMAD base directly, it will read most of the settings automatically in from there. Options may be tweaked via the entry-steps mechanism. 
2. `XMLParser` and co. / `TextParser` - There are several _reader classes_ for loading common source formats into Python data types. Examples include the `XMLParser` and `HDF5Parser`. We will demonstrate `XMLParser` in [[Parsing Hierarchical Tree Formats]]. Plain text files, meanwhile, involve an additional _matching step_ via the `TextParser`. More on this in [[From Text to Hierarchies]].
3. `MappingAnnotationModel` - This is arguably the most involved part for the parser developer, as this is where the external data gets further semantically enriched and standardized. It requires doamin expertise to understand the relationship between the data fields in the source file and the [NOMAD-Simulations schema](nomad_simulations.md). If step 2 went well, this step only involves _annotating_ the target schema via `MappingAnnotationModel`. More on this in [[Parsing Hierarchical Tree Formats]].
4. [NOMAD-Simulations schema](nomad_simulations.md) / `MappingAnnotationModel` - The `MSection`s and `utils.py` in the schema provide _normalizers_ and _helper functions_ to alleviate most of the data mangling. For small amendments*, use `MappingAnnotationModel.operator`. For larger ones, consider extending the schema as covered in [Extending NOMAD-Simulations](schema_plugins.md).
5. `MetainfoParser` - this _converter_ bridges the annotated schema from step 3 with the reader classes in step 2. `MetainfoParser.data_object` contains the final `ArchiveSection` that is stored under `archive.data`.

In the next section, we will briefly illustrate how `MatchingParser`, `XMLParser`, and `MetainfoParser` interconnect, as well as flesh out some setup details.

## Assembling a Parser Class

Let us investigate the VASP parser for the XML output as an example.
The parser code would be placed in `src/nomad_parser_vasp/parsers/xml_parser.py` and looks like:

```python
from structlog.stdlib import BoundLogger
from nomad.datamodel.datamodel import EntryArchive
from nomad.config import config
from nomad.parsing import MatchingParser
from nomad.parsing.file_parser.mapping_parser import MetainfoParser, XMLParser
from nomad_parser_vasp.schema_packages.vasp_schema import Simulation

configuration = config.get_plugin_entry_point(
    'nomad_parser_vasp.parsers:xml_entry_point'
)

class VasprunXMLParser(MatchingParser):
    def parse(
        self, mainfile: str, archive: EntryArchive, logger: BoundLogger,
        child_archives: dict[str, EntryArchive] = None,
    ) -> None:
        logger.info('VasprunXMLParser.parse', parameter=configuration.parameter)
        data_parser = MetainfoParser(annotation_key='xml', data_object=Simulation())
        XMLParser(filepath=mainfile).convert(data_parser)
        archive.data = data_parser.data_object
```

This is all of the code!
Leveraging `MappingAnnotationModel` clearly makes parsers more concise.
Breaking down the parser class, `VasprunXMLParser`, it inherits most functionality from `MatchingParser`, including `parse`.
The `parse` interface is rigid -represents a contract between the NOMAD base and the parser- and is worth studying a bit:

- `mainfile`: NOMAD scans the upload folder for files representative of the code. Based on the hits, it will then delegate these files to their parser. The filename or header patterns are set in xxxx and xxxx.
- `archive`: this is a (typically empty) storage object for an entry. It will later be serialized into an `archive.json` file by NOMAD for permanent storage.
- `logger`: each entry will have a log associated with it. These communicate info or warnings about the process, but also debugging info and (critical) errors for tracing bugs. Include the latter when contacting us regarding any processing issues.

%% Don't know much about `child_archives`...

Next, going over the contents in `parse`, line-by-line:

 - The logger is set up to report any bugs stemming from this code as `VasprunXMLParser.parse`. Note how you can further customize reporting via the entry point. The details here go beyond this tutorial's scope.
 - The `MetainfoParser` is linked to the annotated schema. A single schema may contain multiple annotations corresponding to various file formats, e.g. `xml`, `hdf5`, `txt` for VASP. Since we are dealing with computational data, we provide the `Simulation` object as the root of our target.
 - `XMLParser` performs the actual reading of `mainfile`, as well as mapping to the target schema. The schema object itself is overwritten, while `convert` just returns `None`. %% Is normalization automatically triggered here?
 - Finally, the processed data in the `Simulation` object is stored in the `data` section. You are not permitted to change the storage destination. At best, you may repeat these steps to connect legacy parsers to `run`.  %% TODO: what about results?


## From Hierarchies to Schema

We conceptualize format conversion as restructuring a _hierarchical data tree_, formally known as a _directed acyclic graph_.
The restructuring may then be defined in terms of lining up source with target nodes.
The only missing component then are the mappings themselves.

Since we have full control over our own schema, we will annotate the mappings there.
The only relevant nodes are `ArchiveSection` attributes like `Quantity` (i.e. leaf nodes) or `SubSection` (i.e. branching nodes).
Adding annotations then is as simple as extending a dictionary: `<section_name>.<attribute_name>.m_annotations[<tag_name>] = MappingAnnotationModel(...)`.

The overall strategy is thus to annotate `path` mappings starting from `Simulation` and run over each `SubSection` up until reaching the corresponding `Quantity`.
The most important part is for the target/NOMAD path to be fully traceable:
any disconnections in a `path` will cut it out of the `archive`.

For VASP, the `src/nomad_parser_vasp/schema_packages/` file will thus look something like the following.
Note how you can trace continuous a path down to `simulation.program.name`.
The mixing of multiple extension annotations (`xml` and `hdf5`), also shows at a glance how much both formats compare.

%% TODO: extend example + add hdf5

```python
from nomad_simulations.schema_packages.general import Simulation, Program

Simulation.m_def.m_annotations['xml'] = MappingAnnotationModel(path='modeling')

Simulation.program.m_annotations['xml'] = MappingAnnotationModel(path='.generator')

Program.name.m_annotations['xml'] = MappingAnnotationModel(path='.i[?"@name"="program"]')
```

Many more approaches are at play in this example.
Their discussion is too technical for the main thread of this tutorial, however.
If you are interested, check out the subsections below who's title starts with "Extra". 

### Extra: exploring Mapping Annotations

`MappingAnnotationModel` itself accepts one of two argument keys:

- `path`: specifies the node sequence leading up to the source node of interest. It leverages the [JMESPath DSL](https://jmespath.org/) for this, though other languages may be incorporated here in the future.
- `operator`: the more active counterpart to `path`. Inserts a function (name in string format) between the source and target nodes. Source data are passed along in an array of `path`s matching the positional arguments, similar to Python `*args`.

Operators, are the main tool for the parser developer to perform some data manipulation.
The preferred approach is to keep them simple, just as `@staticmethod` functions under the parser class.
If they are short and one-of, they may even be defined as `lambda` functions.
For anything with more complexity, we suggest extending the schema.

### Extra: defining a Path

Paths do not have to be _absolute_, i.e. starting from the root node, and may be written _relative_ to the previous target/NOMAD parent node.
The relative notation is highly encouraged for performance reasons.
This is denoted in JMESPath by starting with the connector symbol (`.`).
JMESPath also provides rich filtering features 

- to select nodes by key name (starting with `@`). This is useful when presented with multiple named nodes at the same level.
- to select nodes / values by index for extracting anonymous nodes at the same level / tensors.
- to cycle between multiple branching scenarios via an `if-else` (`||`) logic.  %% TODO: double-check symbol

### Extra: aligning Source and Target Segments

Each path segment in the target/NOMAD schema (reference node -> next node) has to be compared individually with its source counterpart.
File formats may namely differ at any point in their level of semantic distinction.
We encounter three possibilities:

- the path segments in the source and target match perfectly. This case is straightforward and covered by the JMESPath features listed above.
- the source has multiple path segments, where the target only has one. This is also completely covered by `path`.
- the target has multiple path segments, where the source only has one. At target node, fall back on the trivial relative path `.` until the path segments line up again. %% verify with Alvin

%% What if a connector node may be entirely absent, e.g. as with workflows?

## From Text to Hierarchies

Contrary to XML or HDF5, plain text files do have a machine-readable structure out-of-the-box.
Therefore, step 2 (targeting data fields) requires an intermediate step to fall back on _key matching_.
The source format is converted to a temporary tree format stored by matching lines via regular expressions.
The keys are assigned by various `text_parser.py/Quantity`s, which are themselves grouped together in a `text_parser.py/TextParser.quantities: list[Quantity]`.
The nesting of layers is done by referring back to `TextParser` via `Quantity.sub_parser: TextParser`.

The main concern is how to leverage the additional freedom of a third format.
Our foremost advice is to consider this tree an enriched representation of the source file and thus **follow the text file structure as faithfully as possible**.
In its simplest form, this means

1. following the order in which the data appears.
2. capturing text blocks with a single `text_parser.py/Quantity`. Then you can further process its data via a deeper layer.

Let us demonstrate the second point with FHI-aims output, which is typically partioned into blocks with headers and `|`-indented lines, e.g.

```txt
  End self-consistency iteration #     1       :  max(cpu_time)    wall_clock(cpu1)$
  | Time for this iteration                    :        1.440 s           1.454 s$
  | Charge density update                      :        0.500 s           0.504 s$
  | Density mixing & preconditioning           :        0.000 s           0.000 s$
  ...
$
```

Here we indicate repetition as `...` and print the regex end-of-line symbol (`$`) for legibility.
This block would be captured as

```python

```

Note that the data extracted should be indicated between parentheses `()`, i.e. be a matching group in Python regex.
To promote semantic extraction, we provide labelled patterns for common flags, e.g. `FHIAimsOutParser.re_float`.
You can add a match group to a pattern via `capture(quantity)`.

For blocks, the matching group should lie between the header and footer.
Most times, developers prefer to approach the matching group content in a block as generic, nondescript text to focus on the stand-out characteristics of the block itself.
You can use the `FHIAimsOutParser.re_non_greedy` flag here.
Be careful: it should be superseded by a final regex pattern; otherwise the matching continues till the end-of-file.
In our example, the block finishes with a blank line, denoted by the `FHIAimsOutParser.re_blank_line` flag. 

A similar approach applies to processing individual tabular lines.
Focus first on identifying the line as whole, which always end on `FHIAimsOutParser.re_eol`.
Ensure that you toggle the `xxxx.Quantity.repeats` option to `True` or any non-zero number, so you match all lines.
The actual parsing of the data then happens at a deeper layer.
It is therefore not uncommon to encounter block parsing of up to three layers deep.

It can be easier to map the data by their column index depending on their shape.
Here, you can again use `xxxx.Quantity.repeats` in the `sub_parser`, this time as a `dict` mapping the indices to their respective labels.
This is just a convenient short-hand.
Accessing the data works just as with any other nested structure.

Following this logic, you will end up with a continuation of a vertically connected tree.

## Extra: Managing Entry Points

The plugin setup follows the common [entry-points](https://setuptools.pypa.io/en/latest/userguide/entry_point.html) Python standard from `importlib.metadata`.
It works in tandem with `pip` install to allow for a more elegant and controlled way of exposing and loading (specific functionalities in) modules.
Entry points also provide the module developer how these functionalities ought to be exposed to the environment, e.g. their name and own configuration.

Conceptually, there are five key players to keep track off:

- the **target functionality** is the entity that we want to _expose_ to the NOMAD base installation. In our case, this will amount to our parser class, which typically is a child class of `MatchingParser`. It may use `configurations` parameters passed along via the nomad settings.
- the **entry point** (instance of `EntryPoint`) is responsible for _registering_ the target functionality. It therefore also retains metadata like its name, a description and most importantly, the file matching directives. It is typically located in the `__init__.py` of the relevant functionality folder (see folder structure).
    - the **entry point group** bundles several entry points together. By default, NOMAD scans all plugins under the group name `project.entry-points.'nomad.plugin'`.
- the **module setup file** _exposes_ the entry point (and its group) under the format of `<module_name>.<functionality_folder_name>:<entry_point_name>`. This is the name by which you should call this entry point. In NOMAD we use the `pyproject.toml` setup file under the module's root folder.
- the **NOMAD configuration file** called `nomad.yaml` allows further control over which entry points to _include_ or _exclude_, as well as their _configuration parameters_.
