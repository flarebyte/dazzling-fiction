# Family Tree

## Weighting

* experimental: 1,2,4,8,16

## Frequency

* Never, Rarely, Occasionally, Sometimes, Often, Usually, Always : 0,1,2,3,4,5,6

## Models

### Male

* first name: [sebastian, adrian, james, henry, john ]
* last name: always; 1 of [smith, keaton, dupont, baker, butcher] 
* sex: [male]

### Female

* first name: [jane, kate, victoria, elisabeth, estelle,clara]
* last name: always; 1 of [smith, keaton, dupont, baker, butcher] 
* sex: [female]


### Parent

* son: sometimes ;[1:8] of {boys}
* daughter: sometimes ;[1:8] of {girls}

### Child

* dad: {boys}
* mum: {girls}

## Unions

* person: {Male} + {Female}
* people: {boys} + {girls}

## Without

* notboys: {people} - {boys}

## References

* boys: 3 of {male}
* girls: 3 of {female}
* parents: 4 of {parent}
* children: [3:6] of {child}
