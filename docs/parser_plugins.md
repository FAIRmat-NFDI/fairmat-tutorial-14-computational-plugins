# Creating Parser Plugins from Scratch

One of NOMAD's most recognized features is drag-and-drop parsing. The NOMAD parsers, which automate the conversion of raw simulation files into the standardized NOMAD format, significantly offload the burden of data annotation from researchers, reducing their data management responsibilities while also improving the accessibility of their data.

### Getting started

To create your own parser plugin, visit our GitHub template and use the “Use this template” button.
Follow the [How to get started with plugins](https://nomad-lab.eu/prod/v1/staging/docs/howto/plugins/plugins.html) documentation for detailed setup instructions.
The template will appear bare-bones at the start.
Following the instructions in the `README.md`  and the `cruft` setup will allow you to tune the project to your needs.
Just a couple of notes on the `cruft` setup:

- NOMAD uses the Apache 2.0 license. Please select the same license for maximal legal compatibility.
- Parsers require both a `parsers` and a `schema_packages` folder. The reason for the second folder will soon become apparent.
- Each file parser gets its own `.py` file under `parsers`. `myparser.py` just acts as a blueprint, but should not be edited or exposed directly.

### Managing Entry Points

The plugin setup follows the common [entry-points](https://setuptools.pypa.io/en/latest/userguide/entry_point.html) Python standard from `importlib.metadata`.
It works in tandem with `pip` install to allow for a more elegant and controlled way of exposing and loading (specific functionalities in) modules.
Entry points also provide the module developer how these functionalities ought to be exposed to the environment, e.g. their name and own configuration.

Conceptually, there are five key players to keep track off:

- the **target functionality** is the entity that we want to _expose_ to the NOMAD base installation. In our case, this will amount to our parser class, which typically is a child class of `MatchingParser`. It may use `configurations` parameters passed along via the nomad settings.
- the **entry point** (instance of `EntryPoint`) is responsible for _registering_ the target functionality. It therefore also retains metadata like its name, a description and most importantly, the file matching directives. It is typically located in the `__init__.py` of the relevant functionality folder (see folder structure).
    - the **entry point group** bundles several entry points together. By default, NOMAD scans all plugins under the group name `project.entry-points.'nomad.plugin'`.
- the **module setup file** _exposes_ the entry point (and its group) under the format of `<module_name>.<functionality_folder_name>:<entry_point_name>`. This is the name by which you should call this entry point. In NOMAD we use the `pyproject.toml` setup file under the module's root folder.
- the **NOMAD configuration file** called `nomad.yaml` allows further control over which entry points to _include_ or _exclude_, as well as their _configuration parameters_.

Given a typical folder lay-out for a parser project, the players are located in
...

note on file matching

For more detail on the specifics of each step, check out our [documentation](https://nomad-lab.eu/prod/v1/staging/docs/howto/plugins/plugins.html).

## From Hierarchies to Schema

As parsing involves the mapping between two well-defined formats, one could expect it to be trivial.
In practice, however, parser developers have to manage discrepancies in semantics, shape, data type or units.
This has lead to five distinct categories of responsibility for the developer to manage:

1. select the relevant files and read them into Python.
2. target and extract relevant data fields within the source file format on a per-file basis.
3. match the data of interest with their counterparts in the target/NOMAD schema.
4. reshape and mangle the data to match the target/NOMAD `Quantity`s' specification. This may include computing derived properties not present in the original source files.
5. build up a Python `archive` object using the classes provided by the target/NOMAD schema.

In the past, we encountered cases where the delineation between these responsibilities were blurred, resulting in widely different parser designs.
Especially when dealing with the larger, more feature-rich parsers, these designs could become quite complex.

During refactoring, we therefore addressed these responsibilities on a more individual basis.
This lead to more clearly defined _interfaces_ and powerful _tools_ for the developer.
These are further complimented by _best practices_ and _design protocols_.

More specifically, point 1 (file selection) is now handled by the `MatchingParser` class, from which the parser class inherits. It coordinates with the NOMAD base to scan the uploaded folder tree and select the relevant files.

Point 4 (data mangling) is covered by the NOMAD schema, as you saw in the part [NOMAD-Simulations schema](nomad_simulations.md).
Not only does this allow for a more consistent handling of the data, it also cleanly partitions the work between parser and schema developers.
In principle, a parser should at most perform trivial manipulations, such as slicing an array or multiplying two extracted values.
More on the exact "how" later.

Lastly, we will cover tools for point 5 (building the `archive`) and 2 (targeting data fields) in the next subsections.
Point 5, in particular, previously required the reconstruction of the already defined target/NOMAD schema.
That comes across as doing double work: running over the schema once to define it, and a second time to initialize it.
The main hurdle to automation here was the variable structure of the source data:
a well-defined hierarchical format does not ensure that individual file structures remains constant.
Some leaf nodes or branches may simply not be present.

With all of these points covered, developing a parser now comes down to just implementing point 3 (matching source with target).
This is the stage where data actually becomes semantically enriched and standardized.
At present, this is a profoundly human task, where domain expertise is most needed.
Therefore, this scientific curation task is now most emphasized in parser development.

Let us cover the remaining tools, so we can move on to the real science.

### Parsing Hierarchical Tree Formats

We conceptualize format conversion as restructuring a _hierarchical data tree_, formally known as a _directed acyclic graph_.
The restructuring may then be defined in terms of lining up source with target nodes.
Formats that leverage a tree structure, e.g. XML, HDF5, JSON, and most importantly the NOMAD schema, already provide these nodes.
The only missing component then are the mappings themselves.

Since we have full control over our own schema, we will annotate the mappings there.
The only relevant nodes are `ArchiveSection` attributes like `Quantity` (i.e. leaf nodes) or `SubSection` (i.e. branching nodes).
Adding annotations then is as simple as extending a dictionary: `<section_name>.<attribute_name>.m_annotations[<tag_name>] = MappingAnnotationModel(...)`.

The `<tag_name>` key allows for distinguishing between several kinds of mappings.
This comes in handy when a code or community supports different formats for the same data.
Rather than importing and annotating the schema several times over, you can keep it in one place (under `schema_packages`).
It also makes apparent at a glance, in how far different formats overlap:
there are codes where the structure or information contents shift widely.
This is especially prevalent when new formats are introduced over a large time span.
For the naming of the tag itself, we suggest to adhere to the file extension. 

`MappingAnnotationModel` itself accepts one of two argument keys:

- `path`: specifies the node sequence leading up to the source node of interest. It leverages the [JMESPath DSL](https://jmespath.org/) for this, though other languages may be incorporated here in the future.
- `operator`: the more active counterpart to `path`. Inserts a function (name in string format) between the source and target nodes. Source data are passed along in an array of `path`s matching the positional arguments, similar to Python `*args`.

Paths do not have to be _absolute_, i.e. starting from the root node, and may be written _relative_ to the previous target/NOMAD parent node.
The relative notation is highly encouraged for performance reasons.
This is denoted in JMESPath by starting with the connector symbol (`.`).
JMESPath also provides rich filtering features 

- to select nodes by key name (starting with `@`). This is useful when presented with multiple named nodes at the same level.
- to select nodes / values by index for extracting anonymous nodes at the same level / tensors.
- to cycle between multiple branching scenarios via an `if-else` (`||`) logic.  %% TODO: double-check symbol

The overall strategy is thus to annotate `path` mappings starting from `Simulation` and run over each `SubSection` up until reaching the corresponding `Quantity`.
The most important part is for the target/NOMAD path to be fully traceable:
any disconnections in a `path` will cut it out of the `archive`.

Each `path` segment in the target/NOMAD schema (reference node -> next node) has to be compared individually with its source counterpart.
File formats may namely differ at any point in their level of semantic distinction.
We encounter three possibilities:

- the path segments in the source and target match perfectly. This case is straightforward and covered by the JMESPath features listed above.
- the source has multiple path segments, where the target only has one. This is also completely covered by `path`.
- the target has multiple path segments, where the source only has one. At target node, fall back on the trivial relative path `.` until the path segments line up again. %% verify with Alvin

%% Example code

Operators, meanwhile, are the main tool for the parser developer to perform some data manipulation.
The preferred approach is to keep them simple, just as `@staticmethod` functions under the parser class.
If they are short and one-of, they may even be defined as `lambda` functions.
For anything with more complexity, we suggest extending the schema.
More on this topic in the part [Extending NOMAD-Simulations](schema_plugins.md).

%% What if a connector node may be entirely absent, e.g. as with workflows.

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
