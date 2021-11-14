const path = require('path')
const Search = require('./lib/Search')
const dataFilePath = path.join(__dirname, 'data', 'cities_canada-usa.tsv')
//getting the data from the .tsv file and sorting elements by 'name' attribute (alphabetical order)
const data = require('./lib/data')(dataFilePath).sort(({ name: prevName}, {name: nextName}) => prevName > nextName || (prevName < nextName ? -1 : 0))

//creating the SearchEngine Instance and fill it with our data
// we also provide the criterias that the search can compute
// with their score, type, and config (if necessary)
const SearchEngine = new Search(data, {
    name: {
        type: 'text',
        weight: 0.6,
        config: {
            secondarySearchMalus: 0.1
        }
    },
    distance: {
        type: 'distance',
        config: {
            latitudeName: 'lat',
            longitudeName: 'long',
            limit: 1000
        },
        weight: 0.8
    }
},
["name", "id", "distance", "latitude", "longitude", "score"]) // list of acceptable attributes in the response objects

const LondonSearch = SearchEngine.computeSearch({
    name: 'Londo',
    distance: {
        latitude: 43.70011,
        longitude: -79.4163
    }
}); // executing the search present in the readme with 'Londo' and a latitude and longitude as query data

console.log(LondonSearch);

const MontrealSearch = SearchEngine.computeSearch({
    name: 'Mont',
    distance: {
        latitude: 45.5467131,
        longitude: -73.8779451
    }
}); // executing the search with 'Mont' and a latitude and longitude (corresponding to the Airport of Montreal) as query data

console.log(MontrealSearch);