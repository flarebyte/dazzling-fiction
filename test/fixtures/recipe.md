# Recipe

## Import

* basic.md

## Weighting

* experimental: 1,2,4,8,16

## Frequency

* Never, Rarely, Occasionally, Sometimes, Often, Usually, Always : 0,1,2,3,4,5,6

## Models

### Secret spice

* ingredient: 2 of [lemon, orange, coriander, massala, garam]

### Sauce

* Olive Oil: sometimes ;[1.0:10] ; [teaspoon,tablespoon]
* Pepper: occasionally ; [1:3]; [teaspoon]
* Diced onion: often ; [1,2,5]
* Garlic: sometimes
* Chilli: yes/no 
* secret: usually; {Secret}

### Meat

* meat type: [pork,beef,chicken]
* sauce: usually; {sauce}

### Vegetable

* vegetable mix: [1:3] of [carrot,salad,turnip,potato,cucumber,bean]
* sauce: often; {sauce}

### Dessert

* topping: often; [chocolotate, caramel, strawberry]

### Meal

* starter: often; popular {habit} of [tomatoes mozarella,snails, soup,salad,caviar, foie gras]
* main meat: always; {meat}
* main vegetable: always; {vegetable}
* dessert: often; [1:2] of {dessert}

## References

* secret: 2 of #Secret spice#
* week meal: 7 of {meal}
* habit: [1:3]



