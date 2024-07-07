# Creating Parser Plugins from Scratch

One of NOMAD's most recognized features is drag-and-drop parsing.
The NOMAD parsers, which automate the conversion of raw simulation files into the standardized NOMAD format, significantly offload the burden of data annotation from researchers, reducing their data management responsibilities while also improving the accessibility of their data.

Behind the scenes, parsing means looking through the upload folder and selecting relevant files.
These files are then read in and their data extracted.
Lastly, the semantics of the file format are clarified and specified as its data is mapped into the NOMAD schema.
The data is now ready to interact with the NOMAD ecosystem and apps.

![Parser Architecture](assets/parser_architecture.png)

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
They are explained in greater detail in section [Extra: Managing Entry Points](parser_plugins.md#extra-managing-entry-points).
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

1. `MatchingParser` - This class passes selects the file to be parsed. Since it interfaces with the NOMAD base directly, it will read most of the settings automatically in from there.
2. `XMLParser` and co. / `TextParser` - There are several _reader classes_ for loading common source formats into Python data types. Examples include the `XMLParser` and `HDF5Parser`. We will demonstrate `XMLParser` in [Parsing Hierarchical Tree Formats](parser_plugins.md#getting-the-data). Plain text files, meanwhile, involve an additional _matching step_ via the `TextParser`. More on this in [From Text to Hierarchies](parser_plugins.md#from-text-to-hierarchies).
3. `MappingAnnotationModel` - This is arguably the most involved part for the parser developer, as this is where the external data gets further semantically enriched and standardized. It requires doamin expertise to understand the relationship between the data fields in the source file and the [NOMAD-Simulations schema](nomad_simulations.md). If step 2 went well, this step only involves _annotating_ the target schema via `MappingAnnotationModel`. More on this in [Mapping a to Schema](parser_plugins.md#mapping-a-to-schema).
4. [NOMAD-Simulations schema](nomad_simulations.md) / `MappingAnnotationModel` - The `MSection`s and `utils.py` in the schema provide _normalizers_ and _helper functions_ to alleviate most of the data mangling. For small amendments*, use `MappingAnnotationModel.operator`. For larger ones, consider extending the schema as covered in [Extending NOMAD-Simulations](schema_plugins.md).
5. `MetainfoParser` - this _converter_ bridges the annotated schema from step 3 with the reader classes in step 2. `MetainfoParser.data_object` contains the final `ArchiveSection` that is stored under `archive.data`.

In the next section, we will briefly illustrate how `MatchingParser`, `XMLParser`, and `MetainfoParser` interconnect, as well as flesh out some setup details.

## Assembling a Parser Class

Throughout this subsection, we will step-by-step illustrate the process of building out a parser using the VASP XML output format as an example.
The code snippets provided below should go under `src/nomad_parser_vasp/parsers/`, in a file clarifying the use, e.g. `xml_parser.py`.

### Hooking up a Parser

As denoted in step 1, the parser first has to read in the file contents as passed through by the NOMAD base.
The directives for selecting _mainfiles_ are passed on via an interaction cascades from `nomad.yaml` > `ParserEntryPoint` > `MatchingParser`.

!!! info "What are mainfiles?"
    Mainfiles are files by which an expert / program can determine the code used / the parser to use.
    The selection directives (see below) target these files specifically.
    Their file paths are passed on to the parser, which can either process them or navigate the folder for other, auxiliary files.

#### Mainfile matching

Since mainfiles are intrinsically connected to the scripts that parse them, the directives should be set via `ParserEntryPoint`.
I rare cases, however, an Oasis admin may decide to override these selection directives via the `nomad.yaml`.
We publish our VASP XML parser in `src/nomad_parser_vasp/parsers/__init__.py` as

```python
from nomad.config.models.plugins import ParserEntryPoint

class VasprunXMLEntryPoint(ParserEntryPoint):
    def load(self):
        from nomad_parser_vasp.parsers.xml_parser import VasprunXMLParser
        return VasprunXMLParser(**self.dict())

xml_entry_point = VasprunXMLEntryPoint(
    name='VasprunXML Parser',
    description='Parser for VASP output in XML format.',
    mainfile_name_re='.*vasprun\.xml.*',
)
```

`load` comes from the entry point system and should just return our parser (see below).
The entry point itself specifies _parser data_ and the directives.
There are three kinds of file aspects that can be targeted, all via _regular expressions_ (regex):

- `mainfile_name_re` - the filename itself.
- `mainfile_contents_re`, `mainfile_contents_dict` - the file contents. It is by default restricted to the first 1024 bytes, i.e. the file header.
- `mainfile_mime_re` - the file mime.  <!-- TODO define file mime -->

!!! abstract "Assignment"
    XML is a common file extension, and the user may remove `vasprun` from the name.
    Swap out `mainfile_name_re` for a different selection directive.
    <!-- TODO research how multiple directives combine>

!!! success "Solution"
    VASP XML typically starts with the tags
    ```xml
    <?xml version="1.0" encoding="ISO-8859-1"?>
    <modeling>
    ```
    You can capture this via `mainfile_contents_re` in a regex like `r'<\?xml version="1\.0" encoding="ISO\-8859\-1"?>\n<modeling>`. <!-- TODO double-check>

#### Mainfile Interfacing

Within the cascade, `MatchingParser`, acts as the connection point on the parser side.
It plays less of a role in manipulating the directives, and more so in defining the _interface_ -a formalization of behavior- back to the parser.
The two main specifications are instantiation and `parse`.
Since `MatchingParser` already defines both, parsers may simply _inherit_ therefrom.
The most rudimentary parser, thus looks as follows.

```python
from nomad.parsing import MatchingParser
class VasprunXMLParser(MatchingParser):
    pass
```

NOMAD can already run this parser, but will raise a `NotImplementedError`.
The interface may be defined, but we still need to fill in the actual parsing by overwriting `parse`.

!!! info "Run your parser"
    In everyday NOMAD use, the user only interacts with NOMAD via the GUI or API.
    NOMAD will regulate parsing as the user uploads via any of these channels.
    During development, the command line is probably the preferable option, as you can load changes faster and incorporate it into your favorite test setups.
    To print the archive to the terminal, use `nomad parse --show-archive <mainfile>`.
    If you already know which parser to use, add the `--parser 'parser/<parser or entry point name>'` flag.
    To list all options, type `nomad parse --help`.
    Note that even the command line passes through the NOMAD base, so make sure to have it installed and set up correctly.


### Getting the Data

Where `MatchingParser` provides a path to the mainfiles, a separate parser is needed for actually reading the _file contents_.
NOMAD already provides several parsers for popular, general-purpose formats like JSON, HDF5, and XML. <!-- TODO verify JSON >
Plain text is also supported, but a bit more involved.
We cover it in section [From Text to Hierarchies](#from-text-to-hierarchies).

Contrary to `MatchingParser`, none of these parsers directly interface with the NOMAD base.
For example, they do not support the `parse` function.
Therefore, our parser has to call `XMLParser`.
The typical strategy here is to save the _reader object_ for later manipulation.
In the example below, we read in the whole file.
The [XPath syntax](https://www.w3schools.com/xml/xpath_syntax.asp) also supports subbranch extraction, which can be incrementally added to the reader object. 

```python
from structlog.stdlib import BoundLogger
from nomad.datamodel.datamodel import EntryArchive
from nomad.parsing.file_parser.xml_parser import XMLParser

class VasprunXMLParser(MatchingParser):
    def parse(
        self, mainfile: str, archive: EntryArchive, logger: BoundLogger,
        child_archives: dict[str, EntryArchive] = None,
    ) -> None:
        xml_reader = XMLParser(mainfile=mainfile).parse('/*')  # XPath syntax
        archive.data = xml_reader._results
```
<!-- note that this XMLParser does not have a universal interface -->

!!! info "What is the archive?"
    An archive is a (typically empty) storage object for an entry.
    It wis populated by the parser and later on serialized into an `archive.json` file by NOMAD for permanent storage.
    It has five sections, but for novel parsers we are solely interested in `data` and `workflow`.
    - `metainfo`: internal NOMAD metadata registering who and when the data were uploaded. Is handled completely automatically by the NOMAD base.
    - `results`: the data indexed and ready to query at full database scale. It is automatically produced from `worfklow`, `data`, and `run`.
    - `workflow`: some entries coordinate other entries. This section coordinates the . For more, see [Interfacing complex simulations](custom_workflows.md).
    - `data`: the new section detailing all extracted values. It comes with the updated schema presented in [NOMAD-Simulations schema plugin](nomad_simulations.md).
    - `run`: the predecessor to `data`. It should only be targeted by legacy parsers, and has been marked for deprecation.

The `NotImplementedError` is now resolved.
Running the parser results in a new error, however, `AttributeError: 'dict' object has no attribute 'm_parent'`.
This may look discouraging, but progress was made!
The data has been successfully extracted: check `xml_reader._results`.
The issue stems from data not yet meeting the high-quality standards of the NOMAD schema.
In the next section, we convert it.

!!! info "To return or not return"
    Does the NOMAD base expect an `EntryArchive` object back from `parse`.
    In NOMAD we use type annotation as much as possible.
    It also tested in our CI/CD.
    The type signature of `parse` denotes that it should not return any output, i.e. `-> None`.
    Instead, the input will be overwritten and later on extracted.

#### Extra: Communicating via Logs

Each entry has an associated log.
These communicate info or warnings about the processing, as well as debugging info and (critical) errors for tracing bugs.
Include the latter when contacting us regarding any processing issues.

Here, we use the `logger` object to `info`rm which parser was called.

```python
...
from nomad.config import config

configuration = config.get_plugin_entry_point(
    'nomad_parser_vasp.parsers:xml_entry_point'
)

class VasprunXMLParser(MatchingParser):
    def parse(
        self, mainfile: str, archive: EntryArchive, logger: BoundLogger,
        child_archives: dict[str, EntryArchive] = None,
    ) -> None:

    logger.info('VasprunXMLParser.parse', parameter=configuration.parameter)
    ...
```

### Instantiating a Schema

<!-- cookie cutter example -->

<!-- contingent instantiation example -->

### Mapping a to Schema

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

<!-- TODO Is normalization automatically triggered here? -->

This is all of the code!
Leveraging `MappingAnnotationModel` clearly makes parsers more concise.
Breaking down the parser class, `VasprunXMLParser`, it inherits most functionality from `MatchingParser`, including `parse`.
The `parse` interface is rigid -represents a contract between the NOMAD base and the parser- and is worth studying a bit:

The `MetainfoParser` is linked to the annotated schema. A single schema may contain multiple annotations corresponding to various file formats, e.g. `xml`, `hdf5`, `txt` for VASP. Since we are dealing with computational data, we provide the `Simulation` object as the root of our target.

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

<!-- TODO: extend example + add hdf5? -->

```python
from nomad_simulations.schema_packages.general import Simulation, Program

Simulation.m_def.m_annotations['xml'] = MappingAnnotationModel(path='modeling')

Simulation.program.m_annotations['xml'] = MappingAnnotationModel(path='.generator')

Program.name.m_annotations['xml'] = MappingAnnotationModel(path='.i[?"@name"="program"]')
```

Many more approaches are at play in this example.
Check out the "Extra" sections below for a more in-depth explanation and edge cases.

### Extra: exploring Mapping Annotations

`MappingAnnotationModel` itself accepts one of two argument keys:

- `path`: specifies the node sequence leading up to the source node of interest. It leverages the [JMESPath DSL](https://jmespath.org/) for this, though other languages may be incorporated here in the future.
- `operator`: the more active counterpart to `path`. Inserts a function (name in string format) between the source and target nodes. Source data are passed along in an array of `path`s matching the positional arguments, similar to Python `*args`.

Operators, are the main tool for the parser developer to perform some data manipulation.
The preferred approach is to keep them simple, just as `@staticmethod` functions under the parser class.  <!-- TODO double-check -->
If they are short and one-of, they may even be defined as `lambda` functions.
For anything with more complexity, we suggest extending the schema.

### Extra: defining a Path

Paths do not have to be _absolute_, i.e. starting from the root node, and may be written _relative_ to the previous target/NOMAD parent node.
The relative notation is highly encouraged for performance reasons.
This is denoted in JMESPath by starting with the connector symbol (`.`).
JMESPath also provides rich filtering features 

- to select nodes by key name (starting with `@`). This is useful when presented with multiple named nodes at the same level.
- to select nodes / values by index for extracting anonymous nodes at the same level / tensors.
- to cycle between multiple branching scenarios via an `if-else` (`||`) logic.  <!-- TODO: double-check symbol -->

### Extra: aligning Source and Target Segments

Each path segment in the target/NOMAD schema (reference node -> next node) has to be compared individually with its source counterpart.
File formats may namely differ at any point in their level of semantic distinction.
We encounter three possibilities:

- length source path segment = length target path segment: this case is straightforward and covered by the JMESPath features listed above.
- length source path segment > length target path segment = 1: this is also completely covered by `path`.
- length source path segment = 1 < length target path segment: at every non-matching target node, fall back on the trivial relative path `.` until the path segments line up again. <!-- TODO verify with Alvin -->

<!-- What if a connector node may be entirely absent, e.g. as with workflows? -->

## From Text to Hierarchies

When dealing with plain text, step 2 proceeds in two stages: reading in the file contents and making the `str` data more actionable in Python.
To this end, we construct an intermediate tree format where we will map into the schema from.

The tactic here is _weave_ two classes, `TextParser` and `Quantity`, both from `text_parser.py`, in with each other.
Always start with `TextParser` and use `Quantity.sub_parser` to go one level deeper.
To obtain finally obtain the tree as a Python `dict`, apply `TextParser.to_dict()` to the root node.

```python
txt_reader = TextParser(                # root node
    quantities = [                      # level 1
        Quantity(...),
        Quantity(...),
        Quantity(
            ...,
            sub_parser = TextParser(
                quantities = [          # level 2
                    Quantity(...),
                ]
            )
        ),
    ]
)
```

Note that the regex patterns should always contain _match groups_, i.e. `()`, else no text is extracted.
This is especially important for blocks, where the typical regex pattern has the form `r'<re_header>(?[\s\S]+)<re_footer>'` to match everything between the block header and footer.

!!! info "Dissecting Tables"
    The typical approach to processing text tables is to match the table (body), a standard line, and lastly, a standard column. <!-- TODO explore tools for when column semantics is tied to its index -->
    Ensure that you toggle the `Quantity.repeats: Union[bool, int]` option to obtain a list of matches.
    <!-- TODO how to extract as a matrix immediately (no dict keys) -- >

The main concern is how to leverage the additional freedom of a third format.
Our foremost advice is to

1. follow the order in which the data normally appears.
2. use as similar as possible node names as in the file. If none are present, fall back on the NOMAD schema names.
3. systematically break down blocks of text via the weaving technique.
4. use the same node names when multiple versions exist. Maximize the common nodes and overall keep the alternatives as close as possible together.

Handling contingent values is more so reserved for step 3, mapping.
An example would be reading file units:

<!-- TODO add dynamic units example -->

!!! info "Semantic Patterns"
    Modern text parsers come equipped with several common patterns to expedite the construction of complex patterns.
    Examples include `re_float` covering decimals and scientific notation, separators like `re_blank_line` or `re_eol`, and `re_non_greedy` for matching whole chunks of text, as shown above.
    The `capture(pattern)` function applies the match groups.   

## Extra: Managing Entry Points

The plugin setup follows the common [entry-points](https://setuptools.pypa.io/en/latest/userguide/entry_point.html) Python standard from `importlib.metadata`.
It works in tandem with `pip` install to allow for a more elegant and controlled way of exposing and loading (specific functionalities in) modules.
Entry points also provide the module developer how these functionalities ought to be exposed to the environment, e.g. their name and own configuration.

Conceptually, there are five key players to keep track off:

- **target functionality**: the entity that we want to _expose_ to the NOMAD base installation. In our case, this will amount to our parser class, which typically is a child class of `MatchingParser`. It may use `configurations` parameters passed along via the nomad settings.
- **entry point**: instance of `EntryPoint`, responsible for _registering_ the target functionality. It therefore also retains metadata like its name, a description and most importantly, the file matching directives. It is typically located in the `__init__.py` of the relevant functionality folder (see folder structure).
    - **entry point group**: bundles several entry points together. By default, NOMAD scans all plugins under the group name `project.entry-points.'nomad.plugin'`.
- **module setup file**: _exposes_ the entry point (and its group) under the format of `<module_name>.<functionality_folder_name>:<entry_point_name>`. This is the name by which you should call this entry point. In NOMAD we use the `pyproject.toml` setup file under the module's root folder.
- **NOMAD configuration file**: called in `nomad.yaml`, controls which entry points are _included_ or _excluded_, as well as their _configuration parameters_.
