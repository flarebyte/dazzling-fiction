#  [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-url]][daviddm-image]

> Fictional facts generator based on a markdown fiction dialect

The fiction markdown dialect facilitates the creation of set of fictional (fake) data.
The output is a list of statements or facts, in which each fact is represented as subject-predicate-object format.
However the object is not limited to one column and could be used in the same way as datalog.
The generated data is randomly created but in a predictable and repeatable manner.

The main purpose of this dialect is to experiment with different data samples which conform to a particular structure.

## Install

```sh
$ npm install --save dazzling-fiction
```


## Usage

```sh
$ npm install --global dazzling-fiction
$ fict --help
```

## Examples

### Generate CSV
```
cat LICENSE |  fict run '2 of `Vegetable`' recipe "test/fixtures"
```

Will output:

```
ingredient,child-of-fiction-model,secret-spice
olive-oil,child-of-fiction-model,sauce
pepper,child-of-fiction-model,sauce
diced-onion,child-of-fiction-model,sauce
spice:Garlic/wild,child-of-fiction-model,sauce
spice:Garlic/black,child-of-fiction-model,sauce
chilli,child-of-fiction-model,sauce
secret,child-of-fiction-model,sauce
spoon-of,child-of-fiction-model,sauce
meat-type,child-of-fiction-model,meat
sauce,child-of-fiction-model,meat
vegetable-mix,child-of-fiction-model,vegetable
sauce,child-of-fiction-model,vegetable
topping,child-of-fiction-model,dessert
starter,child-of-fiction-model,meal
main-meat,child-of-fiction-model,meal
main-vegetable,child-of-fiction-model,meal
dessert,child-of-fiction-model,meal
a-vegetable-1-1,vegetable-mix,turnip
a-vegetable-1-1,vegetable-mix,turnip
a-sauce-3-1,pepper,2,teaspoon
a-sauce-3-1,diced-onion,2
a-sauce-3-1,chilli,false
a-sauce-3-1,secret,rel-ref-a-secret
a-sauce-3-1,spoon-of,cognac
a-sauce-3-1,spoon-of,armagnac
a-vegetable-2-2,vegetable-mix,carrot
a-vegetable-2-2,sauce,a-sauce-3-1
```

### Generate JSON
```
cat LICENSE |  fict run '2 of `Vegetable`' recipe "test/fixtures" -o json -p beautiful
```
Concerning the optional parameter -p or --print:
* machine: Format the output in a compact manner easily readable by a machine.
* beautiful: Format the output in a beautiful manner.
* outline: Format the output with the main outlines.

Will output

