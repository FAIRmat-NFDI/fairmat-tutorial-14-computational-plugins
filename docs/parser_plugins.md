# Creating parser plugins from scratch

Likely one of NOMAD's most recognized and beloved features is _drag-and-drop parsing_.
We understand that annotating data, keeping track of all steps involved, is most often a time-consuming, painful process.
Still, good _research data management_ is central to good scientific reporting.
The NOMAD parsers significantly offload a lot of this burden from the scientist, freeing up their time to keep pushing boundaries.
Parsers _automate the conversion_ of a file format common to a specific piece of software or a community into the NOMAD format.
The schema for computational techniques was introduced in the previous section.

The key advantages of the NOMAD schema are summed up in **FAIR**mat's core values:

- **F**indable: a wide selection of the extracted data is indexed in a database, powering a the search with highly customizable queries and modular search parameters.
- **A**ccessible: the same database specifies clear API and GUI protocols on how retrieve the _full_ data extracted.
- **I**nteroperable: with have a diverse team of experts who interface with various matierlas science communities, looking into harmonizing data representations and insights among them. Following the NOMAD standard also opens up access to analysis apps coming from these communities.
- **R**eproducible: data is not standalone, but has a history, a vision, a workflow behind it. Our schema aims to capture the full context necessary for understanding and even regenerating via metadata.

## Modular Design and Plugins

Historically, our parsers have come always come together as a neat bundle.
As interest in research data management has become more widespread and recognized across scientific disciplines, NOMAD has adapted along with those interests.
Nowadays, you can find besides the [central NOMAD cloud service](), also standalone NOMAD Oasis deployments geared towards the needs of individual institutes or research groups.

As such, NOMAD is shifting to a _plugin model_, where each deployment administrator can customize their setup.
This permits a light-weight base installation and effective data processing pipelines.
Conversely, it also lowers the threshold for whomever wants to contribute to this open-source community: you can focus on just a single schema or parser.
The possibilities are as wide as you can make them, we just facilitate the common basis.

In the rest of this page, we are going to take you on a birds-eye overview of how a parser developer approaches these plugins.

### Getting started

Getting hands-on with a plugin is just as easy visiting our [GitHub template]() and _using one in your own codespace_.
The template will appear almost empty at the start, but following the instructions `README.md`  and during the `cruft` setup will allow you to tune the project to your needs.
Just a couple of notes on the latter:

- NOMAD uses the Apache 2.0 license. Unless your organization prohibits this, please select the same license for maximal legal compatibility.
- Parsers require both a `parsers` and a `schema_packages` folder. The reason for the second folder will soon become apparent.
- We use generically named files like `parsers/myparser.py` as blueprints by copying them to new, more clearly named files. Each file format, its own Python file.

### Managing Entry Points

