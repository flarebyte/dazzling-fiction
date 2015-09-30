# Family Tree

## Weighting

* **experimental** 1,2,4,8,16

## Frequency

* **Never, Rarely, Occasionally, Sometimes, Often, Usually, Always** 0,1,2,3,4,5,6

## Lists

* **male first name** *sebastian, adrian, james, henry, john*

* **female first name** `here:female-first-name`

* **common last name**  *smith, keaton, dupont, baker, butcher* 

## Models

### Male

* **first name** `male first name`
* **last name** always; 1 of `common last name`
* **sex** *male*

### Female

* **first name** `female first name`
* **last name** always; 1 of `common last name`
* **sex** *female*


### Parent

* **son** sometimes ;1 to 8 of `boys`
* **daughter** sometimes ;0 to 7 of `girls`

### Child

* **dad** `boys`
* **mum** `girls`

## References

* **boys** 3 of `male`
* **girls** 3 of `female`
* **parents** 4 of `parent`
* **children**  3 to 6 of `child`
