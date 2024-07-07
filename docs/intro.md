# Introduction to the NOMAD software and repository

This tutorial is accessible to any level of programmer.
It covers a wide scope subjects, so most of it is from a birds-eye view.
Concepts are further supplemented with code snippets and exercises.
"Info" boxes provide useful concepts that go off-topic from the main thread.
For the more advanced programmers, technical sections covering edge cases can be found in "Extra". 

-----------------------------------------------------------------------------

The key advantages of the NOMAD schema are summed up in **FAIR**mat's core values:

- **F**indable: a wide selection of the extracted data is indexed in a database, powering a the search with highly customizable queries and modular search parameters.
- **A**ccessible: the same database specifies clear API and GUI protocols on how retrieve the _full_ data extracted.
- **I**nteroperable: we have a diverse team of experts who interface with various materials science communities, looking into harmonizing data representations and insights among them. Following the NOMAD standard also opens up the (meta)data to the NOMAD apps ecosystem.
- **R**eproducible: data is not standalone, but has a history, a vision, a workflow behind it. Our schema aims to capture the full context necessary for understanding and even regenerating via metadata.

## Modular Design and Plugins

Historically, the NOMAD parsers have always come packaged in a neat bundle.
As interest in research data management has become more widespread and recognized across scientific disciplines, NOMAD has adapted along with those interests.
Nowadays, you can find besides the [central NOMAD cloud service](https://nomad-lab.eu/nomad-lab/), standalone NOMAD Oasis deployments geared towards the needs of individual institutes or research groups.

As such, NOMAD is shifting to a _plugin model_, where each deployment administrator can customize their setup.
This permits a light-weight base installation and effective data processing pipelines.
Conversely, it also lowers the threshold for whomever wants to contribute to this open-source community: you can focus on just a single schema or parser.
The possibilities are as wide as you can make them, we just facilitate the common basis.

In the rest of this tutorial, we are going to take you on a birds-eye overview of how a to approaches these plugins.