```
[ { i: 'a-ingredient-4',
    s: 'ingredient',
    p: 'child-of-fiction-model',
    o: [ 'secret-spice' ] },
  { i: 'a-olive-oil-5',
    s: 'olive-oil',
    p: 'child-of-fiction-model',
    o: [ 'sauce' ] },
  { i: 'a-pepper-6',
    s: 'pepper',
    p: 'child-of-fiction-model',
    o: [ 'sauce' ] },
  { i: 'a-diced-onion-7',
    s: 'diced-onion',
    p: 'child-of-fiction-model',
    o: [ 'sauce' ] },
  { i: 'a-spice:Garlic/wild-8',
    s: 'spice:Garlic/wild',
    p: 'child-of-fiction-model',
    o: [ 'sauce' ] },
  { i: 'a-spice:Garlic/black-9',
    s: 'spice:Garlic/black',
    p: 'child-of-fiction-model',
    o: [ 'sauce' ] },
  { i: 'a-chilli-10',
    s: 'chilli',
    p: 'child-of-fiction-model',
    o: [ 'sauce' ] },
  { i: 'a-secret-11',
    s: 'secret',
    p: 'child-of-fiction-model',
    o: [ 'sauce' ] },
  { i: 'a-spoon-of-12',
    s: 'spoon-of',
    p: 'child-of-fiction-model',
    o: [ 'sauce' ] },
  { i: 'a-meat-type-13',
    s: 'meat-type',
    p: 'child-of-fiction-model',
    o: [ 'meat' ] },
  { i: 'a-sauce-14',
    s: 'sauce',
    p: 'child-of-fiction-model',
    o: [ 'meat' ] },
  { i: 'a-vegetable-mix-15',
    s: 'vegetable-mix',
    p: 'child-of-fiction-model',
    o: [ 'vegetable' ] },
  { i: 'a-sauce-16',
    s: 'sauce',
    p: 'child-of-fiction-model',
    o: [ 'vegetable' ] },
  { i: 'a-topping-17',
    s: 'topping',
    p: 'child-of-fiction-model',
    o: [ 'dessert' ] },
  { i: 'a-starter-18',
    s: 'starter',
    p: 'child-of-fiction-model',
    o: [ 'meal' ] },
  { i: 'a-main-meat-19',
    s: 'main-meat',
    p: 'child-of-fiction-model',
    o: [ 'meal' ] },
  { i: 'a-main-vegetable-20',
    s: 'main-vegetable',
    p: 'child-of-fiction-model',
    o: [ 'meal' ] },
  { i: 'a-dessert-21',
    s: 'dessert',
    p: 'child-of-fiction-model',
    o: [ 'meal' ] },
  { s: 'a-vegetable-1-1', p: 'vegetable-mix', o: [ 'turnip' ] },
  { s: 'a-vegetable-1-1', p: 'vegetable-mix', o: [ 'turnip' ] },
  { s: 'a-sauce-3-1', p: 'pepper', o: [ 2, 'teaspoon' ] },
  { s: 'a-sauce-3-1', p: 'diced-onion', o: [ 2 ] },
  { s: 'a-sauce-3-1', p: 'chilli', o: [ false ] },
  { s: 'a-sauce-3-1', p: 'secret', o: [ 'rel-ref-a-secret' ] },
  { s: 'a-sauce-3-1', p: 'spoon-of', o: [ 'cognac' ] },
  { s: 'a-sauce-3-1', p: 'spoon-of', o: [ 'armagnac' ] },
  { s: 'a-vegetable-2-2', p: 'vegetable-mix', o: [ 'carrot' ] },
  { s: 'a-vegetable-2-2', p: 'sauce', o: [ 'a-sauce-3-1' ] } ]
```

## Features of the fiction dialect

The fiction dialect supports the following features:
 * Import
 * Weighting
 * Frequency
 * Models and references
 * Lists
 * Mappings

### Import

The fiction dialect allow a fiction script to reference another.

Example:
```
## Import

* another-script
* more-script

```

### Weighting

Weighting allows to introduce a bias to favor some values against others.

Example of declaration:
```
## Weighting

* ** experimental **  1,2,4,8,16
```

### Frequency

The frequency allows to decide how likely it is that an attribute will exist.

Example of declaration:
```
## Frequency

* **Never, Rarely, Occasionally, Sometimes, Often, Usually, Always** 0,1,2,3,4,5,6

```

Example of usage:
```
* **Diced onion** often ; *1,2,5*
```

### Models and references

You can represent subject-predicate-object relationships in the models section.
The subject is declared as a title while the predicate-objects are a list.


Example:
```
## Models

### Meat

* **meat type** *pork,beef,chicken*
* **sauce** usually; `sauce`

```

References are models that can be accessed by name.

```
## References

* **secret** 2 of `Secret spice`
```

### Lists

Fiction scripts rely often on lists to generate fictional data.
You can create re-usable lists by declaring them in a list section.

Lists can be loaded from files or from local web services.
They can be stored as a JSON array or as a text with each row on a different line.
The markdown syntax should be unaware of the exact location of the document.

Example of list declaration:
```
## Lists

* **male first name** `json-doc:male-first-name`
```

Example of use:
```
* **first name** `male first name`
```

### Mappings

Mappings are used to create short aliases.
They can be loaded from files or from local web services.

The markdown syntax should be unaware of the exact location of the document.

Example of mapping declaration:
```
## Mappings

* **title** `json-doc:title`
```

Example of use:
```
* **sex** *female*; `title:dr`
```

For an internal representation of:
```
{
	"dr": ["Doctor",{"fr": "Docteur"}]
}
```


## License

MIT © [Olivier Huin]()


[npm-url]: https://npmjs.org/package/dazzling-fiction
[npm-image]: https://badge.fury.io/js/dazzling-fiction.svg
[travis-url]: https://travis-ci.org/flarebyte/dazzling-fiction
[travis-image]: https://travis-ci.org/flarebyte/dazzling-fiction.svg?branch=master
[daviddm-url]: https://david-dm.org/flarebyte/dazzling-fiction.svg?theme=shields.io
[daviddm-image]: https://david-dm.org/flarebyte/dazzling-fiction
