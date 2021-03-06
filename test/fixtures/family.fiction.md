# Family Tree

## Weighting

* **experimental** 1,2,4,8,16

## Frequency

* **Never, Rarely, Occasionally, Sometimes, Often, Usually, Always** 0,1,2,3,4,5,6

## Lists

* **male first name** `json-file:male-first-name`

* **female first name** `here:female-first-name`

* **common last name**  `web:common-name`

* **code name**  `json-web:code-name`

## Mappings

* **title** `json-file:title`
* **sex** `json-web:sex`

## Models

### Male

* **first name** `male first name`
* **last name** always; 1 of `common last name`
* **code name** always; 1 of `code name`
* **sex** `sex:M`; `title:mr`

### Female

* **first name** `female first name`
* **last name** always; 1 of `common last name`
* **sex** *female*; `title:dr`


### Parent

* **son** sometimes ;1 to 8 of `male`
* **daughter** sometimes ;0 to 7 of `female`

## References

* **boys** 3 of `male`
* **girls** 3 of `female`
* **parents** 4 of `parent`