The plugin setup actually follows a more common Python standard from the `importlib.metadata`, namely [entry-points](https://setuptools.pypa.io/en/latest/userguide/entry_point.html).
It enables `pip` installing select functionalities from a module, instead of the whole.
Entry points also provide the module developer how these functionalities ought to be exposed to the environment, e.g. their name and own configuration.

Conceptually, there are 5 key players that you should keep track off:

- the **target functionality** is the entity that we want to _expose_ to the NOMAD base installation. In our case, this will amount to our parser class, which typically is a child class of `MatchingParser`. It may use `configurations` parameters passed along via the nomad settings.
- the **entry point** (instance of `EntryPoint`) is responsible for _registering_ the target functionality. It therefore also retains metadata like its name, a description and most importantly, the file matching directives. It is typically located in the `__init__.py` of the relevant functionality folder (see folder structure).
    - the **entry point group** bundles several entry points together. By default, NOMAD scans all plugins under the group name `project.entry-points.'nomad.plugin'`.
- the **module setup file** _exposes_ the entry point (and its group) under the format of `<module_name>.<functionality_folder_name>:<entry_point_name>`. This is the name by which you should call this entry point. In NOMAD we use the `pyproject.toml` setup file under the module's root folder.
- the **NOMAD configuration file** called `nomad.yaml` allows further control over which entry points to _include_ or _exclude_, as well as their _configuration parameters_.

Given a typical folder lay-out for a parser project, the players are located in
...

note on file matching

For more detail on the specifics of each step, check out our [documentation]().

## From Hierarchies to Schema

As parsing involves the mapping between two well-defined formats, one could expect it to be just that trivial.
In practice, however, parser developers have to manage discrepancies in semantics, shape, data type or units.
This has lead to five distinct categories of responsibility for the developer to manage:

1. select the relevant files and read them into Python.
2. target and extract relevant data fields within the source file format on a per-file basis.
3. match the data of interest with their counterparts in the target/NOMAD schema.
4. reshape and mangle the data to match the target/NOMAD `Quantity`s' specification. This may include computing derived properties not present in the original source files.
5. build up a Python `archive` object using the classes provided by the target/NOMAD schema.

In the past, we encountered cases where teh delineation between these responsibilities blurred, resulting in widely different parser designs.
Especially when dealing with the larger, more feature-rich parsers, these designs could become quite complex.

During refactoring, we therefore addressed these responsibilities on a more individual basis.
This lead us to providing the parser developer with clear interfaces to powerful tools, as well as best practices and design protocols.

More specifically, step 1 (file selection) is now handled by the `MatchingParser` class, from which the parser class inherits. It interfaces with NOMAD to scan the uploaded folder tree and select the relevant files.

Step 4 (data mangling) is covered by the NOMAD schema, as you saw in the previous part.
Not only does this allow for a more consistent handling of the data, it also cleanly partitions the work between parser and schema developers. %% announce Schema Extension?
In principle, a parser should at most perform trivial manipulations, such as slicing an array or multiplying two extracted values.
More on the exact "how" later.

Lastly, we will cover tools for step 5 (building the `archive`) and 2 (targeting data fields) in the next subsections.
Step 5, particularly, was a developing nuisance, as it required the reconstruction of the already defined target/NOMAD schema.
That comes across as doing double work: running over the schema once to define it, and a second time to initialize it.
The main hurdle to automation here was variable nature in which source data would be present.

Effectively, developing a parser now comes down to calling these tools where appropriate and focusing on step 3 (matching source with target).
Note that this is where data actually becomes semantically enriched and standardized.
This is a profoundly human task (barring any further leaps of LLMs), where domain expertise is needed.
It is thus this scientific curation task that is now most emphasized in parser development, rather than the coding aspects.

Let us cover the remaining tools, so we can move on to the real science.


### MappingParser


### Workflows and Super-structures

Now that we have covered the SCF and standard outputs, we have to plant these 

## From Text to Hierarchies

Contrary to XML or HDF5, text files do not come with a machine-readable structure.
Therefor, it is on the parser developer to impose one, as stated in step 2.
This is a very common parsing strategy at large

1. capturing first the relevant text via frameworks like regular expression.
2. then semantically annotating, i.e. labelling, them.
3. finally placing them into the schema.

Note that this last step effectively enriches the semantics further into a standardized framework.
It also makes the (meta)data accessible to the NOMAD apps eco-system.

In the past, step 3 (schema mapping) was quite troublesome, due to

1. the mapping involving data mangling as well.
2. a dense and often obtuse semantically enriched structure stemming from step 2.

As we saw before, point 1 is now addressed via the xxxx framework and the schema normalizers so that mapping becomes trivial.
Navigating point 2 is up to the community maintaining the parser, but we can provide some best practices.
The tree structure can be specified via an entry `TextParser` that can be self-referential via a _two-layer approach_, where `TextParser.quantities: list[Quantity]` and then `Quantity.sub_parser: TextParser`.
`text_parser.py/Quantity` here is a class for regex matching and should not be conflated with `xxxx.Quantity` for defining the schema.

### Main Approach for SCF

The main approach for handling this mapping is to **describe the text file structure as faithfully as possible**.
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

Here we indicate repitition as `...` and print the regex end-of-line symbol (`$`) for legibility.
This block would be captured as

```python

```

Note that the data extracted should be indicated between parentheses `()`, i.e. be a matching group in Python regex.
To promote semantic extraction, we provide labelled patterns for common flags, e.g. `FHIAimsOutParser.re_float`.
You can add a match group to a pattern via `capture(quantity)`.

For blocks, the matching group should lie between the header and footer.
Most times, devs prefer to approach the matching group content in a block as generic, non-descript text to focus on the stand-out characteristics of the block itself.
You can use the `FHIAimsOutParser.re_non_greedy` flag here.
Be careful: it should be superceded by a final regex pattern, else the matching continues up to the end-of-file.
In our example, the block finishes with a blank line, denoted by the `FHIAimsOutParser.re_blank_line` flag. 

A similar approach applies to processing individual tabular lines.
Focus first on identifying the line as whole, which always end on `FHIAimsOutParser.re_eol`.
Ensure that you toggle the `xxxx.Quantity.repeats` option to `True` or any non-zero number, so you match all lines.
The actual parsing of the data then happens at a deeper layer.
It is therefore not uncommon to encounter block parsing of up to three layers deep.

Sometimes, it is easier to map the data by their column index.
Here, you can again use `xxxx.Quantity.repeats` in the `sub_parser`, this time as a `dict` mapping the indices to their respective labels.
This is just a convenient short-hand.
Accessing the data works just as with any other nested structure.

Following this logic through, you will end up with a continuation of a vertically connected tree.
