const fs = require('fs')

// This functions format the data following the attributes
const formatCityAttribute = (attributeName, data) => {
    let attributeData = data

    switch(attributeName) {
        case 'id':
        case 'admin1':
        case 'admin2':
        case 'admin3':
        case 'admin4':
        case 'population':
        case 'dem':
            attributeData = !isNaN(data) && data !== '' ? parseInt(data) : 0
            break
        case 'lat':
        case 'long':
            attributeData = !isNaN(data) && data !== '' ? parseFloat(data) : 0
            break
        case 'modified_at':
            attributeData = new Date(data)
            break
        default:
            break
    }

    return {
        [attributeName]: attributeData
    }
}

// getting and formatting the data from the filePath provided
const getCitiesData = (filePath) => {
    if (!fs.existsSync(filePath)) throw new Error('ERR_DATA_FILE_NOT_FOUND')
    
    const dataFileContent = fs.readFileSync(filePath, 'utf-8')
    
    if (!dataFileContent) throw new Error('ERR_DATA_FILE_CONTENT_NOT_VALID')
    
    const citiesDataArray = dataFileContent.split('\n').map(el => el.split('\t'))
    const header = Array.isArray(citiesDataArray) && citiesDataArray.length ? citiesDataArray.shift() : null
    
    if (!header) throw new Error('ERR_DATA_FILE_CONTENT_NOT_VALID')
    
    const cities = citiesDataArray.map(cityData => Object.assign({}, ...cityData.map((cityAttributeData, idx) => formatCityAttribute(header[idx], cityAttributeData))))

    return Array.isArray(cities) ? cities : []
}

module.exports = getCitiesData