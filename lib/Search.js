const EARTH_RADIUS = 6371.0710 // The earth radius used for the distance calculation process (value in Kilometers)
const RAD_CONVERT_CONST = (Math.PI / 180) // The value used to convert Degrees to Radians

/// Functions adapted from https://stackoverflow.com/a/60465578
// converting Degrees value to Radian
const getRadValue = degreesValue => degreesValue * RAD_CONVERT_CONST

// function to calculate the distance from a point to another (value in kilometer)
const calculateDistance = ({ from, to }) => {

    const { latitude: fromLat, longitude: fromLong } = from
    const { longitude: toLat, longitude: toLong } = to

    if ((fromLat === toLat) && (fromLong === toLong)) return 0

    const fromLatRad = getRadValue(fromLat)
    const toLatRad = getRadValue(fromLat)
    const diffLatRad = (fromLatRad - toLatRad) / 2
    const diffLongRad = getRadValue(fromLong - toLong) / 2
    const diffLatSinValue = Math.pow(Math.sin(diffLatRad), 2)
    const diffLongSinValue = Math.pow(Math.sin(diffLongRad), 2)
    const latCosValue = Math.cos(fromLatRad) * Math.cos(toLatRad)
    const distance = 2 * EARTH_RADIUS * (Math.asin(Math.sqrt(diffLatSinValue + (latCosValue * diffLongSinValue))))

    return parseFloat(distance.toFixed(1))
}

// filter data to process following identifiers already saved from previous searches
const filteredData = (data = [], identifiers = []) => {
    if (!Array.isArray(data) || !data.length) return []
    if (!Array.isArray(identifiers) || !identifiers.length) return data

    return data.filter(({ id }) => {
        return identifiers.includes(id.toString())
    })
}

// format the search results items with the list of acceptable attributes/values they can contain
const filterAcceptableAttributes = (item, acceptableAttributes = []) => {
    if (!Array.isArray(acceptableAttributes) || !acceptableAttributes.length) return item
    const formattedItem = {}

    for (const acceptableAttribute of acceptableAttributes) {
        if (!(acceptableAttribute in item)) continue
        formattedItem[acceptableAttribute] = item[acceptableAttribute]
    }

    return Object.keys(formattedItem).length ? formattedItem : null
}


class Search {
    #data = []
    #criterias = []
    #acceptableAttributes = []
    constructor(data, criterias, acceptableAttributes) {
        if (!Array.isArray(data) || !typeof data === 'object') throw new Error('ERR_DATA_PROVIDED_NOT_VALID')
        if (Array.isArray(criterias) || !typeof criterias === 'object') throw new Error('ERR_CRITERIAS_PROVIDED_NOT_VALID')

        this.#data = !Array.isArray(data) && typeof data === 'object' ? [data] : data // setting up the data associated to the SearchEngine
        this.#criterias = criterias //Setting up the criterias that will structure the search computation
        this.#acceptableAttributes = acceptableAttributes || [] // This part is optional
    }

    // search results following a string value
    // first match is match at the begining of the string
    // secondary match can be everywhere but at the begining of the string
    #textSearch(attributeName, config = {}, queryData, scoreWeight, processableIds = []) {
        const { secondarySearchMalus = 0.0 } = config // we can put a malus to secondary matched result (optional)
        const firstMatchSearch = new RegExp(`^(${queryData}\\w{1,})`, 'gm')
        const secondaryMatchSearch = new RegExp(`(?<!^)(${queryData})\\w{1,}`)
        const results = filteredData(this.#data, processableIds)
        .filter(item => firstMatchSearch.test(item[attributeName]) || secondaryMatchSearch.test(item[attributeName]))
        //first we filter only the results that match one of the regexps
        .map(item => {
            const { id } = item
            const firstMatch = item[attributeName].match(firstMatchSearch)
            const secondaryMatch = item[attributeName].match(secondaryMatchSearch)
            const match = firstMatch || secondaryMatch
            const malus = !firstMatch || !firstMatch.length && secondaryMatch && secondaryMatch.length ? secondarySearchMalus : 0.0
            const itemScore = ((queryData.length / match.shift().length) * scoreWeight) - malus
            // we calculate the weight of the search with the number of matching letters in our provided data
            // minus the potential malus that is applied when the result comes from a secondary match scenario

            return match ? {
                [id]: {
                    [attributeName]: item[attributeName],
                    score: Number(itemScore.toFixed(1)),
                    totalSearchWeight: scoreWeight, // this will help us determine the overall score through the all search process
                    secondaryMatch: !firstMatch && !!secondaryMatch
                }
            } : null
        }) // We now format the results of the search
        .filter(item => !!item)

        return results
    }

