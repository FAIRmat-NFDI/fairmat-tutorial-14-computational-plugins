# Creating parser plugins from scratch

## Setup?

## From Hierarchies to Schema

## From Text to Hierarchies

Contrary to XML or HDF5, text files do not come with a machine-readable structure.
Therefor, it is on the parser dev to impose one.
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

### Workflows and Super-structures

Now that we have covered the SCF and standard outputs, we have to plant these 

## From JSON to Schema?
