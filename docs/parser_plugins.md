# Creating parser plugins from scratch

## Default setup?

## Hierarchies to Schema

## Text to Hierarchies

Contrary to XML or HDF5, text files do not come with a machine-readable structure.
Therefor, it is on the parser dev to impose one.
This is a very common parsing strategy at large

1. capturing first the relevant text via frameworks like regular expression.
2. then semantically annotating, i.e. labelling, them.
3. finally placing them into the schema.

Note that this last step effectively enriches the semantics further into a standardized framework.
It also makes the (meta)data accessible to the NOMAD apps eco-system.

In the past, step 3 (schema mapping) was quite troublesome, due to

1. the mapping involving data mangling as well. This is now trivialized via the xxxx framework and the schema normalizers.
2. a dense and often obtuse semantically enriched structure stemming from step 2.

The main approach for handling this mapping is to **describe the text file structure as faithfully as possible**. 

## JSON to Schema?