    #distanceSearch(distanceConfig, queryData, scoreWeight, processableIds = []) {
        const { latitudeName = 'latitude', longitudeName = 'longitude', limit = 10 } = distanceConfig
        // if the attributes name for the latitude and the longitude have a specific name
        // if can be provided through the criterias config (during initialization)
        const { latitude: queryLatitude, longitude: queryLongitude } = queryData
        // The coordinates provided through the search

        const results = filteredData(this.#data, processableIds)
        .map(item => {
            const { id } = item
            const itemLatitude = latitudeName in item ? item[latitudeName] : 'INVALID'
            const itemLongitude = longitudeName in item ? item[longitudeName] : 'INVALID'
            const isItemValid = (!isNaN(itemLatitude)) && (!isNaN(itemLongitude))
            const distance = isItemValid ? calculateDistance({
                from: {
                    latitude: itemLatitude,
                    longitude: itemLongitude
                },
                to: {
                    latitude: queryLatitude,
                    longitude: queryLongitude
                }
            }) : limit
            // We calculate the distance between our provided position and the position of the item

            const itemScore = distance < limit ? (1 - (distance / limit)) * scoreWeight : 0
            // if the distance is smaller than the limit (acceptable distance result)
            // the score will be the proportion of our distance over our limit
            // multiplied by the score weight

            return isItemValid && (!!itemScore || Array.isArray(processableIds) && processableIds.length) ? {
                [id]: {
                    latitude: itemLatitude,
                    longitude: itemLongitude,
                    score: itemScore,
                    totalSearchWeight: scoreWeight,
                    distance: `${distance} Km` // We provided the distance, it can be good for UI/UX purpose later
                }
            } : null
        })
        .filter(item => !!item)

        return results
    }

    computeSearch(searchQuery, scoreMin = 0.3, searchLimit = 15) {
        if (!typeof searchQuery === 'object' || !Object.keys(searchQuery).length) throw new Error('ERR_SEARCH_QUERY_NOT_VALID')

        const processableIds = []
        const results = {}

        for (const criteriaName in this.#criterias) {
            const searchQueryData = criteriaName in searchQuery ? searchQuery[criteriaName] : null
            // We check if the criteria is part of the search from the user
            const { type: criteriaType, weight: criteriaWeight, config = {} } = this.#criterias[criteriaName]

            if (!searchQueryData) continue

            // We perform the search based on the type of the criteria (text, distance)
            let criteriaResults = {}
            switch (criteriaType) {
                case 'text':
                    criteriaResults = Object.assign(criteriaResults, ...this.#textSearch(criteriaName, config, searchQueryData, criteriaWeight, processableIds))
                    break
                case 'distance':
                    criteriaResults = Object.assign(criteriaResults, ...this.#distanceSearch(config, searchQueryData, criteriaWeight, processableIds))
                    break
            }

            //This part is needed to build the response object of each item
            // and cumulate the score of multiple criteria search cmoputation
            for (const itemId in criteriaResults) {
                if (itemId in results) {
                    const { score: criteriaResultScore } = criteriaResults[itemId]
                    const { score: currentResultScore, totalSearchWeight = 0 } = results[itemId]

                    results[itemId] = {
                        ...results[itemId],
                        ...criteriaResults[itemId],
                        score: criteriaResultScore + currentResultScore,
                        totalSearchWeight: totalSearchWeight + criteriaWeight
                    }
                    continue
                }
                processableIds.push(itemId)
                results[itemId] = criteriaResults[itemId]
            }
        }



        Object.keys(results).forEach(key => {
            const { totalSearchWeight, ...rest } = results[key]

            results[key] = {
                ...rest,
                score: parseFloat((rest.score / totalSearchWeight).toFixed(1)),
            }
        })

        // We sort our results following if they are a secondary match or not (in the case of a text search)
        // and their overall score through the search
        return Object.values(results)
        .sort(({
            score: scoreA,
            secondaryMatch: secondaryMatchA = false
        },
        {
            score: scoreB,
            secondaryMatch: secondaryMatchB = false
        }) => {
            if (!secondaryMatchA && secondaryMatchB) {
                return -1
            } else if (secondaryMatchA && !secondaryMatchB) {
                return 1
            } else {
                return scoreB - scoreA
            }
        })
        .filter(({score}) => score > scoreMin)
        .map(item => filterAcceptableAttributes(item, this.#acceptableAttributes))
        // we return only the accepted attributes for each item
        .slice(0, searchLimit)
        // We limit the number of results to not have an enourmous payload
    }
}

module.exports = Search