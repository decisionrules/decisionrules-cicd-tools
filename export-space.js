const fs = require('fs');

/**
 * Source space management api key. It identifies DecisionRules space
 * @type {string}
 */
const SOURCE_SPACE_MANAGEMENT_APIKEY = process.env.SOURCE_SPACE_MANAGEMENT_APIKEY;

/**
 * Source DecisionRules environment url. Example: // example: https://api.decisionrules.io
 * @type {string}
 */
const SOURCE_ENV_URL = process.env.SOURCE_ENV_URL;


// START
(async () => {
    try {

        const args = process.argv.slice(2);
        const exportFilePath = args[0]


        // check that export file path is specified
        if (!exportFilePath) {
            console.log('Please specify export file path')
        } else {
            console.log('Exporting to file:', exportFilePath)
        }


        if (!SOURCE_ENV_URL) {
            console.error("Set ENV variable SOURCE_ENV_URL. Example: https://api.decisionrules.io");
            return
        }

        if (!SOURCE_SPACE_MANAGEMENT_APIKEY) {
            console.error("Set ENV variable SOURCE_SPACE_APIKEY.");
            return
        }

        const exportedSpace = await exportSpace(SOURCE_SPACE_MANAGEMENT_APIKEY);
        fs.writeFileSync(exportFilePath, JSON.stringify(exportedSpace))
        console.log('Export successfully written to file:', exportFilePath)
        return 0
    } catch(e) {
        console.error('Error:', e)
        return -1
    }

})();


async function exportSpace(sourceSpaceApiKey) {
    // Create URL
    try {
        const url = `${SOURCE_ENV_URL}/api/folder/`;

        // Export old Space contents
        const exportResponse = await fetch(url + 'export/root', {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${sourceSpaceApiKey}`,
                "Content-Type": "application/json"
            }
        })

        // Convert response to json
        return await exportResponse.json()
    }
    catch(e) {
        console.error(`Error occurred during migration: ${e.message}`)
        return -1
    }
}



